import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { meetings as meetingsApi } from "../lib/api";
import { TERMINAL_STATUSES } from "../types/api";
import { useMeeting } from "../lib/useMeeting";
import PipelineStages from "../components/PipelineStages";
import type { View } from "../App";

interface Props {
  id: number | null;
  onNavigate: (view: View) => void;
  onChanged: () => void;
}

export default function MeetingScreen({ id, onNavigate, onChanged }: Props) {
  const { meeting, setMeeting } = useMeeting(id);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  // 상태가 바뀔 때마다 사이드바와 문서 목록을 갱신한다.
  // (문서화가 끝나면 새 문서가 생기므로 문서 목록도 함께 봐야 한다.)
  const status = meeting?.status;
  useEffect(() => {
    if (status) onChanged();
  }, [status, onChanged]);

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const created = await meetingsApi.upload(file, title || file.name);
      setTitle("");
      setFile(null);
      onChanged();
      onNavigate({ kind: "meeting", id: created.id });
    } finally {
      setUploading(false);
    }
  }

  if (id === null) {
    return (
      <>
        <h1 className="login__title" style={{ fontSize: 22, marginBottom: 20 }}>
          녹음 올리기
        </h1>

        <form className="panel stack" onSubmit={upload}>
          <div>
            <label className="meta field__label" htmlFor="meeting-title">
              제목
            </label>
            <input
              id="meeting-title"
              className="input"
              value={title}
              placeholder="비워 두면 파일 이름을 씁니다"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="meta field__label" htmlFor="meeting-file">
              오디오 파일
            </label>
            <input
              id="meeting-file"
              className="input"
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <button className="btn btn--primary" disabled={!file || uploading}>
            {uploading ? "올리는 중" : "올리고 문서 만들기"}
          </button>
        </form>

        <p className="meta" style={{ marginTop: 16, textTransform: "none" }}>
          브라우저 녹음(MediaRecorder)은 파일 업로드가 끝까지 동작한 뒤에 붙입니다.
        </p>
      </>
    );
  }

  if (!meeting) return <p className="empty">불러오는 중</p>;

  const running = !TERMINAL_STATUSES.includes(meeting.status);

  async function cancel() {
    if (id === null) return;
    setMeeting(await meetingsApi.cancel(id));
    onChanged();
  }

  return (
    <>
      <h1 className="login__title" style={{ fontSize: 22, marginBottom: 6 }}>
        {meeting.title}
      </h1>
      <p className="meta" style={{ marginBottom: 26 }}>
        {new Date(meeting.created_at).toLocaleString("ko-KR")}
      </p>

      <PipelineStages status={meeting.status} progress={meeting.progress} />

      <div className="spread" style={{ marginTop: 20 }}>
        <span className="meta">
          {meeting.status === "canceled"
            ? "취소됨"
            : meeting.progress !== null && running
              ? `${meeting.progress}%`
              : ""}
        </span>

        <div className="row">
          {running && (
            <button className="btn" onClick={() => void cancel()}>
              취소
            </button>
          )}
          {meeting.document_id !== null && (
            <button
              className="btn btn--primary"
              onClick={() => onNavigate({ kind: "doc", id: meeting.document_id! })}
            >
              만들어진 문서 열기
            </button>
          )}
        </div>
      </div>

      {meeting.error && (
        <p className="notice" style={{ marginTop: 20 }}>
          {meeting.error}
        </p>
      )}

      <hr className="divider" />

      <p className="meta">전사 원문</p>
      {meeting.transcript ? (
        <p className="transcript">{meeting.transcript}</p>
      ) : (
        <p className="empty">아직 전사가 시작되지 않았습니다.</p>
      )}
    </>
  );
}
