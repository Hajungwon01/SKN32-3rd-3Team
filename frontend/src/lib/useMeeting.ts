import { useEffect, useState } from "react";
import { meetings } from "./api";
import { TERMINAL_STATUSES } from "../types/api";
import type { MeetingDetail } from "../types/api";

/**
 * 끝날 때까지 폴링한다.
 *
 * setTimeout 재귀를 쓰는 이유: setInterval은 응답이 느릴 때 요청을 쌓는다.
 * 여기서는 한 번 받은 뒤에 다음 예약을 걸므로 겹치지 않는다.
 */
export function useMeeting(id: number | null) {
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);

  useEffect(() => {
    if (id === null) {
      setMeeting(null);
      return;
    }

    let alive = true;
    let timer = 0;

    async function tick(meetingId: number) {
      try {
        const next = await meetings.get(meetingId);
        if (!alive) return;
        setMeeting(next);
        if (!TERMINAL_STATUSES.includes(next.status)) {
          timer = window.setTimeout(() => tick(meetingId), 1200);
        }
      } catch {
        // 일시적 실패로 폴링을 끊지 않는다. 간격만 늘려서 계속 시도한다.
        if (alive) timer = window.setTimeout(() => tick(meetingId), 3000);
      }
    }

    void tick(id);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [id]);

  return { meeting, setMeeting };
}
