# path : app/services/embedding_service.py
"""
[RAG 파트] 텍스트를 임베딩 벡터로 변환합니다.

백엔드 2종을 .env의 EMBEDDING_BACKEND 값으로 전환:
  - "local"  : 해시 기반 결정적 임베딩. API 키·네트워크 불필요 → 개발/테스트용
  - "gemini" : Gemini Embeddings API. 실제 의미 기반 임베딩 → 통합 단계에서 전환

인터페이스는 embed_documents / embed_query 두 개로 고정.
백엔드를 바꿔도 호출하는 쪽(rag_service)은 수정할 필요가 없습니다.

참조: 3_4/5/mcp_rag_project/app/llm/embedding_service.py
"""

from __future__ import annotations

import hashlib
import time

import numpy as np

from app.core.config import settings


def get_dimension() -> int:
    """현재 백엔드의 임베딩 벡터 차원을 반환합니다. (FAISS 인덱스 생성 시 필요)"""
    if settings.EMBEDDING_BACKEND.lower() == "gemini":
        return settings.GEMINI_EMBEDDING_DIMENSION
    return settings.LOCAL_EMBEDDING_DIMENSION


def embed_documents(texts: list[str]) -> list[list[float]]:
    """문서(청크) 목록을 임베딩 벡터 목록으로 변환합니다."""
    if not texts:
        return []
    if settings.EMBEDDING_BACKEND.lower() == "gemini":
        return _embed_gemini(texts)
    return [_embed_local(t) for t in texts]


def embed_query(text: str) -> list[float]:
    """검색 질문 하나를 임베딩 벡터로 변환합니다."""
    return embed_documents([text])[0]


# ─────────────────────────── 내부 구현 ───────────────────────────


def _tokenize(text: str) -> list[str]:
    """공백 단어 + 문자 2-gram 토큰을 생성합니다.

    한국어는 조사가 붙어 단어가 그대로 일치하는 경우가 드물다.
    ("배송비는" vs "배송비" → 공백 토큰으로는 불일치)
    문자 2-gram("배송", "송비", "비는"...)을 함께 쓰면
    부분 문자열이 겹칠 때 유사도가 잡히므로 한국어 개발 테스트가 가능해진다.
    """
    words = text.lower().split()
    tokens: list[str] = list(words)
    for word in words:
        if len(word) >= 2:
            tokens.extend(word[i : i + 2] for i in range(len(word) - 1))
    return tokens


def _embed_local(text: str) -> list[float]:
    """해시 기반 로컬 임베딩 (개발용).

    토큰별 SHA-256 해시로 벡터의 위치·부호를 결정해 누적하는 방식.
    같은 입력이면 항상 같은 벡터가 나오므로(결정적) 파이프라인 검증에 적합.
    의미 유사도는 표면 문자열 겹침 수준까지만 잡히는 한계가 있음 → 실서비스는 gemini로 전환.
    """
    dim = settings.LOCAL_EMBEDDING_DIMENSION
    vector = np.zeros(dim, dtype=np.float32)

    for token in _tokenize(text):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "little") % dim   # 해시 → 벡터 위치
        sign = 1.0 if digest[4] % 2 == 0 else -1.0           # 해시 → 부호
        vector[index] += sign

    # 코사인 유사도 계산을 위해 단위 벡터로 정규화
    norm = float(np.linalg.norm(vector))
    if norm > 0.0:
        vector = vector / norm

    return vector.tolist()


def _embed_gemini(texts: list[str]) -> list[list[float]]:
    """Gemini Embeddings API 호출 (실서비스용).

    API 가 요청 1건당 최대 100개까지만 받으므로 배치로 쪼개 보낸다.
    (초과 시 400 INVALID_ARGUMENT: at most 100 requests can be in one batch)

    무료 등급은 분당 요청 수 제한도 있어서, 429 가 나면 잠깐 쉬었다 다시 시도한다.

        pip install google-genai
    """
    if not settings.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY가 설정되지 않았습니다. "
            ".env에 키를 넣거나 EMBEDDING_BACKEND=local로 되돌리세요."
        )

    # 지연 임포트: local 백엔드만 쓸 때는 패키지가 없어도 동작하도록
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

        for attempt in range(1, 4):  # 최대 3회 시도
            try:
                response = client.models.embed_content(
                    model=settings.GEMINI_EMBEDDING_MODEL,
                    contents=batch,
                    config=config,
                )
                vectors.extend(list(e.values) for e in response.embeddings)
                break
            except Exception as exc:
                # 분당 요청 제한(429)이면 기다렸다 재시도, 그 외에는 즉시 중단
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