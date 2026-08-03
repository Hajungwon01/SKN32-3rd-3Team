# path : app/services/rag_service.py
"""
[RAG 파트] 청킹·임베딩·벡터 검색·답변 생성을 조합하는 오케스트레이터.

  - rebuild_index() : 문서 전체 → 청킹 → 임베딩 → FAISS 재구축
  - search()        : 질문과 유사한 청크 검색 (소유자 필터 + 유사도 임계값)
  - ask()           : 검색 결과를 근거로 답변 + 출처 반환

문서 출처는 .env 의 RAG_SOURCE 로 전환한다.
  - "db"    : documents 테이블 (기본)
  - "files" : data/docs 폴더의 txt/md/pdf (DB 없이 단독 테스트용)

공용 문서:
  법령(source_type="law")은 소유자와 무관하게 모든 사용자가 검색할 수 있다.
  개인 문서는 본인 것만 검색된다.

[대화 기록/흐름 유지 기능 - 하정원]
ask()에 history 파라미터를 추가했다 (기존 서명·반환 형식은 그대로 유지).
history=None이면 기존과 완전히 동일하게 동작한다.
⚠️ 이 파일의 guide/law/tip 구조화(_generate_answer의 반환 형식)가 아직
   진행 중인 것 같다 - docstring은 {"guide","law","tip"}인데 실제 fallback은
   {"answer","tip"}을 반환하고 ask()는 sections.get("answer")를 씀. 어느 쪽이
   최종 형태인지 확인 필요 (내일 논의). history 연결은 어느 쪽이 되든
   깨지지 않게 방어적으로 짜뒀다.
"""

from __future__ import annotations

import re
from pathlib import Path

from app.core.config import settings
from app.services import chunk_service, embedding_service, vector_store_service

# 소유자와 무관하게 전체 공개되는 문서 유형 (수집한 공공자료)
PUBLIC_SOURCE_TYPES = ("law", "guide")

# 프론트에 돌려줄 근거 미리보기 길이
SNIPPET_LENGTH = 140

# 근거가 없을 때 쓰는 문구. 프롬프트의 지시문과 같은 표현을 쓴다.
NO_ANSWER = "관련 자료를 찾을 수 없습니다"


def _effective_min_score(min_score: float | None) -> float:
    """유사도 임계값을 결정한다.

    백엔드마다 점수 스케일이 다르므로 같은 임계값을 쓸 수 없다.
      - hash   : 표면 문자열 일치만 잡아 0.05~0.15 수준 → 전용 임계값 사용
      - local  : sentence-transformers. 의미 기반이라 점수대가 높다
      - gemini : 0.3~0.7 수준
      - openai : 0.2~0.6 수준

    hash 를 제외한 나머지는 RAG_MIN_SCORE 를 쓰되,
    **백엔드를 바꾸면 scripts/measure_threshold.py 로 재측정해야 한다.**
    (모델마다 유사도 분포가 달라 같은 값이 맞지 않는다)
    """
    if min_score is not None:
        return min_score
    if settings.EMBEDDING_BACKEND.lower() == "hash":
        return settings.RAG_MIN_SCORE_LOCAL
    return settings.RAG_MIN_SCORE


# ─────────────────── 공개 API ───────────────────


def rebuild_index(db=None) -> dict:
    """문서 전체를 다시 인덱싱한다.

    전체 재구축 방식을 쓰는 이유:
      문서 수정·삭제 시 FAISS 와의 동기화 문제를 피하는 가장 단순한 방법이다.
      문서량이 적은 초기 단계에서는 몇 초면 끝나므로 증분 갱신은 추후 과제로 둔다.
    """
    documents = _load_documents(db)
    chunks = chunk_service.build_chunks(documents)

    vectors = embedding_service.embed_documents([c["content"] for c in chunks])
    count = vector_store_service.rebuild(
        chunks, vectors, embedding_service.get_dimension()
    )

    return {
        "documents": len(documents),
        "indexed_chunks": count,
        "source": settings.RAG_SOURCE,
        "embedding_backend": settings.EMBEDDING_BACKEND,
    }


def search(
    query: str,
    top_k: int | None = None,
    owner_id: int | None = None,
    min_score: float | None = None,
    region: str | None = None,
    balanced: bool = False,
) -> list[dict]:
    """질문과 유사한 청크를 점수 순으로 반환한다.

    owner_id 를 넘기면 "본인 문서 + 공용 법령"만 남긴다.
    region 을 넘기면 "해당 지역 + common(공통)" 문서만 남긴다.
    min_score 미만인 결과는 근거로 삼기에 부족하다고 보고 제외한다.

    balanced=True 면 문서 종류별 자리를 배분한다. (답변 생성용)
    이때 개수는 top_k 가 아니라 RAG_TOP_K_GUIDE + RAG_TOP_K_LAW 로 정해진다.
    balanced=False 면 순수 유사도 순으로 top_k 개를 반환한다. (검색 품질 진단용)
    """
    top_k = top_k or settings.RAG_TOP_K
    min_score = _effective_min_score(min_score)

    query_vector = embedding_service.embed_query(query)

    # 소유자·지역·종류 필터를 거친 뒤에도 개수를 채우려면 넉넉히 가져와야 한다.
    fetch_k = max(
        top_k,
        settings.RAG_TOP_K_REGION
        + settings.RAG_TOP_K_COMMON
        + settings.RAG_TOP_K_LAW,
    ) * 25
    results = vector_store_service.search(query_vector, fetch_k)

    if owner_id is not None:
        results = [
            r for r in results
            if r.get("owner_id") == owner_id
            or r.get("source_type") in PUBLIC_SOURCE_TYPES
        ]

    # 지역 필터: 해당 지역 + 전국 공통 문서만 남긴다.
    # region 이 None 인 청크는 전국 공통으로 간주한다.
    # (예전 인덱스나 region 컬럼이 비어 있는 문서를 통째로 잃지 않기 위함)
    if region:
        results = [
            r for r in results
            if r.get("region") in (region, "common", None)
        ]

    # 유사도 임계값 (환각 방지 1차 장치)
    results = [r for r in results if r.get("score", 0.0) >= min_score]

    if balanced:
        return _apply_quota(results, region)

    return results[:top_k]


def _apply_quota(results: list[dict], region: str | None = None) -> list[dict]:
    """문서 종류별 자리를 배분해 지역·공통·법령이 함께 잡히도록 한다.

    자리를 나누는 이유
      법령은 조문 수가 많아(수백 개) 청크 비중에서 가이드를 압도한다.
      또 전국 공통 가이드(에너지·탄소중립·일회용품 등)가 늘어나면
      가이드 자리를 공통이 모두 차지해 정작 필요한 지역 문서가 밀려난다.
      실제로 "쓰레기 몇 시에 내놔요?" 질문에서 부산 배출시간 청크가
      검색 결과에 들어오지 못하는 문제가 있었다.

    그래서 지역 전용 / 전국 공통 / 법령에 각각 자리를 보장한다.
    한 그룹이 자리를 못 채우면 남은 자리는 다른 그룹으로 넘겨 낭비하지 않는다.

    region 이 없으면(전체 검색) 지역 구분이 무의미하므로
    가이드 전체를 하나로 묶어 배분한다.
    """
    law_quota = settings.RAG_TOP_K_LAW
    if law_quota <= 0 and settings.RAG_TOP_K_REGION <= 0:
        return results

    laws = [r for r in results if r.get("source_type") == "law"]
    guides = [r for r in results if r.get("source_type") != "law"]

    if region:
        region_quota = settings.RAG_TOP_K_REGION
        common_quota = settings.RAG_TOP_K_COMMON

        # 선택한 지역 전용 문서와 전국 공통 문서를 나눈다
        local = [r for r in guides if r.get("region") == region]
        common = [r for r in guides if r.get("region") != region]

        picked = local[:region_quota] + common[:common_quota] + laws[:law_quota]
        total = region_quota + common_quota + law_quota
    else:
        guide_quota = settings.RAG_TOP_K_GUIDE
        picked = guides[:guide_quota] + laws[:law_quota]
        total = guide_quota + law_quota

    # 남은 자리를 다른 그룹에서 채운다
    if len(picked) < total:
        chosen = {id(r) for r in picked}
        picked += [r for r in results if id(r) not in chosen][: total - len(picked)]

    # 중요한 근거가 앞에 오도록 점수 순으로 정렬해 반환
    return sorted(picked, key=lambda r: r.get("score", 0.0), reverse=True)


def ask(
    question: str,
    top_k: int | None = None,
    owner_id: int | None = None,
    region: str | None = None,
    history: list[dict] | None = None,
) -> dict:
    """검색된 문맥을 근거로 3섹션 답변을 생성한다.

    반환 형식:
        {"guide": str, "law": str, "tip": str, "source": str,
         "sources": [{"document_id": int, "title": str, "snippet": str}, ...]}

    history: [{"role": "user"|"assistant", "content": str}, ...] (오래된 순).
        "대화 흐름 유지" 기능용 - None이면 기존과 완전히 동일하게 동작.
    """
    results = search(question, top_k, owner_id, region=region, balanced=True)

    # 근거가 없으면 LLM을 호출하지 않는다. (환각 방지)
    if not results:
        return {
            "answer": "관련 문서를 찾을 수 없습니다. 질문을 조금 더 구체적으로 바꿔 보세요.",
            "tip": "",
            "source": "",
            "sources": [],
            "contexts": [],
        }

    sections = _generate_answer(question, _build_context(results), history)
    source_list = _build_sources(results)

    return {
        "answer": sections.get("answer", "") or sections.get("guide", ""),
        "law": sections.get("law", ""),
        "tip": sections.get("tip", ""),
        "source": ", ".join(dict.fromkeys(s["title"] for s in source_list)),
        "sources": source_list,
        # RAGAS 평가용 원문 청크.
        # 라우터의 ChatResponse 가 걸러내므로 프론트 응답에는 포함되지 않는다.
        "contexts": [r["content"] for r in results],
    }


# ─────────────────── 컨텍스트·출처 조립 ───────────────────


def _build_context(results: list[dict]) -> str:
    """검색된 청크를 LLM에 넘길 하나의 문자열로 조립한다.

    가이드와 법령을 나눠서 넘긴다. 그래야 LLM이
    "실천 방법(가이드) + 법적 근거(법령)" 두 층으로 답할 수 있다.

        ### 배출 가이드
        [[서울시] 분리배출 요령 품목별 분리배출 요령 > 종이류]
        ...본문...

        ### 관련 법령
        [자원순환기본법 제15조]
        ...본문...
    """
    guides: list[str] = []
    laws: list[str] = []

    for item in results:
        block = f"[{item.get('title', '제목 없음')}]\n{item['content']}"
        (laws if item.get("source_type") == "law" else guides).append(block)

    parts: list[str] = []
    if guides:
        parts.append("### 배출 가이드\n" + "\n\n".join(guides))
    if laws:
        parts.append("### 관련 법령\n" + "\n\n".join(laws))

    return "\n\n".join(parts)


# 문서 분류용 접두사만 제거 대상. 지역명 대괄호는 남겨야 한다.
_TAG_PREFIX = re.compile(r"^\[(가이드|법령|샘플)\]_?\s*")


def _clean_title(raw_title: str) -> str:
    """파일명 형태의 제목을 사람이 읽기 좋은 형태로 정리한다.

    예) [가이드]_환경부_공통_분리배출_기준 → 환경부 공통 분리배출 기준
        폐기물관리법_시행규칙              → 폐기물관리법 시행규칙

    주의: "[서울시] 분리배출 요령" 처럼 대괄호에 지역명이 담긴 제목은
    그대로 둔다. 지우면 답변 출처에서 어느 지역 기준인지 알 수 없게 되고,
    평가에서도 어느 지역 문서가 검색됐는지 판별할 수 없다.
    """
    title = _TAG_PREFIX.sub("", raw_title)   # [가이드]_ 등 분류 접두사만 제거
    title = title.replace("_", " ")          # 언더스코어 → 공백
    return title.strip() or raw_title


def _build_sources(results: list[dict]) -> list[dict]:
    """검색 결과를 프론트 ChatSource 형식으로 변환한다."""
    sources: list[dict] = []
    seen: set = set()

    for item in results:
        cleaned = _clean_title(item.get("title", "제목 없음"))
        if cleaned in seen:
            continue
        seen.add(cleaned)

        snippet = " ".join(item["content"].split())
        if len(snippet) > SNIPPET_LENGTH:
            snippet = snippet[:SNIPPET_LENGTH] + "…"

        sources.append(
            {
                "document_id": item.get("document_id"),
                "title": _clean_title(item.get("title", "제목 없음")),
                "snippet": snippet,
            }
        )

    return sources


# ─────────────────── 문서 공급 ───────────────────


def _load_documents(db=None) -> list[dict]:
    """인덱싱 대상 문서를 [{"id","owner_id","title","content","source_type"}, ...] 로 반환."""
    if settings.RAG_SOURCE.lower() == "files":
        return _load_from_files()
    return _load_from_db(db)


def _load_from_db(db=None) -> list[dict]:
    """documents 테이블에서 문서를 읽는다. (RAG_SOURCE=db)"""
    from app.database import SessionLocal
    from app.models import Document

    own_session = db is None
    session = db or SessionLocal()

    try:
        documents: list[dict] = []

        for row in session.query(Document).all():
            candidates = [
                getattr(row, "content_text", None),
                row.content,
                row.summary,
            ]
            parts: list[str] = []
            for candidate in candidates:
                if not (isinstance(candidate, str) and candidate.strip()):
                    continue
                if candidate not in parts:
                    parts.append(candidate)

            if not parts:
                continue

            source_type = row.source_type
            source_type = getattr(source_type, "value", source_type)

            documents.append(
                {
                    "id": row.id,
                    "owner_id": row.owner_id,
                    "title": row.title,
                    "content": parts[0] if source_type == "law" else "\n\n".join(parts),
                    "source_type": source_type,
                    # 하정원 쪽 seed_docs.py는 region을 "지역: xxx" 줄에서
                    # 읽어 None/문자열로 저장한다. 이 파일의 _extract_region()은
                    # 파일명 기준으로 "common" 문자열을 쓰는 등 방식이 서로
                    # 달라서, 실제 documents.region 컬럼 값을 그대로 전달한다
                    # (getattr로 방어 - region 컬럼이 없는 이전 상태에서도 안 죽게).
                    "region": getattr(row, "region", None),
                }
            )

        if not documents:
            print("[RAG] documents 테이블에 인덱싱할 문서가 없습니다.")

        return documents
    finally:
        if own_session:
            session.close()


def _extract_region(filename: str) -> str:
    """파일명에서 지역 코드를 추출한다."""
    REGION_MAP = {
        "서울": "seoul",
        "천안": "cheonan",
        "부산남구": "busan_namgu",
        "부산": "busan_namgu",
        "세종": "sejong",
        "인천미추홀구": "incheon_michuhol",
        "미추홀": "incheon_michuhol",
        "제주": "jeju",
        "공통": "common",
        "환경부": "common",
    }
    for keyword, code in REGION_MAP.items():
        if keyword in filename:
            return code
    return "common"


def _load_from_files() -> list[dict]:
    """data/guide + data/docs 폴더에서 문서를 읽는다. (RAG_SOURCE=files, DB 없이 테스트용)

    settings.GUIDE_DIR / settings.DOCS_DIR / settings.LAWS_DIR 를 참조한다.
    """
    supported = {".txt", ".md", ".pdf"}
    documents: list[dict] = []

    search_dirs = [settings.GUIDE_DIR, settings.DOCS_DIR, settings.LAWS_DIR]

    doc_id = 0
    for folder in search_dirs:
        folder.mkdir(parents=True, exist_ok=True)
        for path in sorted(folder.iterdir()):
            if not (path.is_file() and path.suffix.lower() in supported):
                continue

            text = _read_file(path)
            if not text.strip():
                print(f"[RAG] 텍스트를 추출하지 못했습니다: {path.name} (스캔 PDF면 OCR 필요)")
                continue

            doc_id += 1
            stem = path.stem

            # 폴더 기반 source_type 자동 태깅
            if folder == settings.LAWS_DIR or stem.startswith("[법령]"):
                source_type = "law"
            elif folder == settings.GUIDE_DIR or stem.startswith("[가이드]"):
                source_type = "guide"
            else:
                source_type = "manual"

            documents.append(
                {
                    "id": doc_id,
                    "owner_id": None,
                    "title": stem,
                    "content": text,
                    "source_type": source_type,
                    "region": _extract_region(stem),
                }
            )

    if not documents:
        print(f"[RAG] 문서를 찾지 못했습니다. 경로: {search_dirs}")
        print(f"      지원 형식: {', '.join(sorted(supported))}")

    return documents


def _read_file(path: Path) -> str:
    """확장자에 맞는 방식으로 텍스트를 추출한다."""
    if path.suffix.lower() == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError:
            print("[RAG] pypdf 가 설치되지 않았습니다.  pip install pypdf")
            return ""
        return "\n".join(p.extract_text() or "" for p in PdfReader(str(path)).pages)

    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="cp949")


# ─────────────────── 답변 생성 ───────────────────


def _generate_answer(question: str, context: str, history: list[dict] | None = None) -> dict:
    """컨텍스트를 근거로 답변을 생성한다.

    gemini_service.answer_with_context() 가 있으면 사용하고,
    없으면 검색된 원문을 그대로 보여주는 대체 답변을 반환한다.

    history는 "흐름 유지" 기능용으로 추가한 파라미터다. gemini_service가
    아직 history를 안 받는 구버전이면 TypeError가 나므로, 그 경우 history
    없이 재호출해서 하위 호환을 지킨다.
    """
    try:
        from app.services import gemini_service

        if hasattr(gemini_service, "answer_with_context"):
            try:
                return gemini_service.answer_with_context(question, context, history=history)
            except TypeError:
                return gemini_service.answer_with_context(question, context)
    except ImportError:
        pass

    return {
        "answer": f"[LLM 미연결 상태 · 검색 결과 원문]\n{context}",
        "tip": "",
    }