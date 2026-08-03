# path : app/services/chat_history_service.py
"""
[LangChain 도입 5단계 - 하정원]

app/routers/rag.py의 ChatMessage 저장/조회(_load_recent_history 등)는
전혀 안 건드렸다 - 이 파일은 그 위에 병행으로 얹는 LangChain 어댑터다.
지금 당장 아무도 이 파일을 안 부르므로 위험 없음.

build_chat_history()가 반환하는 객체는 LangChain의
langchain_core.chat_history.BaseChatMessageHistory 인터페이스를 구현한다.
RAG 담당이 나중에 RunnableWithMessageHistory 같은 체인에 이 객체를
그대로 꽂아 쓸 수 있다 (사용 예는 파일 하단 주석 참고).

같은 ChatMessage 테이블(session_id/region/tip/sources 포함)을 그대로
읽고 쓰므로, app/routers/rag.py의 기존 저장 방식과 완전히 호환된다 -
LangChain 체인으로 저장한 대화도 지금 화면의 "대화 기록 복원"
(GET /api/chat/sessions)에 그대로 나타난다.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from langchain_core.chat_history import BaseChatMessageHistory


def build_chat_history(owner_id: int, session_id: str | None, db) -> "BaseChatMessageHistory":
    """owner_id + session_id로 스코프된 LangChain 호환 대화 기록 객체를 만든다.

    db: 호출부(FastAPI 라우터)의 SQLAlchemy Session을 그대로 받는다 -
    이 함수가 세션을 새로 열지 않는 이유는, 한 요청 안에서 라우터가 이미
    쓰고 있는 세션과 같은 트랜잭션을 공유해야 커밋 시점이 꼬이지 않기
    때문이다 (rag_service.py의 own_session 패턴과는 다른 이유로, 여기는
    항상 요청 스코프의 세션을 받는 걸 전제로 한다).
    """
    from langchain_core.chat_history import BaseChatMessageHistory
    from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

    from app.models import ChatMessage

    class _ChatMessageHistory(BaseChatMessageHistory):
        @property
        def messages(self) -> list[BaseMessage]:
            rows = (
                db.query(ChatMessage)
                .filter(ChatMessage.owner_id == owner_id, ChatMessage.session_id == session_id)
                .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
                .all()
            )
            result: list[BaseMessage] = []
            for r in rows:
                if r.role == "user":
                    result.append(HumanMessage(content=r.content))
                else:
                    result.append(AIMessage(content=r.content))
            return result

        def add_message(self, message: BaseMessage) -> None:
            role = "user" if isinstance(message, HumanMessage) else "assistant"
            db.add(ChatMessage(
                owner_id=owner_id,
                session_id=session_id,
                role=role,
                content=message.content,
            ))
            db.commit()

        def clear(self) -> None:
            db.query(ChatMessage).filter(
                ChatMessage.owner_id == owner_id,
                ChatMessage.session_id == session_id,
            ).delete()
            db.commit()

    return _ChatMessageHistory()


# ─────────────────── 사용 예 (RAG 담당이 나중에 체인에 연결할 때) ───────────────────
#
#   from app.services.chat_history_service import build_chat_history
#
#   history = build_chat_history(owner_id=user.id, session_id=req.session_id, db=db)
#   chain_with_history = RunnableWithMessageHistory(
#       chain, lambda session_id: history, ...
#   )
#
# 지금 app/routers/rag.py의 chat()이 하는 일(질문 저장 → history 조회 →
# rag_service.ask() 호출 → 답변 저장)을 RunnableWithMessageHistory가
# 대신 처리하게 바꾸는 건 다음 단계로 남겨둔다 - ask()가 아직 순수
# 함수형이라, 지금 굳이 안 바꿔도 동작에 문제없다.