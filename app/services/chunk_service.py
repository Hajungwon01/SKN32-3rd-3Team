# path : app/services/chunk_service.py
"""
[RAG 파트] 문서 텍스트를 검색 단위 청크로 분할합니다.

문자 수 기준 슬라이딩 윈도우 방식(chunk_size / chunk_overlap)이며,
각 청크에 원본 추적용 메타데이터를 붙입니다.
"""

from __future__ import annotations

from app.core.config import settings


def split_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[str]:
    """긴 텍스트를 chunk_size 문자 단위로, chunk_overlap 만큼 겹치게 자릅니다.

    겹침을 두는 이유:
      청크 경계에서 문장이 잘리면 검색 시 문맥이 끊기므로,
      인접 청크가 일부 내용을 공유하게 해 경계 손실을 줄입니다.
    """
    chunk_size = chunk_size or settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    if not text or not text.strip():
        return []

    # 다음 청크 시작 위치의 이동 폭 (overlap 만큼 되돌아가서 시작)
    step = max(1, chunk_size - chunk_overlap)

    chunks: list[str] = []
    for start in range(0, len(text), step):
        end = start + chunk_size
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        # 문서 끝까지 읽었으면 종료 (마지막 꼬리 청크 중복 방지)
        if end >= len(text):
            break

    return chunks


def build_chunks(documents: list[dict]) -> list[dict]:
    """문서 목록 전체를 청크 목록으로 변환합니다.

    입력:  [{"id": 1, "owner_id": 3, "title": "회의록", "content": "..."}, ...]
    출력:  [{"content": "...", "document_id": 1, "owner_id": 3,
              "title": "회의록", "chunk_index": 0}, ...]

    owner_id 를 함께 저장하는 이유:
      인덱스는 전체 사용자 문서를 담지만, 검색 시 질문한 사용자의 문서만
      돌려주도록 필터링해야 타인 문서가 노출되지 않습니다.
    """
    chunks: list[dict] = []

    for doc in documents:
        for chunk_index, piece in enumerate(split_text(doc.get("content", ""))):
            chunks.append(
                {
                    "content": piece,
                    "document_id": doc.get("id"),
                    "owner_id": doc.get("owner_id"),
                    "title": doc.get("title", "제목 없음"),
                    "chunk_index": chunk_index,
                }
            )

    return chunks
