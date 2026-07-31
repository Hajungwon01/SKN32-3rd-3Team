# path : app/services/rag_service.py
"""
[RAG 파트] 청킹·임베딩·벡터 검색·답변 생성을 조합하는 오케스트레이터.

  - rebuild_index() : 문서 전체 → 청킹 → 임베딩 → FAISS 재구축
  - search()        : 질문과 유사한 청크 검색 (소유자 필터링 지원)
  - ask()           : 검색 결과를 근거로 답변 + 출처 반환

문서 출처는 .env 의 RAG_SOURCE 로 전환합니다.
  - "db"    : MySQL documents 테이블 (기본)
  - "files" : data/docs 폴더의 txt/md/pdf (DB 없이 단독 테스트용)
"""

from __future__ import annotations

from pathlib import Path

from app.core.config import settings
from app.services import chunk_service, embedding_service, vector_store_service

# 프론트에 돌려줄 근거 미리보기 길이
SNIPPET_LENGTH = 120


# ─────────────────── 공개 API ───────────────────


def rebuild_index(db=None) -> dict:
    """문서 전체를 다시 인덱싱합니다.

    전체 재구축 방식을 쓰는 이유:
      문서 수정·삭제 시 FAISS 와의 동기화 문제를 피하는 가장 단순한 방법입니다.
      문서량이 적은 초기 단계에서는 몇 초면 끝나므로 증분 갱신은 추후 과제로 둡니다.
    """
    documents = _load_documents(db)
    chunks = chunk_service.build_chunks(documents)

    vectors = embedding_service.embed_documents([c["content"] for c in chunks])
    count = vector_store_service.rebuild(
        chunks, vectors, embedding_service.get_dimension()
    )

    return {
        "documents": len(documents),
        "indexed_chunks": count,
        "source": settings.RAG_SOURCE,
        "embedding_backend": settings.EMBEDDING_BACKEND,
    }


def search(
    query: str,
    top_k: int | None = None,
    owner_id: int | None = None,
) -> list[dict]:
    """질문과 유사한 청크를 점수 순으로 반환합니다.

    owner_id 를 넘기면 해당 사용자의 문서에서 나온 청크만 반환합니다.
    (인덱스는 전체 문서를 담으므로, 타인 문서 노출을 막으려면 필수)
    """
    top_k = top_k or settings.RAG_TOP_K
    query_vector = embedding_service.embed_query(query)

    # 필터링 후에도 top_k 개를 채우기 위해 넉넉히 검색한 뒤 잘라냅니다.
    fetch_k = top_k * 5 if owner_id is not None else top_k
    results = vector_store_service.search(query_vector, fetch_k)

    if owner_id is not None:
        results = [r for r in results if r.get("owner_id") == owner_id]

    return results[:top_k]


def ask(
    question: str,
    top_k: int | None = None,
    owner_id: int | None = None,
) -> dict:
    """검색된 문맥을 근거로 답변을 생성합니다.

    반환 형식은 프론트 types/api.ts 의 ChatResponse 와 동일합니다.
        {"answer": str,
         "sources": [{"document_id": int, "title": str, "snippet": str}, ...]}
    """
    results = search(question, top_k, owner_id)

    if not results:
        return {
            "answer": "관련 문서를 찾지 못했습니다. 문서를 먼저 작성하거나 인덱스를 재생성해 주세요.",
            "sources": [],
        }

    # 검색된 청크들을 [출처] 표기와 함께 하나의 컨텍스트 문자열로 조립
    context = "\n\n".join(
        f"[출처: {item['title']}]\n{item['content']}" for item in results
    )

    return {
        "answer": _generate_answer(question, context),
        "sources": _build_sources(results),
    }


def _build_sources(results: list[dict]) -> list[dict]:
    """검색 결과를 프론트 ChatSource 형식으로 변환합니다. (문서당 1개, 등장순)"""
    sources: list[dict] = []
    seen: set = set()

    for item in results:
        doc_id = item.get("document_id")
        if doc_id in seen:
            continue
        seen.add(doc_id)

        snippet = " ".join(item["content"].split())  # 줄바꿈·공백 정리
        if len(snippet) > SNIPPET_LENGTH:
            snippet = snippet[:SNIPPET_LENGTH] + "…"

        sources.append(
            {
                "document_id": doc_id,
                "title": item.get("title", "제목 없음"),
                "snippet": snippet,
            }
        )

    return sources


# ─────────────────── 문서 공급 ───────────────────


def _load_documents(db=None) -> list[dict]:
    """인덱싱 대상 문서를 [{"id", "owner_id", "title", "content"}, ...] 로 반환합니다."""
    if settings.RAG_SOURCE.lower() == "files":
        return _load_from_files()
    return _load_from_db(db)


def _load_from_db(db=None) -> list[dict]:
    """MySQL documents 테이블에서 문서를 읽습니다. (RAG_SOURCE=db)

    본문·요약·평문(content_text)이 있으면 모두 합쳐 인덱싱합니다.
    녹취록과 요약본도 documents 에 저장되므로 STT 파트와 별도 연동이 필요 없습니다.
    """
    from app.database import SessionLocal
    from app.models import Document

    own_session = db is None
    session = db or SessionLocal()

    try:
        documents: list[dict] = []

        for row in session.query(Document).all():
            # 프론트가 content_text(평문)를 보내는 스키마로 바뀌어도 자동 대응
            candidates = [
                getattr(row, "content_text", None),
                row.content,
                row.summary,
            ]
            parts = [p for p in candidates if isinstance(p, str) and p.strip()]
            if not parts:
                continue

            documents.append(
                {
                    "id": row.id,
                    "owner_id": row.owner_id,
                    "title": row.title,
                    "content": "\n\n".join(parts),
                }
            )

        if not documents:
            print("[RAG] documents 테이블에 인덱싱할 문서가 없습니다.")

        return documents
    finally:
        if own_session:
            session.close()


def _load_from_files() -> list[dict]:
    """data/docs 폴더에서 문서를 읽습니다. (RAG_SOURCE=files, DB 없이 테스트용)"""
    settings.DOCS_DIR.mkdir(parents=True, exist_ok=True)
    supported = {".txt", ".md", ".pdf"}

    documents: list[dict] = []
    for i, path in enumerate(sorted(settings.DOCS_DIR.iterdir()), start=1):
        if not (path.is_file() and path.suffix.lower() in supported):
            continue

        text = _read_file(path)
        if not text.strip():
            print(f"[RAG] 텍스트를 추출하지 못했습니다: {path.name} (스캔 PDF면 OCR 필요)")
            continue

        documents.append(
            {
                "id": i,           # 임시 id (파일 모드 전용)
                "owner_id": None,  # 파일 모드에는 소유자 개념이 없음
                "title": path.stem,
                "content": text,
            }
        )

    if not documents:
        print(f"[RAG] 문서를 찾지 못했습니다. 경로: {settings.DOCS_DIR}")
        print(f"      지원 형식: {', '.join(sorted(supported))}")

    return documents


def _read_file(path: Path) -> str:
    """확장자에 맞는 방식으로 텍스트를 추출합니다."""

    if path.suffix.lower() == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError:
            print("[RAG] pypdf 가 설치되지 않았습니다.  pip install pypdf")
            return ""
        return "\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages)

    # Windows 메모장으로 저장한 파일은 cp949 인 경우가 있어 대비
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="cp949")


# ─────────────────── 답변 생성 ───────────────────


def _generate_answer(question: str, context: str) -> str:
    """컨텍스트를 근거로 답변을 생성합니다.

    1순위: gemini_service.answer_with_context() 가 있으면 사용
    2순위: 없으면 검색된 원문을 그대로 보여주는 대체 답변

    → gemini_service 에 함수가 추가되는 순간 자동으로 1순위로 전환되므로
      이 파일은 수정할 필요가 없습니다.
    """
    try:
        from app.services import gemini_service

        if hasattr(gemini_service, "answer_with_context"):
            return gemini_service.answer_with_context(question, context)
    except ImportError:
        pass  # gemini_service 미구현 상태

    return (
        "[LLM 미연결 상태 · 검색 결과 원문]\n"
        f"{context}"
    )
