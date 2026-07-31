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

ANSWER_PROMPT = """당신은 환경·분리배출 관련 법령을 안내하는 상담 도우미입니다.
아래 [근거]에 제시된 조문 내용만 사용해서 한국어로 답변하세요.

작성 규칙
1. 근거에 없는 내용은 절대 추측하거나 지어내지 마세요.
2. 답변에는 반드시 근거가 된 법령명과 조문 번호를 "○○법 제N조" 형태로 밝히세요.
3. 근거만으로 답할 수 없으면 "관련 조문을 찾을 수 없습니다"라고만 답하세요.
4. 3~5문장으로 간결하게, 실제 행동으로 옮길 수 있게 설명하세요.

--- 예시 1 ---
[근거]
[근거 1 · 자원순환기본법 제3조]
제3조(정의) 이 법에서 "순환자원"이란 폐기물 중 환경적·경제적 가치가 있어 재사용·재생이용할 수 있는 것을 말한다.

[질문] 순환자원이 무엇인가요?
[답변] 자원순환기본법 제3조에 따르면 순환자원이란 폐기물 중 환경적·경제적 가치가 있어 재사용하거나 재생이용할 수 있는 것을 뜻합니다. 즉 버려지는 물건이라도 다시 쓸 수 있으면 순환자원으로 분류됩니다.

--- 예시 2 ---
[근거]
[근거 1 · 폐기물관리법 제8조]
제8조(폐기물의 투기 금지) 누구든지 지정된 장소가 아닌 곳에 폐기물을 버려서는 아니 된다.

[질문] 전기차 배터리는 어떻게 폐기하나요?
[답변] 관련 조문을 찾을 수 없습니다.

--- 실제 질문 ---
[근거]
{context}

[질문] {question}
[답변]"""


def answer_with_context(question: str, context: str) -> str:
    """검색된 조문만 근거로 질문에 답한다. (rag_service 가 호출)"""
    result = _generate(ANSWER_PROMPT.format(context=context, question=question))

    # LLM 을 쓸 수 없으면 검색 결과라도 보여준다 (서버가 죽지 않게)
    if result is None:
        return (
            "[LLM 미연결 · 검색된 조문 원문]\n"
            "GEMINI_API_KEY 설정 후 다시 질문하면 요약된 답변을 받을 수 있습니다.\n\n"
            f"{context}"
        )
    return result
