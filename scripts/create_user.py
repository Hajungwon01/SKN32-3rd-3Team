# path : scripts/create_user.py
"""
[RAG 파트] 계정을 만든다.

프론트에 회원가입 화면이 없어서, 로그인할 계정을 터미널에서 만들기 위한 도구다.

    python -m scripts.create_user                              # 기본 데모 계정
    python -m scripts.create_user hong@test.com 1234 홍길동     # 직접 지정

이미 있는 이메일이면 비밀번호를 바꾼다.
(회원가입 화면이 생기면 이 스크립트는 필요 없어진다.)
"""

from __future__ import annotations

import sys

from app.database import Base, SessionLocal, engine
from app.models import User


def get_hasher():
    """팀 구현에 따라 해시 함수 이름이 다를 수 있으므로 모듈에서 찾아 쓴다."""
    from app.core import security

    hasher = getattr(security, "get_password_hash", None) or getattr(
        security, "hash_password", None
    )
    if hasher is None:
        print("[오류] app/core/security.py 에서 비밀번호 해시 함수를 찾지 못했습니다.")
        sys.exit(1)
    return hasher


def main() -> None:
    email = sys.argv[1] if len(sys.argv) > 1 else "demo@example.com"
    password = sys.argv[2] if len(sys.argv) > 2 else "demo1234"
    name = sys.argv[3] if len(sys.argv) > 3 else "데모 사용자"

    Base.metadata.create_all(bind=engine)
    hasher = get_hasher()

    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()

        if user:
            user.hashed_password = hasher(password)
            db.commit()
            print(f"비밀번호를 변경했습니다: {email}")
        else:
            user = User(
                email=email,
                hashed_password=hasher(password),
                display_name=name,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"계정을 만들었습니다: {email} (id={user.id})")

    print(f"  이메일   : {email}")
    print(f"  비밀번호 : {password}")


if __name__ == "__main__":
    main()
