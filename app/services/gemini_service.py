"""
Gemini 연동 스텁.

TODO: google-generativeai 붙여서 settings.GEMINI_API_KEY로 실제 호출.
지금은 app/routers/api.py의 import가 깨지지 않도록, 그리고 /api/gemini/summarize가
500 대신 알아볼 수 있는 응답을 주도록 자리만 채워둔다.
"""

from app.core.config import settings


def generate_summary(prompt: str) -> str:
    if not settings.GEMINI_API_KEY:
        return "(요약 기능 준비 중: GEMINI_API_KEY가 설정되지 않았습니다)"
    # TODO: 실제 Gemini API 호출로 교체
    return f"(요약 기능 준비 중) 입력 길이 {len(prompt)}자"
