import enum
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from app.database import Base

# MySQL의 기본 TEXT 타입은 최대 65,535바이트(약 21,845자, 한글 기준)까지만
# 저장 가능하다. 법령 원문처럼 긴 문서는 이 한계를 쉽게 넘기고, 넘기면
# MariaDB/MySQL이 바이트 단위로 잘라내면서 멀티바이트 문자 중간을 끊어
# "Incorrect string value" 에러를 낸다 (내용은 정상인데도 발생).
# SQLite는 TEXT에 이런 크기 제한이 없어서 로컬 개발 중엔 발견되지 않는다.
# with_variant로 MySQL에서만 LONGTEXT(최대 4GB)를 쓰도록 지정.
# (자세한 재현 과정: docs/TROUBLESHOOTING_MYSQL.md)
LongText = Text().with_variant(LONGTEXT, "mysql")


class SourceType(str, enum.Enum):
    manual = "manual"
    meeting_transcript = "meeting_transcript"
    meeting_summary = "meeting_summary"
    law = "law"                  # 법령 원문 (공용 · RAG 파트 추가)
    guide = "guide"              # 기관 배출 가이드 (공용 · RAG 파트 추가)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    # 에디터 전용 원본(JSON을 문자열로 직렬화해서 저장). 백엔드는 내용을 몰라도 되고
    # 통째로 저장·반환만 한다 — 프론트(TipTap 등) 자유.
    content = Column(LongText, default="")
    # content의 평문 버전. 요약(gemini_service)·RAG 청킹이 파싱 없이 바로 읽는 필드.
    # 프론트가 저장할 때 항상 같이 보내주기로 합의된 필드 (frontend/README.md 계약).
    content_text = Column(LongText, default="")
    summary = Column(LongText, nullable=True)
    source_type = Column(SQLEnum(SourceType), default=SourceType.manual, nullable=False)
    # 외부 크롤링 문서(법령/가이드)의 원본 링크. RAG 답변에 "출처 보기" 링크로
    # 노출해서 신뢰도를 높이고, 환각 여부를 사용자가 직접 원문 대조로 검증할
    # 수 있게 한다. 수동 작성 문서(manual)는 원본 URL이 없으니 NULL.
    source_url = Column(String(500), nullable=True)
    # 이 문서가 적용되는 지역. NULL(또는 "common") = 전국 공통, 그 외
    # ("seoul", "cheonan", "busan_namgu" 등)는 그 지역에만 적용됨.
    # ⚠️ rag_service.py의 search()/_load_from_db()가 이 컬럼을 이미
    # 참조하고 있었는데(getattr로 방어 처리되어 있어 컬럼 없어도 안 죽음),
    # 컬럼 자체가 없어서 지역 필터링이 실질적으로 동작 안 하고 있었음 -
    # 이번에 컬럼을 추가해서 실제로 동작하게 함.
    region = Column(String(50), nullable=True, index=True)
    parent_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    owner = relationship("User", back_populates="documents")
    children = relationship(
        "Document",
        backref=backref("parent", remote_side=[id]),
        cascade="all, delete-orphan",
    )


class ChatLog(Base):
    """챗봇 질문 로그. 관리자 대시보드 통계용."""
    __tablename__ = "chat_logs"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    question = Column(Text, nullable=False)
    region = Column(String(50), nullable=False, default="seoul")
    has_answer = Column(Boolean, default=True)  # 근거 기반 답변 성공 여부
    created_at = Column(DateTime, server_default=func.now(), index=True)
    user = relationship("User")


class ChatMessage(Base):
    """
    챗봇 대화 기록 원문. "대화 기록 저장/복원 + 흐름 유지" 기능 담당.

    ChatLog(위)와는 목적이 다르다 - ChatLog는 "질문/지역/성공여부"만 남기는
    통계용 로그이고, 이 테이블은 질문·답변 텍스트 전체를 저장해서 화면에
    그대로 복원하고 다음 질문의 맥락으로 재사용하기 위한 것이다. 서로
    안 겹치니 두 테이블 다 유지한다.

    session_id: 프론트의 "새 대화" 버튼이 만드는 세션 값(Date.now() 기반,
    JS 타임스탬프라 32비트 정수 범위를 넘어서 String으로 받음)을 그대로
    저장한다. 이걸로 여러 대화방을 구분한다. 기존에 이 컬럼 없이 저장된
    row는 NULL로 남고, "레거시 대화" 하나로 묶어서 취급한다.

    region: 이 메시지를 보낼 때 화면의 지역 선택 드롭다운 값. 대화방을
    복원할 때 "이 대화방은 어느 지역으로 대화했었지"를 다시 보여주기
    위해 필요 - 없으면 새로고침할 때마다 드롭다운이 기본값(서울)으로
    리셋되는 버그가 생긴다 (실제로 겪었음).
    """
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(50), nullable=True, index=True)
    region = Column(String(50), nullable=True)
    role = Column(String(20), nullable=False)  # "user" | "assistant"
    content = Column(LongText, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    owner = relationship("User")