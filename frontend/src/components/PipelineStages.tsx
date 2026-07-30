import type { CSSProperties } from "react";
import type { MeetingStatus } from "../types/api";

/**
 * 이 화면의 signature 요소.
 *
 * 대부분의 위키는 서버 작업을 스피너 하나로 숨긴다. 이 제품에서는
 * "녹음이 문서가 되는 과정"이 기능 자체라서, 어느 단계에 있고 얼마나 남았는지를
 * 그대로 드러낸다. 진행률은 활성 단계 안에서만 찬다.
 */

const STAGES: { key: MeetingStatus; label: string }[] = [
  { key: "pending", label: "대기" },
  { key: "transcribing", label: "전사" },
  { key: "summarizing", label: "문서화" },
  { key: "done", label: "완료" },
];

interface Props {
  status: MeetingStatus;
  progress: number | null;
}

export default function PipelineStages({ status, progress }: Props) {
  const failed = status === "failed";
  const stopped = failed || status === "canceled";
  const done = status === "done";
  const activeIndex = STAGES.findIndex((s) => s.key === status);

  return (
    <div className="stages">
      {STAGES.map((stage, i) => {
        let state = "pending";
        if (stopped) state = failed ? "failed" : "pending";
        else if (done || i < activeIndex) state = "done";
        else if (i === activeIndex) state = "active";

        return (
          <div key={stage.key} className={`stage stage--${state}`}>
            <div
              className="stage__bar"
              // 서버가 진행률을 모르면(null) 막대는 비워 두고 라벨의 점만 뛴다.
              style={{ "--fill": `${progress ?? 0}%` } as CSSProperties}
            />
            <div className="stage__label meta">
              {state === "active" && <span className="pulse" />}
              {stage.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
