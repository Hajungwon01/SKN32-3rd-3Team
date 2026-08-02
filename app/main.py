"""
FastAPI 진입점.

app.routers.api 의 실제 인증/문서/요약 라우터를 등록하고,
그 아래에 app/static/ (프론트 빌드 산출물)을 서빙한다.
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
# 모델을 import 해야 Base.metadata에 테이블이 등록된다.
from app import models  # noqa: F401
from app.routers.api import router as api_router
from app.routers import rag
from app.routers import admin

BASE = Path(__file__).resolve().parent

app = FastAPI(title="Ecobot")

# 개발 편의용: 테이블이 없으면 만든다.
# (운영 전환 시에는 Alembic 같은 마이그레이션 도구로 교체할 것.)
Base.metadata.create_all(bind=engine)

# ─── API 를 먼저 등록한다 ────────────────────────────────────────────
# 아래 정적 마운트가 "/" 를 잡으므로, 순서가 바뀌면 /api 요청까지
# 정적 파일 처리기가 가로채서 404가 난다. 이 순서는 습관으로 지킬 것.

app.include_router(api_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"ok": True}


# app.include_router(api, prefix="/api")
app.include_router(rag.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

# ─── 정적 파일 ───────────────────────────────────────────────────────
# html=True 는 "/" 요청에 index.html 을 돌려준다.
# 나중에 클라이언트 라우터를 넣으면 알 수 없는 경로가 404가 되므로
# index.html 로 떨어뜨리는 catch-all 라우트가 추가로 필요해진다.

app.mount("/", StaticFiles(directory=BASE.parent / "static", html=True), name="static")
