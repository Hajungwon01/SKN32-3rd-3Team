# path : app/services/vector_store_service.py
"""
[RAG 파트] FAISS 인덱스의 생성·저장·검색을 담당합니다.

저장 구조 (data/indexes/):
  - index.faiss  : 임베딩 벡터만 담긴 FAISS 인덱스 파일
  - chunks.json  : 청크 본문 + 메타데이터 목록 (FAISS 위치 번호 = 리스트 인덱스)

핵심 아이디어:
  FAISS는 벡터를 추가한 순서대로 0, 1, 2... 위치 번호를 부여한다.
  chunks.json도 같은 순서로 저장하므로 "위치 번호 = 리스트 인덱스"가 성립,
  별도 매핑 테이블 없이 검색 결과 위치로 청크 내용을 바로 찾을 수 있다.
  두 파일은 항상 rebuild()에서 한 쌍으로 생성되므로 어긋날 일이 없다.

코사인 유사도 구현:
  벡터를 L2 정규화한 뒤 내적(IndexFlatIP)을 취하면 코사인 유사도와 동일.
  → 점수 범위 대략 -1 ~ 1, 1에 가까울수록 유사.

참조: 3_4/5/mcp_rag_project/app/vectordb/faiss_store.py
"""

from __future__ import annotations

import json
from pathlib import Path

import faiss
import numpy as np

from app.core.config import settings


def _index_path() -> Path:
    return settings.INDEX_DIR / "index.faiss"


def _meta_path() -> Path:
    return settings.INDEX_DIR / "chunks.json"


def rebuild(chunks: list[dict], vectors: list[list[float]], dimension: int) -> int:
    """청크와 벡터로 FAISS 인덱스를 전체 재구축하고 디스크에 저장합니다.

    전체 재구축(rebuild) 방식을 쓰는 이유:
      MySQL 문서 수정·삭제 시 FAISS와의 동기화 문제를 피하는 가장 단순한 방법.
      문서량이 적은 초기 단계에서는 몇 초면 끝나므로 증분 업데이트는 추후 과제.
    """
    settings.INDEX_DIR.mkdir(parents=True, exist_ok=True)

    matrix = np.asarray(vectors, dtype=np.float32)

    # 코사인 유사도를 위해 모든 벡터를 단위 길이로 정규화
    if len(matrix) > 0:
        faiss.normalize_L2(matrix)

    # 내적 기반 Flat 인덱스: 전수 비교라 느리지만 정확, 이 규모에선 충분
    index = faiss.IndexFlatIP(dimension)
    if len(matrix) > 0:
        index.add(matrix)

    # 인덱스와 청크 메타를 한 쌍으로 저장
    faiss.write_index(index, str(_index_path()))
    _meta_path().write_text(
        json.dumps(chunks, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return len(chunks)


def search(query_vector: list[float], top_k: int | None = None) -> list[dict]:
    """질문 벡터와 유사한 청크를 점수 순으로 반환합니다.

    반환 형식: [{"content", "document_id", "source", "chunk_index", "score"}, ...]
    """
    top_k = top_k or settings.RAG_TOP_K

    # 인덱스가 아직 없으면 빈 결과 (호출부에서 rebuild 안내 처리)
    if not _index_path().exists() or not _meta_path().exists():
        return []

    index = faiss.read_index(str(_index_path()))
    chunks: list[dict] = json.loads(_meta_path().read_text(encoding="utf-8"))

    query = np.asarray([query_vector], dtype=np.float32)
    faiss.normalize_L2(query)

    # 저장된 청크 수보다 많이 요청하지 않도록 보정
    limit = min(top_k, index.ntotal)
    if limit == 0:
        return []

    scores, positions = index.search(query, limit)

    results: list[dict] = []
    for position, score in zip(positions[0], scores[0]):
        if position < 0:  # FAISS가 채우지 못한 슬롯은 -1
            continue
        item = dict(chunks[position])       # 위치 번호 = chunks.json 리스트 인덱스
        item["score"] = round(float(score), 4)
        results.append(item)

    return results


def index_exists() -> bool:
    """인덱스가 빌드되어 있는지 확인합니다. (상태 조회 API용)"""
    return _index_path().exists() and _meta_path().exists()
