from datetime import datetime
from typing import Optional, List, Literal, Any
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    display_name: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthUser(BaseModel):
    """프론트 types/api.ts의 User와 맞춘 응답 (id, email, name)."""
    id: int
    email: EmailStr
    name: str
    isAdmin: bool = False

class DocumentSaveRequest(BaseModel):
    """생성/저장 둘 다 같은 모양. frontend/src/types/api.ts의 DocumentSaveRequest와 동일하게 맞췄다."""
    title: str
    # 에디터 전용 원본. 백엔드는 파싱하지 않고 JSON으로 그대로 저장·반환만 한다.
    content: Any = None
    # content의 평문 버전. 요약/RAG가 읽는 필드라 항상 같이 온다는 전제.
    content_text: Optional[str] = ""
    parent_id: Optional[int] = None

class DocumentCreate(DocumentSaveRequest):
    pass

class DocumentUpdate(DocumentSaveRequest):
    pass

class DocumentSummary(BaseModel):
    """목록에서 쓰는 가벼운 형태. frontend DocumentSummary와 동일 — 본문은 안 들어간다."""
    id: int
    title: str
    parent_id: Optional[int]
    updated_at: datetime

class DocumentDetail(DocumentSummary):
    """단건 조회/생성/저장 응답. frontend DocumentDetail과 동일."""
    content: Any = None
    content_text: str = ""

class DocumentResponse(BaseModel):
    id: int
    owner_id: int
    title: str
    content: str
    summary: Optional[str]
    source_type: str
    parent_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DocumentTreeNode(DocumentResponse):
    children: List["DocumentTreeNode"] = []

DocumentTreeNode.model_rebuild()

class SummaryResponse(BaseModel):
    summary: str

class GeminiRequest(BaseModel):
    prompt: str