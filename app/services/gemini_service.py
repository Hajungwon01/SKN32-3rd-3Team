"""
LLM 연동 (Gemini / OpenAI 전환 가능).

- generate_summary(prompt) : 문서 요약
- answer_with_context(...)  : RAG 답변 생성

.env의 LLM_BACKEND 값으로 백엔드 전환:
  - "gemini" : Google Gemini API (기본)
  - "openai" : OpenAI API

    pip install google-genai openai
"""

from app.core.config import settings


# ─────────────────── 공통 호출부 ───────────────────


def _generate(prompt: str) -> str | None:
    """LLM_BACKEND에 따라 Gemini 또는 OpenAI를 호출한다."""
    backend = settings.LLM_BACKEND.lower()
    if backend == "openai":
        return _generate_openai(prompt)
    return _generate_gemini(prompt)


def _generate_gemini(prompt: str) -> str | None:
    """Gemini를 호출한다."""
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
    except Exception as exc:
        msg = str(exc).lower()
        if "429" in msg or "quota" in msg or "rate" in msg or "resource exhausted" in msg:
            print(f"[Gemini] API 할당량 초과: {exc}")
            return "__QUOTA_EXCEEDED__"
        print(f"[Gemini] 호출 실패: {exc}")
        return None


def _generate_openai(prompt: str) -> str | None:
    """OpenAI를 호출한다."""
    if not settings.OPENAI_API_KEY:
        return None

    try:
        from openai import OpenAI
    except ImportError:
        print("[OpenAI] openai 패키지가 설치되지 않았습니다.  pip install openai")
        return None

    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return (response.choices[0].message.content or "").strip() or None
    except Exception as exc:
        msg = str(exc).lower()
        if "429" in msg or "quota" in msg or "rate" in msg:
            print(f"[OpenAI] API 할당량 초과: {exc}")
            return "__QUOTA_EXCEEDED__"
        print(f"[OpenAI] 호출 실패: {exc}")
        return None


# ─────────────────── 요약 (기존) ───────────────────


def generate_summary(prompt: str) -> str:
    result = _generate(prompt)
    if result is None:
        return "(요약 기능 준비 중: GEMINI_API_KEY 를 설정하거나 google-genai 를 설치하세요)"
    return result


# ─────────────────── RAG 답변 (RAG 파트) ───────────────────

ANSWER_PROMPT = """당신은 환경·분리배출 관련 상담 도우미 'Ecobot' 입니다.
아래 [근거]에 제시된 문서 내용만 사용해서 한국어로 답변하세요.

반드시 아래 2개 섹션으로 나누어 답변하세요. 각 섹션은 정확히 해당 태그로 감싸세요.

<answer>가이드 문서와 법령 근거를 종합하여 질문에 대한 답변을 3~5문장으로 작성합니다. 가이드 내용(분리배출 방법, 지역 규정 등)과 법령 근거(법령명·조문 번호)가 있으면 자연스럽게 함께 서술하세요.</answer>
<tip>시민이 바로 실천할 수 있는 생활 팁을 1~2문장으로 알려줍니다.</tip>

작성 규칙
1. 근거에 없는 내용은 절대 추측하거나 지어내지 마세요.
2. 근거만으로 답할 수 없으면 "관련 정보를 찾을 수 없습니다."라고만 적으세요.
3. 태그 바깥에는 아무 텍스트도 쓰지 마세요.
4. [이전 대화]가 있다면 참고해서 자연스럽게 이어 답하되, 이전 대화 내용 자체를
   근거로 새로운 사실을 지어내지 마세요 (사실 판단은 항상 [근거]만 기준).

--- 예시 ---
[근거]
[근거 1 · [가이드]_환경부_공통_분리배출_기준]
페트병은 내용물을 비우고 라벨을 제거한 뒤 찌그러뜨려서 뚜껑을 닫아 배출합니다.

[질문] 페트병 라벨 꼭 떼야 해?
<answer>네, 페트병 라벨은 반드시 제거해야 합니다. 환경부 분리배출 기준에 따르면 내용물을 비우고 라벨을 떼어낸 뒤, 찌그러뜨려서 뚜껑을 닫아 배출해야 합니다.</answer>
<tip>라벨 절취선이 있으면 쉽게 뗄 수 있어요. 절취선이 없으면 가위로 한 번만 자르면 쉽게 벗겨집니다.</tip>

--- 실제 질문 ---
{history_block}[근거]
{context}

[질문] {question}
"""


import re

_SECTION_RE = re.compile(r"<(answer|tip)>(.*?)</\1>", re.DOTALL)


def _parse_sections(text: str) -> dict:
    """LLM 응답에서 <answer>, <tip> 섹션을 추출한다."""
    sections = {"answer": "", "tip": ""}
    for match in _SECTION_RE.finditer(text):
        sections[match.group(1)] = match.group(2).strip()
    return sections


def _format_history(history: list[dict] | None) -> str:
    """이전 대화를 프롬프트에 넣을 블록으로 변환. 없으면 빈 문자열(기존과 동일)."""
    if not history:
        return ""
    lines = [
        f"{'사용자' if turn.get('role') == 'user' else '챗봇'}: {turn.get('content', '')}"
        for turn in history
    ]
    return "[이전 대화]\n" + "\n".join(lines) + "\n\n"


def answer_with_context(question: str, context: str, history: list[dict] | None = None) -> dict:
    """검색된 문서를 근거로 2섹션 답변을 생성한다. (rag_service 가 호출)

    반환: {"answer": str, "tip": str}

    history: 최근 대화 목록. "대화 흐름 유지" 기능용으로 추가한 파라미터라
    안 넘기면(None) 기존과 완전히 동일하게 동작한다(하위 호환).
    """
    history_block = _format_history(history)
    prompt = ANSWER_PROMPT.format(history_block=history_block, context=context, question=question)
    result = _generate(prompt)

    if result == "__QUOTA_EXCEEDED__":
        return {
            "answer": "현재 API 사용량이 초과되었습니다. 잠시 후 다시 질문해 주세요.",
            "tip": "",
        }

    if result is None:
        backend = settings.LLM_BACKEND.lower()
        if backend == "openai":
            msg = "[LLM 미연결] OPENAI_API_KEY 설정 후 다시 질문하세요."
        else:
            msg = "[LLM 미연결] GEMINI_API_KEY 설정 후 다시 질문하세요."
        return {
            "answer": msg,
            "tip": "",
        }

    sections = _parse_sections(result)

    # 파싱 실패 시 전체 응답을 answer 에 넣는다
    if not any(sections.values()):
        sections["answer"] = result

    return sections