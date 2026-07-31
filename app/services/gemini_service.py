"""
Gemini 연동.

- generate_summary(prompt) : 문서 요약 (기존 · 요약 담당)
- answer_with_context(...)  : RAG 답변 생성 (RAG 파트 추가)

google-genai 패키지가 없거나 GEMINI_API_KEY 가 비어 있으면
예외를 던지지 않고 안내 문구를 돌려준다. 팀원이 키 없이도 서버를 띄울 수 있어야 하기 때문.

    pip install google-genai
"""

from app.core.config import settings


# ─────────────────── 공통 호출부 ───────────────────


def _generate(prompt: str) -> str | None:
    """Gemini 를 호출한다. 사용할 수 없는 상태면 None 을 돌려준다."""
    if not settings.GEMINI_API_KEY:
        return None

    try:
        from google import genai
    except ImportError:
        print("[Gemini] google-genai 가 설치되지 않았습니다.  pip install google-genai")
        return None

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
        return (response.text or "").strip() or None
    except Exception as exc:  # 네트워크·할당량·모델명 오류 등
        print(f"[Gemini] 호출 실패: {exc}")
        return None


# ─────────────────── 요약 (기존) ───────────────────


def generate_summary(prompt: str) -> str:
    result = _generate(prompt)
    if result is None:
        return "(요약 기능 준비 중: GEMINI_API_KEY 를 설정하거나 google-genai 를 설치하세요)"
    return result


# ─────────────────── RAG 답변 (RAG 파트) ───────────────────

ANSWER_PROMPT = """당신은 분리배출을 안내하는 상담 도우미입니다.
아래 [근거]에 제시된 내용만 사용해서 한국어로 답변하세요.

작성 규칙
1. 근거에 없는 내용은 절대 추측하거나 지어내지 마세요.
2. "배출 가이드"와 "관련 법령"이 모두 있으면 두 층으로 나눠 답하세요.
   먼저 실천 방법을, 그다음 법적 근거를 밝힙니다.
3. 지자체마다 기준이 다르므로, 어느 지역 기준인지 반드시 밝히세요.
   여러 지역 자료가 있으면 지역별로 나눠서 설명하세요.
4. 법령을 인용할 때는 "○○법 제N조" 형태로 조문 번호를 밝히세요.
5. 근거만으로 답할 수 없으면 "관련 자료를 찾을 수 없습니다"라고만 답하세요.
6. 4~6문장으로 간결하게, 바로 실천할 수 있게 설명하세요.

--- 예시 1 (가이드 + 법령) ---
[근거]
### 배출 가이드
[[환경부 공통] 분리배출 가이드라인 품목별 분리배출 요령 > 종이류]
- 종이컵: 내용물 비우고 물로 헹군 후 압착하여 배출
- 비해당품목: 양면 코팅 종이컵 → 종량제봉투

### 관련 법령
[폐기물관리법 제13조]
제13조(폐기물의 처리기준 등) 생활폐기물은 종류별로 분리하여 배출하여야 한다.

[질문] 종이컵은 어떻게 버리나요?
[답변] 환경부 공통 기준으로는 종이컵의 내용물을 비우고 물로 헹군 뒤 납작하게 눌러 종이류로 배출하면 됩니다. 다만 양면이 코팅된 종이컵은 재활용이 되지 않으므로 종량제봉투에 버려야 합니다. 이러한 분리배출은 폐기물관리법 제13조에 따라 생활폐기물을 종류별로 구분해 배출하도록 정한 의무이기도 합니다.

--- 예시 2 (지역별로 다른 경우) ---
[근거]
### 배출 가이드
[[서울시] 분리배출 요령 품목별 분리배출 요령 > 비닐류]
- 비닐: 투명 봉투에 모아 분리배출

[[부산 남구] 분리배출 요령 품목별 분리배출 요령 > 비닐류]
- 일정량을 모아 매주 월요일에 배출

[질문] 비닐은 언제 버려요?
[답변] 지역에 따라 다릅니다. 서울시는 배출 요일 지정 없이 비닐을 투명 봉투에 모아 분리배출하면 됩니다. 반면 부산 남구는 일정량을 모아 매주 월요일에 배출하도록 정하고 있습니다. 거주하시는 지역 기준을 확인하고 배출해 주세요.

--- 예시 3 (자료에 없는 경우) ---
[근거]
### 배출 가이드
[[서울시] 분리배출 요령 품목별 분리배출 요령 > 금속캔]
- 일반 캔류: 내용물 제거 후 분리배출

[질문] 전기차 폐배터리는 어디에 신고하나요?
[답변] 관련 자료를 찾을 수 없습니다.

--- 실제 질문 ---
[근거]
{context}

[질문] {question}
[답변]"""


def answer_with_context(question: str, context: str) -> str:
    """검색된 가이드·법령만 근거로 질문에 답한다. (rag_service 가 호출)"""
    result = _generate(ANSWER_PROMPT.format(context=context, question=question))

    # LLM 을 쓸 수 없으면 검색 결과라도 보여준다 (서버가 죽지 않게)
    if result is None:
        return (
            "[LLM 미연결 · 검색된 자료 원문]\n"
            "GEMINI_API_KEY 설정 후 다시 질문하면 요약된 답변을 받을 수 있습니다.\n\n"
            f"{context}"
        )
    return result
