import { TERMINAL_STATUSES } from "../types/api";
import type { DocumentSummary, MeetingDetail } from "../types/api";
import { useSession } from "../session";
import type { View } from "../App";

interface Props {
  documents: DocumentSummary[];
  meetings: MeetingDetail[];
  view: View | null;
  onNavigate: (view: View) => void;
  onNewDocument: () => void;
}

export default function Sidebar({
  documents,
  meetings,
  view,
  onNavigate,
  onNewDocument,
}: Props) {
  const { user, logout } = useSession();

  const isCurrent = (candidate: View) =>
    view?.kind === candidate.kind &&
    ("id" in candidate && "id" in view ? view.id === candidate.id : true);

  return (
    <nav className="sidebar">
      <div className="brand">
        <span>팀 위키</span>
        <button className="btn btn--quiet" onClick={() => void logout()}>
          {user?.name ?? "로그아웃"}
        </button>
      </div>

      <div className="nav-group">
        <div className="nav-group__head">
          <span className="meta">문서</span>
          <button className="btn btn--quiet" onClick={onNewDocument}>
            + 새 문서
          </button>
        </div>

        {documents.length === 0 && <p className="nav-empty">아직 문서가 없습니다.</p>}

        {documents.map((doc) => (
          <button
            key={doc.id}
            className={`nav-item${doc.parent_id ? " nav-item--child" : ""}`}
            aria-current={isCurrent({ kind: "doc", id: doc.id })}
            onClick={() => onNavigate({ kind: "doc", id: doc.id })}
          >
            <span className="nav-item__label">{doc.title || "제목 없음"}</span>
          </button>
        ))}
      </div>

      <div className="nav-group">
        <div className="nav-group__head">
          <span className="meta">녹취록</span>
          <button
            className="btn btn--quiet"
            onClick={() => onNavigate({ kind: "meeting", id: null })}
          >
            + 올리기
          </button>
        </div>

        {meetings.length === 0 && <p className="nav-empty">아직 녹음이 없습니다.</p>}

        {meetings.map((meeting) => (
          <button
            key={meeting.id}
            className="nav-item"
            aria-current={isCurrent({ kind: "meeting", id: meeting.id })}
            onClick={() => onNavigate({ kind: "meeting", id: meeting.id })}
          >
            {/* 처리 중인 작업은 어느 화면에 있든 여기서 보인다.
                참고 repo의 ActiveJobsWatcher와 같은 역할이다. */}
            {!TERMINAL_STATUSES.includes(meeting.status) && <span className="pulse" />}
            <span className="nav-item__label">{meeting.title}</span>
          </button>
        ))}
      </div>

      <div className="nav-group">
        <button
          className="nav-item"
          aria-current={isCurrent({ kind: "chat" })}
          onClick={() => onNavigate({ kind: "chat" })}
        >
          <span className="nav-item__label">문서에게 묻기</span>
        </button>
      </div>
    </nav>
  );
}
