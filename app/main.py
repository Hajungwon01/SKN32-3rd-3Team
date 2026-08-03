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

# ─── 기존 테이블에 누락된 컬럼 추가 (간이 마이그레이션) ────────────────
with engine.connect() as conn:
    import sqlalchemy as _sa
    # chat_logs.cluster_id 컬럼 추가
    try:
        conn.execute(_sa.text("SELECT cluster_id FROM chat_logs LIMIT 1"))
    except Exception:
        try:
            conn.execute(_sa.text("ALTER TABLE chat_logs ADD COLUMN cluster_id INTEGER"))
            conn.commit()
            print("[DB] chat_logs.cluster_id 컬럼 추가 완료")
        except Exception as e:
            print(f"[DB] 컬럼 추가 실패: {e}")

# ─── 서버 시작 시 기존 질문 클러스터 마이그레이션 ──────────────────────
@app.on_event("startup")
def _migrate_clusters():
    """cluster_id가 없는 기존 ChatLog를 클러스터에 매칭한다."""
    from app.database import get_db
    from app.models import ChatLog, QuestionCluster
    db = next(get_db())
    try:
        orphans = db.query(ChatLog).filter(ChatLog.cluster_id == None).all()
        if not orphans:
            return
        print(f"[클러스터] 미매칭 질문 {len(orphans)}건 마이그레이션 시작")
        from app.routers.rag import _assign_cluster
        for log in orphans:
            try:
                cid = _assign_cluster(db, log.question)
                log.cluster_id = cid
            except Exception:
                pass
        db.commit()
        print(f"[클러스터] 마이그레이션 완료")
    except Exception as exc:
        print(f"[클러스터] 마이그레이션 실패: {exc}")
    finally:
        db.close()


# ─── 서버 시작 시 RAG 인덱스 자동 빌드 ─────────────────────────────────
@app.on_event("startup")
def _auto_rebuild_index():
    """인덱스가 없거나 임베딩 차원이 변경되었으면 자동 재빌드한다."""
    from app.services import vector_store_service, embedding_service, rag_service
    import faiss as _faiss

    idx_path = vector_store_service._index_path()
    need_rebuild = False

    if not vector_store_service.index_exists():
        need_rebuild = True
        print("[RAG] 인덱스가 없습니다. 자동 빌드를 시작합니다.")
    else:
        existing = _faiss.read_index(str(idx_path))
        expected_dim = embedding_service.get_dimension()
        if existing.d != expected_dim:
            need_rebuild = True
            print(f"[RAG] 인덱스 차원 불일치 ({existing.d} → {expected_dim}). 재빌드합니다.")

    if need_rebuild:
        try:
            result = rag_service.rebuild_index()
            print(f"[RAG] 자동 빌드 완료: {result}")
        except Exception as exc:
            print(f"[RAG] 자동 빌드 실패: {exc}")


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
