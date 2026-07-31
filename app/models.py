import enum
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from app.database import Base

class SourceType(str, enum.Enum):
    manual = "manual"
    meeting_transcript = "meeting_transcript"
    meeting_summary = "meeting_summary"
    law = "law"                  # 법령 원문 (공용 문서 · RAG 파트 추가)

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
    content = Column(Text, default="")
    # content의 평문 버전. 요약(gemini_service)·RAG 청킹이 파싱 없이 바로 읽는 필드.
    # 프론트가 저장할 때 항상 같이 보내주기로 합의된 필드 (frontend/README.md 계약).
    content_text = Column(Text, default="")
    summary = Column(Text, nullable=True)
    source_type = Column(SQLEnum(SourceType), default=SourceType.manual, nullable=False)
    parent_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    owner = relationship("User", back_populates="documents")
    children = relationship(
        "Document",
        backref=backref("parent", remote_side=[id]),
        cascade="all, delete-orphan",
    )