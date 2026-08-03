# path : app/services/embedding_service.py
"""
[RAG 파트] 텍스트를 임베딩 벡터로 변환합니다.

백엔드 3종을 .env의 EMBEDDING_BACKEND 값으로 전환:
  - "local"  : sentence-transformers 로컬 임베딩. API 키 불필요, CPU만으로 동작.
  - "gemini" : Gemini Embeddings API. (API 할당량 제한 있음)
  - "hash"   : 해시 기반 결정적 임베딩. 파이프라인 검증용 (의미 유사도 없음)

인터페이스는 embed_documents / embed_query 두 개로 고정.
백엔드를 바꿔도 호출하는 쪽(rag_service)은 수정할 필요가 없습니다.
"""

from __future__ import annotations

import hashlib
import time

import numpy as np

from app.core.config import settings

# ─── sentence-transformers 모델 (지연 로드, 싱글톤) ───────────────
_st_model = None
_ST_MODEL_NAME = "intfloat/multilingual-e5-small"  # 384d, 한국어 지원, CPU 적합
_ST_DIMENSION = 384


def _get_st_model():
    global _st_model
    if _st_model is None:
        from sentence_transformers import SentenceTransformer
        print(f"[임베딩] sentence-transformers 모델 로드 중: {_ST_MODEL_NAME}")
        _st_model = SentenceTransformer(_ST_MODEL_NAME)
        print(f"[임베딩] 모델 로드 완료 (차원: {_ST_DIMENSION})")
    return _st_model


def get_dimension() -> int:
    """현재 백엔드의 임베딩 벡터 차원을 반환합니다."""
    backend = settings.EMBEDDING_BACKEND.lower()
    if backend == "gemini":
        return settings.GEMINI_EMBEDDING_DIMENSION
    if backend == "hash":
        return settings.LOCAL_EMBEDDING_DIMENSION
    # local (sentence-transformers)
    return _ST_DIMENSION


def embed_documents(texts: list[str]) -> list[list[float]]:
    """문서(청크) 목록을 임베딩 벡터 목록으로 변환합니다."""
    if not texts:
        return []
    backend = settings.EMBEDDING_BACKEND.lower()
    if backend == "gemini":
        return _embed_gemini(texts)
    if backend == "hash":
        return [_embed_hash(t) for t in texts]
    # local (sentence-transformers)
    return _embed_local_st(texts)


def embed_query(text: str) -> list[float]:
    """검색 질문 하나를 임베딩 벡터로 변환합니다."""
    return embed_documents([text])[0]


# ─────────────────────────── 내부 구현 ───────────────────────────


def _embed_local_st(texts: list[str]) -> list[list[float]]:
    """sentence-transformers 로컬 임베딩 (실서비스용).

    multilingual-e5 모델은 입력 앞에 "query: " 또는 "passage: " 접두사를 붙여야
    성능이 좋지만, 문서/질문 구분 없이 쓸 때는 생략해도 충분히 동작한다.
    """
    model = _get_st_model()
    # e5 모델 권장: 접두사 추가
    prefixed = [f"query: {t}" for t in texts]
    embeddings = model.encode(prefixed, normalize_embeddings=True, show_progress_bar=len(texts) > 50)
    return embeddings.tolist()


def _embed_hash(text: str) -> list[float]:
    """해시 기반 임베딩 (파이프라인 검증용). 의미 유사도 없음."""
    dim = settings.LOCAL_EMBEDDING_DIMENSION
    vector = np.zeros(dim, dtype=np.float32)

    words = text.lower().split()
    tokens = list(words)
    for word in words:
        if len(word) >= 2:
            tokens.extend(word[i : i + 2] for i in range(len(word) - 1))

    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "little") % dim
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign

    norm = float(np.linalg.norm(vector))
    if norm > 0.0:
        vector = vector / norm
    return vector.tolist()


def _embed_gemini(texts: list[str]) -> list[list[float]]:
    """Gemini Embeddings API 호출."""
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY가 설정되지 않았습니다. "
            ".env에 키를 넣거나 EMBEDDING_BACKEND=local로 되돌리세요."
        )

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    config = types.EmbedContentConfig(
        output_dimensionality=settings.GEMINI_EMBEDDING_DIMENSION,
    )

    batch_size = max(1, min(settings.GEMINI_EMBEDDING_BATCH, 100))
    total = len(texts)
    vectors: list[list[float]] = []

    for start in range(0, total, batch_size):
        batch = texts[start : start + batch_size]

        for attempt in range(1, 4):
            try:
                response = client.models.embed_content(
                    model=settings.GEMINI_EMBEDDING_MODEL,
                    contents=batch,
                    config=config,
                )
                vectors.extend(list(e.values) for e in response.embeddings)
                break
            except Exception as exc:
                if "429" not in str(exc) and "RESOURCE_EXHAUSTED" not in str(exc):
                    raise
                if attempt == 3:
                    raise
                wait = 20 * attempt
                print(f"    요청 한도 초과. {wait}초 대기 후 재시도 ({attempt}/3)")
                time.sleep(wait)

        done = min(start + batch_size, total)
        print(f"    임베딩 {done}/{total}")

    return vectors