# path : app/routers/rag.py
"""
[RAG 파트] 챗봇 엔드포인트.

app/routers/api.py 를 건드리지 않으려고 별도 라우터 파일로 분리했습니다.
app/main.py 에 두 줄만 추가하면 등록됩니다 (README 참고).

경로는 프론트 lib/api.ts 계약에 맞췄습니다.
  POST /api/chat          ← 챗봇 메인 (프론트가 호출)
  POST /api/rag/rebuild   ← 인덱스 재생성 (운영·디버그용)
  POST /api/rag/search    ← 검색만 확인 (디버그용)
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import rag_service

router = APIRouter()


# ─────────────────── 스키마 (프론트 types/api.ts 와 1:1) ───────────────────


class ChatRequest(BaseModel):
    question: str


class ChatSource(BaseModel):
    document_id: int | None
    title: str
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource]


class RagSearchRequest(BaseModel):
    query: str
    top_k: int = 4


# ─────────────────── 로그인 사용자 판별 ───────────────────
#
# 인증 방식이 확정되면(세션 쿠키 vs Bearer 토큰) 아래 함수만 교체하면 됩니다.
# 현재는 None 을 반환하므로 소유자 필터링 없이 전체 문서를 검색합니다.
#
# 예시 — api.py 의 get_current_user 를 쓰는 경우:
#     from fastapi import Depends
#     from app.models import User
#     from app.routers.api import get_current_user
#
#     def get_owner_id(user: User = Depends(get_current_user)) -> int | None:
#         return user.id
#
# 그리고 아래 엔드포인트 인자에 `owner_id: int | None = Depends(get_owner_id)` 추가.


def get_owner_id() -> int | None:
    """현재 로그인 사용자 id. 인증 연동 전이라 None(필터링 없음)."""
    return None


# ─────────────────── 엔드포인트 ───────────────────


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """문서를 근거로 질문에 답합니다. (프론트 챗봇 화면이 호출)"""
    try:
        return rag_service.ask(req.question, owner_id=get_owner_id())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"답변 생성에 실패했습니다: {exc}")


@router.post("/rag/rebuild")
def rebuild_index():
    """문서 전체를 벡터 인덱스로 재구축합니다.

    호출 시점: 최초 1회 + 문서 추가·수정·삭제 후.
    (STT 녹취록 저장 후에도 호출하면 바로 검색 대상에 포함됩니다)
    """
    try:
        return rag_service.rebuild_index()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"인덱싱에 실패했습니다: {exc}")


@router.post("/rag/search")
def search_chunks(req: RagSearchRequest):
    """유사 청크만 반환합니다. (답변 생성 없이 검색 품질 확인용)"""
    try:
        results = rag_service.search(req.query, req.top_k, owner_id=get_owner_id())
        return {"count": len(results), "results": results}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"검색에 실패했습니다: {exc}")
