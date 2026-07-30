from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# 프로젝트 루트 경로 (app/core/config.py 기준 두 단계 위)
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # .env 파일에서 자동으로 매핑되어 채워지는 변수들
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 기본값 1일 (분 단위)
    GEMINI_API_KEY: str = ""

    # .env 파일을 최우선으로 읽어오도록 설정
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"  # .env에 클래스 정의 외의 추가 변수가 있어도 무시
    )

    # ═══════════════ RAG 설정 (여기부터 추가) ═══════════════
    # 인덱싱할 문서 출처: "db"(MySQL documents 테이블) / "files"(data/docs 폴더)
    RAG_SOURCE: str = "db"

    # 청킹: 한 청크의 최대 문자 수 / 인접 청크 간 겹침 문자 수
    CHUNK_SIZE: int = 700
    CHUNK_OVERLAP: int = 100

    # 검색: 기본으로 가져올 유사 청크 개수
    RAG_TOP_K: int = 4

    # 임베딩 백엔드: "local"(API 키 불필요, 개발용) 또는 "gemini"(실서비스)
    EMBEDDING_BACKEND: str = "local"

    # local 임베딩 벡터 차원
    LOCAL_EMBEDDING_DIMENSION: int = 384

    # gemini 임베딩 모델명과 차원
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    GEMINI_EMBEDDING_DIMENSION: int = 768

    # Gemini API 키 (팀 config에 이미 있다면 이 줄은 생략)
    GEMINI_API_KEY: str = ""

    # FAISS 인덱스 + 청크 JSON 저장 디렉터리
    INDEX_DIR: Path = BASE_DIR / "data" / "indexes"

    # (개발 단계 전용) MySQL 연결 전 문서를 읽어올 임시 폴더
    DOCS_DIR: Path = BASE_DIR / "data" / "docs"

    # ═══════════════ RAG 설정 (여기까지) ═══════════════

settings = Settings()