# path : evals/run_eval.py
"""
[RAG 파트] 정답셋으로 챗봇 성능을 측정한다.

    python -m evals.run_eval

측정 항목
  검색 정확도    expected_source 문서가 검색 결과에 포함됐는가
  의미 유사도    답변과 모범답안의 임베딩 코사인 유사도
  키워드 포함    must_mention 을 빠짐없이 언급했는가 (지역 구분 채점)
  환각           forbidden_mention 을 언급했거나, 자료 없는 질문에 답을 지어냈는가

사람이 채점해야 하는 것
  답변이 실제로 사실인지, 어조·실천팁 같은 정성 항목.
  결과 JSON 의 manual_check 필드를 채우면 된다.

주의
  측정 중에는 설정(임계값·임베딩 백엔드·청크 크기·프롬프트)을 바꾸지 말 것.
  하나라도 바뀌면 지표가 섞여 비교가 무의미해진다.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import numpy as np

from app.core.config import settings
from app.services import embedding_service, rag_service

EVALS_DIR = Path(__file__).resolve().parent
QA_SET = EVALS_DIR / "qa_set.json"


# ─────────────────── 채점 ───────────────────


def check_retrieval(item: dict, sources: list[dict]) -> bool | None:
    """expected_source 의 문서가 검색 결과에 모두 포함됐는지 확인한다.

    "부산 남구|서울시" 처럼 | 로 구분하면 모두 검색되어야 정답이다.
    자료 없음 문항은 검색 자체가 없어야 하므로 None(해당 없음)을 돌려준다.
    """
    expected = item.get("expected_source", "").strip()
    if not expected:
        return None

    titles = " ".join(s.get("title", "") for s in sources)
    return all(keyword.strip() in titles for keyword in expected.split("|"))


def cosine(a: list[float], b: list[float]) -> float:
    va, vb = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    return round(float(np.dot(va, vb) / denom), 4) if denom else 0.0


def check_similarity(item: dict, answer: str) -> float | None:
    """답변과 모범답안의 의미 유사도. 모범답안이 비어 있으면 건너뛴다."""
    reference = item.get("reference_answer", "").strip()
    if not reference:
        return None

    vectors = embedding_service.embed_documents([answer, reference])
    return cosine(vectors[0], vectors[1])


def check_keywords(item: dict, answer: str) -> tuple[list[str], list[str]]:
    """빠뜨린 필수 키워드와, 말하면 안 되는데 말한 키워드를 돌려준다.

    must_mention    : 모두 포함해야 한다. (지역 구분처럼 빠지면 안 되는 것)
    must_match_any  : 목록 중 하나만 포함하면 된다.
                      같은 뜻을 여러 표현으로 답할 수 있거나
                      ("헹구다"/"씻다"), 근거로 삼을 조문이 여럿일 때 쓴다.
                      표현 하나를 고정하면 맞은 답도 오답으로 채점된다.
    """
    missing = [k for k in item.get("must_mention", []) if k not in answer]

    alternatives = item.get("must_match_any", [])
    if alternatives and not any(k in answer for k in alternatives):
        missing.append(f"(택1) {'/'.join(alternatives)}")

    forbidden = [k for k in item.get("forbidden_mention", []) if k in answer]
    return missing, forbidden


def is_refusal(answer: str) -> bool:
    """'자료 없음' 취지의 답변인지 판단한다."""
    markers = ("찾을 수 없습니다", "보유하고 있지 않", "자료가 없", "확인하셔야")
    return any(m in answer for m in markers)


def grade(item: dict) -> dict:
    """한 문항을 실행하고 채점한다.

    문항의 region 을 그대로 넘긴다. 실제 챗봇은 사용자가 지역을 고른 상태로
    검색하므로, 지역을 지정하지 않고 평가하면 다른 지역 문서까지 후보에 들어가
    실제보다 후한 점수가 나온다.
    region 이 없는 문항은 전체 검색(지역 무관)으로 처리한다.
    """
    region = item.get("region")

    # 검색 결과의 원문(content)을 contexts 로 저장해야 RAGAS 평가가 가능하다.
    # rag_service.ask() 가 contexts 를 반환하지 않는 버전도 있으므로
    # search() 를 별도로 호출해 확실히 가져온다.
    search_results = rag_service.search(item["question"], owner_id=None, region=region, balanced=True)
    contexts = [r["content"] for r in search_results if r.get("content")]

    result = rag_service.ask(item["question"], owner_id=None, region=region)
    answer = result.get("answer", "")
    tip = result.get("tip", "")
    sources = result.get("sources", [])

    # 키워드·거부 판정은 화면에 보이는 전체 텍스트 기준으로 한다.
    # (실천 팁에 지역명이나 금지 표현이 들어갈 수 있기 때문)
    full_text = f"{answer}\n{tip}".strip()

    retrieval = check_retrieval(item, sources)
    similarity = check_similarity(item, answer)
    missing, forbidden = check_keywords(item, full_text)
    refused = is_refusal(full_text)

    should_answer = item.get("should_have_answer", True)

    # 환각 판정
    #   - 자료 없는 질문에 거부하지 않고 답한 경우
    #   - 말하면 안 되는 키워드를 말한 경우 (타 지역 기준을 그 지역 것처럼 안내 등)
    hallucinated = (not should_answer and not refused) or bool(forbidden)

    # 정답 판정
    if should_answer:
        passed = bool(retrieval) and not missing and not refused
    else:
        passed = refused and not forbidden

    return {
        "id": item["id"],
        "type": item["type"],
        "region": region,
        "question": item["question"],
        # RAGAS 등 후속 평가에서 재사용할 수 있게 모범답안도 남긴다
        "reference_answer": item.get("reference_answer", ""),
        "answer": answer,
        "tip": tip,
        "sources": [s.get("title", "") for s in sources],
        "contexts": contexts,
        "retrieval_hit": retrieval,
        "similarity": similarity,
        "missing_keywords": missing,
        "forbidden_used": forbidden,
        "refused": refused,
        "hallucinated": hallucinated,
        "passed": passed,
        "manual_check": {"factual": None, "tone": None, "comment": ""},
    }


# ─────────────────── 집계 ───────────────────


def summarize(results: list[dict]) -> dict:
    def ratio(hits: int, total: int) -> float | None:
        return round(hits / total, 4) if total else None

    answerable = [r for r in results if r["type"] != "no_answer"]
    no_answer = [r for r in results if r["type"] == "no_answer"]

    retrieval_target = [r for r in answerable if r["retrieval_hit"] is not None]
    similarities = [r["similarity"] for r in results if r["similarity"] is not None]

    return {
        "total": len(results),
        "passed": sum(1 for r in results if r["passed"]),
        "pass_rate": ratio(sum(1 for r in results if r["passed"]), len(results)),
        "retrieval_accuracy": ratio(
            sum(1 for r in retrieval_target if r["retrieval_hit"]),
            len(retrieval_target),
        ),
        "avg_similarity": (
            round(sum(similarities) / len(similarities), 4) if similarities else None
        ),
        "hallucination_rate": ratio(
            sum(1 for r in results if r["hallucinated"]), len(results)
        ),
        "refusal_accuracy": ratio(
            sum(1 for r in no_answer if r["refused"]), len(no_answer)
        ),
        "skipped_similarity": [
            r["id"] for r in results if r["similarity"] is None
        ],
    }


def by_type(results: list[dict]) -> dict:
    grouped: dict[str, dict] = {}
    for r in results:
        bucket = grouped.setdefault(r["type"], {"total": 0, "passed": 0})
        bucket["total"] += 1
        bucket["passed"] += int(r["passed"])
    for bucket in grouped.values():
        bucket["pass_rate"] = round(bucket["passed"] / bucket["total"], 4)
    return grouped


# ─────────────────── 실행 ───────────────────


def main() -> None:
    if not QA_SET.exists():
        print(f"[중단] 정답셋이 없습니다: {QA_SET}")
        return

    items = json.loads(QA_SET.read_text(encoding="utf-8"))

    config = {
        "embedding_backend": settings.EMBEDDING_BACKEND,
        "rag_min_score": settings.RAG_MIN_SCORE,
        "rag_top_k": settings.RAG_TOP_K,
        "chunk_size": settings.CHUNK_SIZE,
        "chunk_overlap": settings.CHUNK_OVERLAP,
    }

    print("측정 설정")
    for key, value in config.items():
        print(f"  {key:20} {value}")
    print(f"\n{len(items)}문항 실행\n")

    results: list[dict] = []
    for item in items:
        row = grade(item)
        results.append(row)

        mark = "PASS" if row["passed"] else "FAIL"
        sim = f"{row['similarity']:.3f}" if row["similarity"] is not None else "  -  "
        flag = " [환각]" if row["hallucinated"] else ""
        reg = f"[{row['region']}]" if row["region"] else "[전체]"
        print(f"  {row['id']} {mark} {reg:<14} 유사도 {sim}  {row['question'][:22]}{flag}")

        if row["missing_keywords"]:
            print(f"        누락 키워드: {row['missing_keywords']}")
        if row["forbidden_used"]:
            print(f"        금지 키워드 사용: {row['forbidden_used']}")

    summary = summarize(results)
    types = by_type(results)

    print("\n" + "─" * 52)
    print(f"  통과            {summary['passed']}/{summary['total']}"
          f"  ({summary['pass_rate']:.1%})")
    print(f"  검색 정확도     {_pct(summary['retrieval_accuracy'])}")
    print(f"  평균 의미 유사도 {summary['avg_similarity']}")
    print(f"  환각률          {_pct(summary['hallucination_rate'])}")
    print(f"  자료없음 대응률  {_pct(summary['refusal_accuracy'])}")
    print("─" * 52)
    for name, bucket in types.items():
        print(f"  {name:16} {bucket['passed']}/{bucket['total']}"
              f"  ({bucket['pass_rate']:.1%})")

    if summary["skipped_similarity"]:
        print(f"\n  모범답안 미작성으로 유사도 제외: {summary['skipped_similarity']}")

    path = EVALS_DIR / f"results_{datetime.now():%Y%m%d_%H%M}.json"
    path.write_text(
        json.dumps(
            {
                "measured_at": datetime.now().isoformat(timespec="seconds"),
                "config": config,
                "summary": summary,
                "by_type": types,
                "results": results,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\n결과 저장: {path}")
    print("  각 문항의 manual_check 를 채워 정성 평가를 기록하세요.")


def _pct(value: float | None) -> str:
    return f"{value:.1%}" if value is not None else "해당 없음"


if __name__ == "__main__":
    main()