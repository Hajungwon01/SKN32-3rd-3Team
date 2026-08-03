# path : app/routers/rag.py
"""
[RAG 파트] 챗봇 엔드포인트.

app/routers/api.py 를 건드리지 않으려고 별도 라우터 파일로 분리했다.
main.py 에서 `app.include_router(rag.router, prefix="/api")` 로 등록한다.

경로는 프론트 lib/api.ts 계약에 맞췄다.
  POST /api/chat           ← 챗봇 메인 (프론트가 호출)
  POST /api/rag/rebuild    ← 인덱스 재생성
  POST /api/rag/search     ← 검색만 확인 (디버그)
  GET  /api/rag/status     ← 인덱스 존재 여부
  GET  /api/chat/sessions  ← 대화방 목록 + 각 대화 복원 (하정원 추가)

[대화 기록/흐름 유지 + 대화방(세션) 지원 - 하정원]
- ChatLog(기존, 통계용: 질문/지역/성공여부만)와는 별개로 ChatMessage(신규,
  대화 원문 전체)에 저장해서 새로고침해도 대화가 남도록 한다.
- session_id로 여러 대화방을 구분한다 (프론트의 "새 대화" 버튼이 만드는
  값을 그대로 받아 저장). 안 보내면 None으로 저장되고, 예전 데이터도
  session_id가 없어 하나의 "레거시 대화"로 묶인다.
- 같은 session_id 안에서 최근 대화(HISTORY_TURNS_FOR_CONTEXT턴)만 골라
  rag_service.ask()에 넘겨서, 대화방마다 독립적으로 맥락이 유지된다
  (다른 대화방 내용이 섞여 들어가지 않음).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ChatLog, ChatMessage, QuestionCluster, User
from app.routers.api import get_current_user
from app.services import rag_service, vector_store_service

router = APIRouter()

# 답변 생성 시 프롬프트에 같이 넣어줄 최근 대화 개수(사용자+챗봇 합산 기준).
HISTORY_TURNS_FOR_CONTEXT = 3

# session_id를 안 보낸 예전 대화(또는 세션 개념 없이 저장된 대화)를
# 묶어서 부르는 이름. 실제 컬럼 값은 여전히 NULL이고, 이건 API 응답에서만
# 쓰는 표시용 키다.
LEGACY_SESSION_KEY = "legacy"


# ─────────────────── 스키마 (프론트 types/api.ts 와 1:1) ───────────────────


class ChatRequest(BaseModel):
    question: str
    region: str = "seoul"  # seoul | cheonan | busan_namgu
    session_id: str | None = None  # 프론트 "새 대화" 버튼의 세션 값 (하정원 추가)


class ChatSource(BaseModel):
    document_id: int | None
    title: str
    snippet: str


class ChatResponse(BaseModel):
    answer: str  # 가이드+법률 통합 답변
    tip: str     # 실천 팁
    source: str  # 출처 요약 문자열
    sources: list[ChatSource]


class RagSearchRequest(BaseModel):
    query: str
    top_k: int = 4


class ChatHistoryItem(BaseModel):
    role: str
    content: str
    created_at: str


class ChatSessionGroup(BaseModel):
    session_id: str  # LEGACY_SESSION_KEY 이거나 프론트가 보낸 값
    region: str  # 이 대화방에서 마지막으로 쓰인 지역 선택값 (복원용)
    messages: list[ChatHistoryItem]


# ─────────────────── 엔드포인트 ───────────────────


@router.post("/chat", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """문서·법령을 근거로 질문에 답한다. (프론트 챗봇 화면이 호출)

    검색 범위: 본인 문서 + 공용 법령(source_type="law") + 지역(req.region)
    대화 흐름: req.session_id 로 지정된 대화방 안에서만 최근 맥락을 참고한다.
    """
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="질문을 입력해 주세요.")

    history = _load_recent_history(db, user.id, req.session_id, HISTORY_TURNS_FOR_CONTEXT)

    # 대화 기록 저장 (복원/흐름 유지용) - 답변 생성 전에 유저 질문부터 저장
    db.add(ChatMessage(
        owner_id=user.id, session_id=req.session_id, region=req.region,
        role="user", content=question,
    ))
    db.commit()

    try:
        result = rag_service.ask(question, owner_id=user.id, region=req.region, history=history)

        # 기존 통계 로그 + 클러스터 매칭
        has_answer = bool(result.get("answer")) and "찾을 수 없습니다" not in result.get("answer", "")
        cid = _assign_cluster(db, question)
        db.add(ChatLog(user_id=user.id, question=question, region=req.region, has_answer=has_answer, cluster_id=cid))

        # 대화 기록 저장 (복원/흐름 유지용) - 챗봇 답변
        db.add(ChatMessage(
            owner_id=user.id, session_id=req.session_id, region=req.region,
            role="assistant", content=result.get("answer", ""),
        ))
        db.commit()

        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"답변 생성에 실패했습니다: {exc}")


@router.get("/chat/sessions", response_model=list[ChatSessionGroup])
def chat_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """로그인한 유저의 대화를 대화방(session_id)별로 묶어서 돌려준다.

    프론트가 페이지 로드 시 이걸 호출해서 여러 대화방을 각각 복원한다.
    각 대화방 내부는 시간순(오래된 것부터)이고, 대화방 자체는 가장 최근
    메시지가 있는 순서로 정렬한다(최근 대화가 위로 오게).
    """
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.owner_id == user.id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        .all()
    )

    groups: dict[str, list[ChatMessage]] = {}
    order: list[str] = []  # 최근 메시지 순으로 재정렬하기 위한 키 등장 순서 추적
    for r in rows:
        key = r.session_id or LEGACY_SESSION_KEY
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(r)

    # 가장 최근에 메시지가 추가된 대화방이 앞에 오도록
    order.sort(key=lambda k: groups[k][-1].created_at, reverse=True)

    return [
        ChatSessionGroup(
            session_id=key,
            # region 컬럼이 없던 시절 데이터(레거시)는 기본값 seoul로.
            region=groups[key][-1].region or "seoul",
            messages=[
                ChatHistoryItem(role=m.role, content=m.content, created_at=m.created_at.isoformat())
                for m in groups[key]
            ],
        )
        for key in order
    ]


def _load_recent_history(
    db: Session, owner_id: int, session_id: str | None, turns: int
) -> list[dict]:
    """같은 대화방(session_id) 안에서 최근 N턴을 오래된 순으로 반환.

    session_id가 None이면(=레거시) None인 것들끼리만 묶어서 본다 - 다른
    대화방 내용이 맥락으로 섞여 들어가지 않게.
    """
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.owner_id == owner_id, ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(turns * 2)
        .all()
    )
    rows.reverse()
    return [{"role": r.role, "content": r.content} for r in rows]


@router.post("/rag/rebuild")
def rebuild_index(user: User = Depends(get_current_user)):
    """문서 전체를 벡터 인덱스로 재구축한다.

    호출 시점: 최초 1회 + 문서 추가·수정·삭제 후.
    """
    try:
        return rag_service.rebuild_index()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"인덱싱에 실패했습니다: {exc}")


@router.post("/rag/search")
def search_chunks(req: RagSearchRequest, user: User = Depends(get_current_user)):
    """유사 청크만 반환한다. (답변 생성 없이 검색 품질 확인용)"""
    try:
        results = rag_service.search(req.query, req.top_k, owner_id=user.id)
        return {"count": len(results), "results": results}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"검색에 실패했습니다: {exc}")


@router.get("/rag/status")
def index_status(user: User = Depends(get_current_user)):
    """인덱스가 만들어져 있는지 확인한다."""
    return {"index_exists": vector_store_service.index_exists()}


def _assign_cluster(db: Session, question: str) -> int | None:
    """새 질문을 기존 클러스터에 매칭하거나, 새 클러스터를 만든다.

    임베딩 1회만 호출 → 기존 클러스터 벡터와 비교 → 유사도 0.85 이상이면 기존 클러스터에 편입.
    """
    import json
    import numpy as np
    from app.services import embedding_service

    SIMILARITY_THRESHOLD = 0.85

    try:
        vec = embedding_service.embed_documents([question])[0]
    except Exception:
        return None

    vec_arr = np.array(vec, dtype=np.float32)
    norm = np.linalg.norm(vec_arr)
    if norm > 0:
        vec_arr = vec_arr / norm

    # 기존 클러스터와 비교
    clusters = db.query(QuestionCluster).all()
    best_cluster = None
    best_sim = -1.0

    for cluster in clusters:
        c_vec = np.array(json.loads(cluster.embedding), dtype=np.float32)
        sim = float(np.dot(vec_arr, c_vec))
        if sim >= SIMILARITY_THRESHOLD and sim > best_sim:
            best_sim = sim
            best_cluster = cluster

    if best_cluster:
        best_cluster.count += 1
        db.flush()
        return best_cluster.id
    else:
        # 새 클러스터 생성
        new_cluster = QuestionCluster(
            representative=question,
            embedding=json.dumps(vec_arr.tolist()),
            count=1,
        )
        db.add(new_cluster)
        db.flush()
        return new_cluster.id


@router.get("/popular-questions")
def popular_questions(
    limit: int = 5,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """인기 질문 TOP N을 반환한다. (DB 저장된 클러스터 기반 — 임베딩 호출 없음)"""
    clusters = (
        db.query(QuestionCluster)
        .order_by(QuestionCluster.count.desc())
        .limit(limit)
        .all()
    )
    if not clusters:
        return []
    return [{"question": c.representative, "count": c.count} for c in clusters]
