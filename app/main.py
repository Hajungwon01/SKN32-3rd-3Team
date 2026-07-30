"""
프론트 확인용 최소 서버.

A안과 B안에서 이 파일은 완전히 동일하다. app/static/ 에 손으로 쓴 소스가
들어있든 빌드 산출물이 들어있든 FastAPI 입장에서는 같은 파일 묶음이기 때문이다.

    uvicorn app.main:app --reload
    http://localhost:8000

A가 실제 라우터를 만들면 아래 include_router 자리에 넣는다.
"""

from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.staticfiles import StaticFiles

from app.routers import rag

BASE = Path(__file__).resolve().parent

app = FastAPI(title="팀 위키")

# ─── API 를 먼저 등록한다 ────────────────────────────────────────────
# 아래 정적 마운트가 "/" 를 잡으므로, 순서가 바뀌면 /api 요청까지
# 정적 파일 처리기가 가로채서 404가 난다. 이 순서는 습관으로 지킬 것.

api = APIRouter()


@api.get("/health")
def health():
    return {"ok": True}


app.include_router(api, prefix="/api")
app.include_router(rag.router, prefix="/api")

# ─── 정적 파일 ───────────────────────────────────────────────────────
# html=True 는 "/" 요청에 index.html 을 돌려준다.
# 나중에 클라이언트 라우터를 넣으면 알 수 없는 경로가 404가 되므로
# index.html 로 떨어뜨리는 catch-all 라우트가 추가로 필요해진다.

app.mount("/", StaticFiles(directory=BASE / "static", html=True), name="static")
