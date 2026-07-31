# path : app/routers/rag.py
"""
[RAG 파트] 챗봇 엔드포인트.

app/routers/api.py 를 건드리지 않으려고 별도 라우터 파일로 분리했다.
main.py 에서 `app.include_router(rag.router, prefix="/api")` 로 등록한다.

경로는 프론트 lib/api.ts 계약에 맞췄다.
  POST /api/chat          ← 챗봇 메인 (프론트가 호출)
  POST /api/rag/rebuild   ← 인덱스 재생성
  POST /api/rag/search    ← 검색만 확인 (디버그)
  GET  /api/rag/status    ← 인덱스 존재 여부
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.models import User
from app.routers.api import get_current_user
from app.services import rag_service, vector_store_service

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


# ─────────────────── 엔드포인트 ───────────────────


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, user: User = Depends(get_current_user)):
    """문서·법령을 근거로 질문에 답한다. (프론트 챗봇 화면이 호출)

    검색 범위: 본인 문서 + 공용 법령(source_type="law")
    """
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="질문을 입력해 주세요.")

    try:
        return rag_service.ask(question, owner_id=user.id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"답변 생성에 실패했습니다: {exc}")


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
