# path : scripts/seed_laws.py
"""
[RAG 파트] 법령 텍스트를 documents 테이블에 적재하고 인덱스를 만든다.

    python -m scripts.seed_laws

동작
  1. 시스템 계정(system@local)이 없으면 만든다 — documents.owner_id 가 NOT NULL 이라 필요
  2. data/laws/*.{txt,md,pdf} 를 읽어 source_type="law" 로 저장 (같은 제목이면 갱신)
  3. 벡터 인덱스를 재생성한다

파일명이 그대로 문서 제목이 된다. 예) `자원순환기본법.pdf` → "자원순환기본법"
지원 형식: .txt / .md / .pdf (PDF는 머리말·페이지번호를 자동 제거)
답변에서 "자원순환기본법 제3조에 따르면…" 처럼 인용되므로 정식 법령명을 쓸 것.
"""

from __future__ import annotations

import sys

from app.core.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Document, SourceType, User
from app.services import rag_service
from scripts.law_text import count_articles, read_law_file

SYSTEM_EMAIL = "system@local"
SYSTEM_PASSWORD = "seed-only-change-me"

# 프론트에 회원가입 화면이 없어서 로그인용 데모 계정을 함께 만든다.
# LoginScreen 의 기본 입력값과 같은 이메일이라 비밀번호만 치면 로그인된다.
DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo1234"

SUPPORTED = (".txt", ".md", ".pdf")

# 폴더 안내문 등 법령이 아닌 파일은 제외한다
IGNORED_STEMS = {"readme", "read_me", "notes", "메모"}


def _get_hasher():
    """팀 구현에 따라 해시 함수 이름이 다를 수 있으므로 모듈에서 찾아 쓴다."""
    from app.core import security

    hasher = getattr(security, "get_password_hash", None) or getattr(
        security, "hash_password", None
    )
    if hasher is None:
        print("[오류] app/core/security.py 에서 비밀번호 해시 함수를 찾지 못했습니다.")
        print("       사용 가능한 이름:", [n for n in dir(security) if "pass" in n.lower()])
        sys.exit(1)
    return hasher


def get_or_create_user(db, email: str, password: str, display_name: str) -> User:
    """계정이 없으면 만들고, 있으면 그대로 돌려준다."""
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user

    user = User(
        email=email,
        hashed_password=_get_hasher()(password),
        display_name=display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"  계정 생성: {email} (id={user.id})")
    return user


def get_or_create_system_user(db) -> User:
    """법령 문서의 소유자로 쓸 시스템 계정을 확보한다."""
    return get_or_create_user(db, SYSTEM_EMAIL, SYSTEM_PASSWORD, "시스템")


def load_law_files() -> list[tuple[str, str]]:
    """data/laws 의 txt·md·pdf 를 (제목, 정제 본문) 목록으로 읽는다.

    PDF는 머리말·꼬리말·페이지번호를 제거하고 줄바꿈을 정리한 뒤 반환한다.
    조문이 하나도 인식되지 않으면 경고한다 — 추출이 잘못됐을 가능성이 높다.
    """
    laws_dir = settings.LAWS_DIR
    laws_dir.mkdir(parents=True, exist_ok=True)

    items: list[tuple[str, str]] = []

    for path in sorted(laws_dir.iterdir()):
        if not (path.is_file() and path.suffix.lower() in SUPPORTED):
            continue
        if path.stem.lower() in IGNORED_STEMS or path.stem.startswith("_"):
            continue

        try:
            text = read_law_file(path)
        except Exception as exc:
            print(f"  [건너뜀] {path.name}: {exc}")
            continue

        if not text.strip():
            print(f"  [건너뜀] 내용이 비어 있습니다: {path.name}")
            continue

        articles = count_articles(text)
        if articles == 0:
            print(f"  [경고] {path.name}: 조문(제N조)을 찾지 못했습니다.")
            print("         일반 문자 단위로 분할되어 조문 인용이 어려울 수 있습니다.")
        else:
            print(f"  읽음: {path.name} — 조문 {articles}개, {len(text):,}자")

        items.append((path.stem, text))

    return items


def main() -> None:
    Base.metadata.create_all(bind=engine)

    print("[1/3] 법령 파일 읽기")
    laws = load_law_files()
    if not laws:
        print(f"[중단] {settings.LAWS_DIR} 에 법령 파일이 없습니다. (txt·md·pdf)")
        print("       국가법령정보센터에서 조문을 복사해 저장한 뒤 다시 실행하세요.")
        return

    with SessionLocal() as db:
        print("\n[2/3] 계정 확인 및 DB 적재")
        owner = get_or_create_system_user(db)
        get_or_create_user(db, DEMO_EMAIL, DEMO_PASSWORD, "데모 사용자")

        for title, content in laws:
            doc = (
                db.query(Document)
                .filter(Document.title == title, Document.owner_id == owner.id)
                .first()
            )

            if doc:
                doc.content = content
                doc.content_text = content
                doc.source_type = SourceType.law
                action = "갱신"
            else:
                db.add(
                    Document(
                        owner_id=owner.id,
                        title=title,
                        content=content,
                        content_text=content,
                        source_type=SourceType.law,
                    )
                )
                action = "추가"

            print(f"  {action}: {title}")

        db.commit()

    print("\n[3/3] 인덱스 재생성")
    result = rag_service.rebuild_index()
    print(f"문서 {result['documents']}개 → 청크 {result['indexed_chunks']}개")
    print(f"임베딩 백엔드: {result['embedding_backend']}")

    if result["indexed_chunks"] == 0:
        print("\n[경고] 청크가 0개입니다. .env 의 RAG_SOURCE 가 db 인지 확인하세요.")

    print("\n" + "─" * 50)
    print("로그인 계정 (프론트에 회원가입 화면이 없어 시드로 생성)")
    print(f"  이메일   : {DEMO_EMAIL}")
    print(f"  비밀번호 : {DEMO_PASSWORD}")
    print("─" * 50)


if __name__ == "__main__":
    main()
