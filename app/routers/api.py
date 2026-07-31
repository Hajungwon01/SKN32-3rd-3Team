from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Document, User
from app.schemas import (
    UserCreate,
    UserResponse,
    LoginRequest,
    AuthUser,
    DocumentCreate,
    DocumentUpdate,
    DocumentSummary,
    DocumentDetail,
    SummaryResponse,
    GeminiRequest,
)
from app.services import auth_service, document_service, gemini_service
from app.core.security import decode_access_token

router = APIRouter()

# 프론트와의 계약(frontend/README_guide.md): 인증은 세션 쿠키, JWT/Bearer 아님.
# 실제로는 여전히 JWT를 쓰지만, Authorization 헤더 대신 httpOnly 쿠키에 담아
# 발급/검증한다 — 프론트는 이 토큰의 존재를 전혀 몰라도 된다.
COOKIE_NAME = "access_token"


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        # 로컬 http 개발 환경 기준. https 배포 시 secure=True로 바꿀 것.
        secure=False,
        path="/",
    )


def _to_auth_user(user: User) -> AuthUser:
    return AuthUser(id=user.id, email=user.email, name=user.display_name)


def _to_document_summary(doc: Document) -> DocumentSummary:
    return DocumentSummary(
        id=doc.id,
        title=doc.title,
        parent_id=doc.parent_id,
        updated_at=doc.updated_at,
    )


def _to_document_detail(doc: Document) -> DocumentDetail:
    return DocumentDetail(
        id=doc.id,
        title=doc.title,
        parent_id=doc.parent_id,
        updated_at=doc.updated_at,
        content=document_service.deserialize_content(doc.content),
        content_text=doc.content_text or "",
    )


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없거나 비활성화되었습니다.")
    return user

# AUTH API
@router.post("/auth/register", response_model=UserResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    return auth_service.register_user(db, user_data)

@router.post("/auth/login", response_model=AuthUser)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user, access_token = auth_service.authenticate_user(db, body.email, body.password)
    _set_session_cookie(response, access_token)
    return _to_auth_user(user)

@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}

# 프론트(lib/api.ts)는 부팅 시 세션 확인을 "/me"로 호출한다 (auth/me 아님).
@router.get("/me", response_model=AuthUser)
def get_me(current_user: User = Depends(get_current_user)):
    return _to_auth_user(current_user)

# DOCUMENT API
@router.post("/documents", response_model=DocumentDetail)
def create_doc(doc_data: DocumentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = document_service.create_document(db, user, doc_data)
    return _to_document_detail(doc)

@router.get("/documents", response_model=List[DocumentSummary])
def list_docs(parent_id: Optional[int] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # 프론트(Sidebar)는 파라미터 없이 부르고, 전체 문서를 평평한 목록으로 기대한다
    # (트리 렌더링은 안 하고 parent_id로 들여쓰기만 함). parent_id를 명시적으로
    # 넘긴 경우에만 그 부모의 자식만 거른다 — 나중에 트리 UI가 붙을 여지를 남겨둔다.
    if parent_id is not None:
        docs = document_service.get_documents_by_parent(db, user, parent_id)
    else:
        docs = document_service.get_all_documents(db, user)
    return [_to_document_summary(d) for d in docs]

@router.get("/documents/tree")
def get_doc_tree(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return document_service.get_document_tree(db, user)

@router.get("/documents/{doc_id}", response_model=DocumentDetail)
def get_doc(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = document_service.get_document_by_id(db, user, doc_id)
    return _to_document_detail(doc)

@router.put("/documents/{doc_id}", response_model=DocumentDetail)
def update_doc(doc_id: int, doc_data: DocumentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = document_service.update_document(db, user, doc_id, doc_data)
    return _to_document_detail(doc)

@router.delete("/documents/{doc_id}", status_code=204)
def delete_doc(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    document_service.delete_document(db, user, doc_id)

@router.post("/documents/{doc_id}/summary", response_model=SummaryResponse)
def summarize_doc(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = document_service.get_document_by_id(db, user, doc_id)
    summary = gemini_service.generate_summary(doc.content_text or "")
    document_service.summarize_document(db, user, doc_id, summary)
    return {"summary": summary}

# GEMINI API
# 문서에 매이지 않은 임의 텍스트 요약용 (문서 단위 요약은 위 /documents/{id}/summary).
@router.post("/gemini/summarize")
def summarize_text(req: GeminiRequest, user: User = Depends(get_current_user)):
    summary = gemini_service.generate_summary(req.prompt)
    return {"summary": summary}