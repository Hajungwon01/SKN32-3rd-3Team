# path : evals/run_ragas.py
"""
[RAG 파트] RAGAS 로 규칙 기반 평가가 놓치는 부분을 보완 측정한다.

    python -m evals.run_ragas                        # 가장 최근 결과 사용
    python -m evals.run_ragas results_20260803_1925.json

왜 따로 두었나
  run_eval.py 의 규칙 기반 채점(키워드·거부 여부)은 이 프로젝트 고유의 실패 유형
  (지역 혼선, 분류 오독)을 잡는 데 강하지만 두 가지 사각지대가 있다.

    ① 근거에 없는 내용을 지어내도 금지 키워드에 없으면 통과한다.
       실제로 "출처에 없는 법령 조문을 인용"한 답변이 통과한 사례가 있었다.
    ② 검색된 청크 중 실제로 쓸모 있었던 비율을 전혀 모른다. (노이즈 측정 불가)

  RAGAS 는 LLM 이 답변을 주장 단위로 쪼개 컨텍스트와 대조하므로 ①을 잡고,
  Context Precision 으로 ②를 측정한다.
  반대로 "부산 기준을 서울 것처럼 답하면 안 된다" 같은 도메인 규칙은 모른다.
  → 대체가 아니라 **병행**한다.

설치 (버전 고정 필수)
    pip install ragas langchain-openai "langchain-community<0.4"
  최신 langchain-community 에서는 import ragas 부터 실패한다.
  확인된 조합: ragas 0.4.3 + langchain-community 0.3.31
"""

from __future__ import annotations

import json
import sys
import warnings
from datetime import datetime
from pathlib import Path

from app.core.config import settings

warnings.filterwarnings("ignore", category=DeprecationWarning)

EVALS_DIR = Path(__file__).resolve().parent

# "자료 없음" 취지의 답변을 알아보기 위한 표현.
# 이런 답변은 검증할 주장이 없어 Faithfulness 가 0 으로 나오는데,
# 이는 품질 문제가 아니라 측정상의 한계다. (아래 3절 참고)
REFUSAL_MARKERS = (
    "찾을 수 없습니다",
    "보유하고 있지 않",
    "자료가 없",
    "확인할 수 없",
    "확인하셔야",
)


def load_results(name: str | None) -> tuple[Path, dict]:
    """평가 결과 파일을 읽는다. 이름이 없으면 가장 최근 것."""
    if name:
        path = EVALS_DIR / name
        if not path.exists():
            print(f"[중단] 파일이 없습니다: {path}")
            sys.exit(1)
    else:
        candidates = sorted(EVALS_DIR.glob("results_*.json"))
        if not candidates:
            print("[중단] evals/results_*.json 이 없습니다. 먼저 run_eval 을 실행하세요.")
            sys.exit(1)
        path = candidates[-1]

    return path, json.loads(path.read_text(encoding="utf-8"))


def is_refusal(text: str) -> bool:
    return any(marker in text for marker in REFUSAL_MARKERS)


def build_dataset(results: list[dict]):
    """RAGAS 평가용 데이터셋을 만든다.

    검색 결과가 없는 문항은 제외한다. 컨텍스트가 비면 두 지표 모두 계산할 수 없고,
    그런 문항은 이미 run_eval 의 자료없음 대응률로 평가되고 있다.
    """
    from ragas import EvaluationDataset
    from ragas.dataset_schema import SingleTurnSample

    samples, used, refused = [], [], []

    for row in results:
        contexts = row.get("contexts") or []
        if not contexts:
            continue

        answer = row.get("answer", "")
        if row.get("tip"):
            answer = f"{answer}\n{row['tip']}"

        samples.append(
            SingleTurnSample(
                user_input=row["question"],
                response=answer,
                retrieved_contexts=contexts,
                reference=row.get("reference_answer") or None,
            )
        )
        used.append(row["id"])
        if is_refusal(answer):
            refused.append(row["id"])

    return EvaluationDataset(samples=samples), used, refused


def average(values: list[float]) -> float | None:
    clean = [v for v in values if v is not None]
    return round(sum(clean) / len(clean), 4) if clean else None


def main() -> None:
    name = sys.argv[1] if len(sys.argv) > 1 else None
    path, data = load_results(name)
    results = data["results"]

    print(f"대상 결과 파일: {path.name}")
    print(f"측정 설정     : {data.get('config')}")

    if not settings.OPENAI_API_KEY:
        print("\n[중단] OPENAI_API_KEY 가 필요합니다. (평가 모델로 사용)")
        sys.exit(1)

    try:
        from langchain_openai import ChatOpenAI, OpenAIEmbeddings
        from ragas import evaluate
        from ragas.embeddings import LangchainEmbeddingsWrapper
        from ragas.llms import LangchainLLMWrapper
        from ragas.metrics import Faithfulness, LLMContextPrecisionWithoutReference
    except ImportError as exc:
        print(f"\n[중단] 패키지가 없습니다: {exc}")
        print('  pip install ragas langchain-openai "langchain-community<0.4"')
        sys.exit(1)

    dataset, used, refused = build_dataset(results)
    skipped = [r["id"] for r in results if not (r.get("contexts") or [])]

    print(f"\n평가 대상 {len(used)}문항")
    if skipped:
        print(f"제외 {len(skipped)}문항 (검색 결과 없음): {skipped}")
    if not used:
        print("\n[중단] 평가할 문항이 없습니다.")
        print("  run_eval 을 최신 코드로 다시 실행해 contexts 를 저장하세요.")
        sys.exit(1)

    # 평가 모델. temperature=0 으로 실행 간 편차를 줄인다.
    evaluator_llm = LangchainLLMWrapper(
        ChatOpenAI(model=settings.OPENAI_MODEL, temperature=0,
                   api_key=settings.OPENAI_API_KEY)
    )
    evaluator_embeddings = LangchainEmbeddingsWrapper(
        OpenAIEmbeddings(model=settings.OPENAI_EMBEDDING_MODEL,
                         api_key=settings.OPENAI_API_KEY)
    )

    print(f"평가 모델     : {settings.OPENAI_MODEL}")
    print("\n측정 중... (문항마다 LLM 을 여러 번 호출하므로 시간이 걸립니다)\n")

    report = evaluate(
        dataset=dataset,
        metrics=[
            Faithfulness(llm=evaluator_llm),
            LLMContextPrecisionWithoutReference(llm=evaluator_llm),
        ],
        embeddings=evaluator_embeddings,
    )

    # ── 문항별 점수 ──
    COLUMNS = ("faithfulness", "llm_context_precision_without_reference")
    scores: list[dict] = []

    try:
        frame = report.to_pandas()
    except Exception:
        frame = None

    if frame is not None:
        print(f"  {'문항':<8}{'Faithfulness':>14}{'ContextPrecision':>18}  비고")
        for i, qid in enumerate(used):
            row = {"id": qid, "refused": qid in refused}
            line = f"  {qid:<8}"
            for column in COLUMNS:
                value = frame.iloc[i][column] if column in frame.columns else None
                # NaN 방어 (자기 자신과 다르면 NaN)
                row[column] = None if value is None or value != value else round(float(value), 4)
                line += f"{'-' if row[column] is None else format(row[column], '.4f'):>14}"
            scores.append(row)
            print(line + ("  ← 자료없음 응답" if row["refused"] else ""))

    # ── 평균 ──
    # 거부 답변은 검증할 주장이 없어 Faithfulness 가 0 으로 나온다.
    # 품질 문제가 아니라 측정 한계이므로 따로 계산해 함께 보여준다.
    aggregate: dict[str, float | None] = {}
    for column in COLUMNS:
        aggregate[column] = average([s.get(column) for s in scores])
        aggregate[f"{column}_excl_refusal"] = average(
            [s.get(column) for s in scores if not s["refused"]]
        )

    print("\n" + "─" * 60)
    print("  전체 평균")
    print(f"    Faithfulness       {_fmt(aggregate['faithfulness'])}"
          f"   (거부 제외 {_fmt(aggregate['faithfulness_excl_refusal'])})")
    print(f"    Context Precision  {_fmt(aggregate[COLUMNS[1]])}"
          f"   (거부 제외 {_fmt(aggregate[COLUMNS[1] + '_excl_refusal'])})")
    if refused:
        print(f"\n    자료없음 응답 {len(refused)}문항: {refused}")
        print("    → 검증할 주장이 없어 두 지표가 0 으로 나온다. 품질 문제가 아니다.")
        print("      개선 비교는 '거부 제외' 값으로 하는 편이 정확하다.")
    print("─" * 60)

    print("""
해석 요령
  Faithfulness 가 낮다  → 답변이 근거를 벗어남.
                          프롬프트에 "근거에 있는 것만" 지시·예시를 강화한다.
  ContextPrecision 낮음 → 검색에 노이즈가 많음.
                          임계값을 올리거나 top_k·쿼터를 줄여 컨텍스트를 다듬는다.

  두 지표는 상충할 수 있다. 컨텍스트를 많이 넣으면 답변 근거는 늘지만
  정밀도는 떨어진다.

  ⚠ 평가 모델도 확률 모델이라 실행마다 개별 문항 점수가 흔들린다.
    (실측 예: 같은 답변인데 0.5714 → 0.4000)
    개별 점수로 판단하지 말고 **전체 평균의 변화**만 볼 것.
""")

    out = EVALS_DIR / f"ragas_{datetime.now():%Y%m%d_%H%M}.json"
    out.write_text(
        json.dumps(
            {
                "measured_at": datetime.now().isoformat(timespec="seconds"),
                "source_file": path.name,
                "rag_config": data.get("config"),
                "evaluator_model": settings.OPENAI_MODEL,
                "evaluated": used,
                "skipped": skipped,
                "refused": refused,
                "aggregate": aggregate,
                "per_question": scores,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"결과 저장: {out}")


def _fmt(value: float | None) -> str:
    return f"{value:.4f}" if value is not None else "  -   "


if __name__ == "__main__":
    main()
