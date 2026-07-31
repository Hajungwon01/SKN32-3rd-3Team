import { useCallback, useEffect, useState } from "react";
import { SessionProvider, useSession } from "./session";
import { documents as documentsApi, meetings as meetingsApi } from "./lib/api";
import { TERMINAL_STATUSES } from "./types/api";
import type { DocumentSummary, MeetingDetail } from "./types/api";
import Sidebar from "./components/Sidebar";
import LoginScreen from "./screens/LoginScreen";
import DocumentScreen from "./screens/DocumentScreen";
import MeetingScreen from "./screens/MeetingScreen";
import ChatScreen from "./screens/ChatScreen";

/**
 * 화면 전환은 일단 상태로만 한다.
 *
 * react-router를 아직 넣지 않은 이유: MVP 관통이 먼저고, 나중에 붙일 때
 * 고칠 곳이 App.tsx와 Sidebar 두 파일뿐이다. 다만 문서 링크·새로고침·뒤로가기가
 * 필요해지는 순간(= 위키라면 곧이다) 라우터로 옮기는 게 맞다.
 */
export type View =
  | { kind: "doc"; id: number }
  | { kind: "meeting"; id: number | null }
  | { kind: "chat" };

export default function App() {
  return (
    <SessionProvider>
      <Root />
    </SessionProvider>
  );
}

function Root() {
  const { user, ready } = useSession();

  // 세션 확인 전에 로그인 화면을 깜빡 보여주지 않는다.
  if (!ready) return null;
  if (!user) return <LoginScreen />;
  return <Workspace />;
}

function Workspace() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [meetings, setMeetings] = useState<MeetingDetail[]>([]);
  const [view, setView] = useState<View | null>(null);

  const reloadDocuments = useCallback(async () => {
    const list = await documentsApi.list();
    setDocuments(list);
    return list;
  }, []);

  const reloadMeetings = useCallback(async () => {
    setMeetings(await meetingsApi.list());
  }, []);

  useEffect(() => {
    void reloadDocuments().then((list) => {
      setView(
        (current) =>
          current ??
          (list[0] ? { kind: "doc", id: list[0].id } : { kind: "meeting", id: null }),
      );
    });
    void reloadMeetings();
  }, [reloadDocuments, reloadMeetings]);

  /*
   * 전역 작업 감시자.
   *
   * 돌고 있는 녹취 작업이 하나라도 있으면, 사용자가 다른 문서를 편집하고 있어도
   * 목록을 계속 갱신한다. 사이드바의 점이 살아 있으려면 이게 있어야 한다.
   * 화면별로 폴링을 흩어 놓으면 화면을 떠나는 순간 진행 상황이 멈춘 것처럼 보인다.
   */
  const hasActiveJob = meetings.some((m) => !TERMINAL_STATUSES.includes(m.status));

  useEffect(() => {
    if (!hasActiveJob) return;
    const timer = window.setInterval(() => void reloadMeetings(), 2000);
    return () => window.clearInterval(timer);
  }, [hasActiveJob, reloadMeetings]);

  const createDocument = useCallback(async () => {
    const created = await documentsApi.create({
      title: "제목 없는 문서",
      content: null,
      content_text: "",
    });
    await reloadDocuments();
    setView({ kind: "doc", id: created.id });
  }, [reloadDocuments]);

  return (
    <div className="shell">
      <Sidebar
        documents={documents}
        meetings={meetings}
        view={view}
        onNavigate={setView}
        onNewDocument={() => void createDocument()}
      />

      <main className="main">
        <div className="main__inner">
          {view?.kind === "doc" && (
            <DocumentScreen
              key={view.id}
              id={view.id}
              onSaved={() => void reloadDocuments()}
            />
          )}

          {view?.kind === "meeting" && (
            <MeetingScreen
              id={view.id}
              onNavigate={setView}
              onChanged={() => {
                void reloadMeetings();
                void reloadDocuments();
              }}
            />
          )}

          {view?.kind === "chat" && (
            <ChatScreen onOpenDocument={(id) => setView({ kind: "doc", id })} />
          )}
        </div>
      </main>
    </div>
  );
}
