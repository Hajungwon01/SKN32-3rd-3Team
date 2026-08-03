from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings


def _build_engine():
    """
    settings.DATABASE_URL을 그대로 쓰지 않고, MySQL이면 두 가지를 자동 처리한다.

    1) charset을 utf8mb4로 강제한다. .env에 ?charset=utf8mb4를 깜빡 안
       적어도 항상 올바른 인코딩으로 접속된다. (커넥션이 latin1로 잡히면
       한글이 저장 단계에서 깨짐 - docs/TROUBLESHOOTING_MYSQL.md)
    2) 대상 데이터베이스가 없으면 자동으로 만든다.

    단, MySQL 계정(app_user) 자체는 여기서 만들지 않는다. root를
    파이썬 드라이버(pymysql)로 접속해서 대신 만들어주는 방식도
    시도해봤지만, MySQL/MariaDB 환경에 따라 root 인증 방식이 달라서
    (예: 로컬은 유닉스 소켓 인증이라 TCP 접속 자체가 막히는 경우)
    사람마다 되고 안 되고가 갈리는 신뢰할 수 없는 방법이라 포기했다.
    계정 생성은 아래 SQL을 최초 1회, 사람이 직접 실행해야 한다:

        CREATE USER IF NOT EXISTS 'app_user'@'localhost' IDENTIFIED BY '비밀번호';
        GRANT ALL PRIVILEGES ON ecora.* TO 'app_user'@'localhost';
        GRANT CREATE ON *.* TO 'app_user'@'localhost';
        FLUSH PRIVILEGES;

    SQLite면 아무것도 안 하고 그대로 둔다.
    """
    url = make_url(settings.DATABASE_URL)

    if url.get_backend_name() == "mysql":
        query = dict(url.query)
        query["charset"] = "utf8mb4"
        url = url.set(query=query)

        db_name = url.database
        server_url = url.set(database="")
        bootstrap_engine = create_engine(server_url)
        try:
            with bootstrap_engine.connect() as conn:
                conn.execute(text(
                    f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                ))
                conn.commit()
        finally:
            bootstrap_engine.dispose()

    return create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=3600,
    )


engine = _build_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()