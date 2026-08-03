/**
 * 가짜 백엔드. A·C·D를 기다리지 않고 화면을 다 만들기 위한 것.
 *
 * 핵심 규칙: **STT를 일부러 느리게 만든다.**
 * 실제 전사는 수십 초에서 수 분 걸린다. mock이 즉시 응답하면 진행률·취소·
 * "페이지를 떠나도 계속 돌기" UX가 통째로 빠진 채 완성됐다고 착각하게 되고,
 * 나중에 C의 진짜 STT를 붙이는 순간 화면을 다시 짜게 된다.
 */

import type {
  ChatRequest,
  ChatResponse,
  DocumentDetail,
  DocumentSaveRequest,
  DocumentSummary,
  MeetingDetail,
  MeetingStatus,
  SummaryResponse,
  User,
} from "../types/api";
import { ApiError } from "./api";

/** 네트워크 지연 흉내. 로딩 상태를 실제로 보이게 하려고 넣는다. */
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const now = () => new Date().toISOString();

// ─── 인증 ────────────────────────────────────────────────────────────

const USER: User = { id: 1, email: "demo@example.com", name: "데모 사용자" };

let session: User | null = null;

export async function login(email: string, password: string): Promise<User> {
  await delay(400);
  if (!password) throw new ApiError(401, "이메일 또는 비밀번호가 맞지 않습니다.");
  session = { ...USER, email };
  return session;
}

export async function logout(): Promise<void> {
  await delay();
  session = null;
}

export async function me(): Promise<User> {
  await delay(150);
  if (!session) throw new ApiError(401, "로그인이 필요합니다.");
  return session;
}

// ─── 문서 ────────────────────────────────────────────────────────────

let nextDocId = 3;

const docs = new Map<number, DocumentDetail>([
  [
    1,
    {
      id: 1,
      title: "팀 위키 시작하기",
      parent_id: null,
      updated_at: now(),
      content: null,
      content_text:
        "이 문서는 mock 데이터입니다. 문서 트리와 에디터를 확인하는 용도로 씁니다.",
    },
  ],
  [
    2,
    {
      id: 2,
      title: "7월 4주차 회의",
      parent_id: 1,
      updated_at: now(),
      content: null,
      content_text: "지난 회의에서는 MVP 범위와 역할 분담을 정했습니다.",
    },
  ],
]);

const toSummary = (d: DocumentDetail): DocumentSummary => ({
  id: d.id,
  title: d.title,
  parent_id: d.parent_id,
  updated_at: d.updated_at,
});

export async function listDocuments(): Promise<DocumentSummary[]> {
  await delay();
  return [...docs.values()].map(toSummary);
}

export async function getDocument(id: number): Promise<DocumentDetail> {
  await delay();
  const doc = docs.get(id);
  if (!doc) throw new ApiError(404, "문서를 찾을 수 없습니다.");
  return doc;
}

export async function createDocument(
  body: DocumentSaveRequest,
): Promise<DocumentDetail> {
  await delay();
  const doc: DocumentDetail = {
    id: nextDocId++,
    title: body.title,
    parent_id: body.parent_id ?? null,
    updated_at: now(),
    content: body.content,
    content_text: body.content_text,
  };
  docs.set(doc.id, doc);
  return doc;
}

export async function saveDocument(
  id: number,
  body: DocumentSaveRequest,
): Promise<DocumentDetail> {
  await delay();
  const doc = docs.get(id);
  if (!doc) throw new ApiError(404, "문서를 찾을 수 없습니다.");

  const updated: DocumentDetail = {
    ...doc,
    title: body.title,
    content: body.content,
    content_text: body.content_text,
    parent_id: body.parent_id ?? doc.parent_id,
    updated_at: now(),
  };
  docs.set(id, updated);
  return updated;
}

export async function removeDocument(id: number): Promise<void> {
  await delay();
  docs.delete(id);
}

export async function summarize(id: number): Promise<SummaryResponse> {
  await delay(1800); // LLM은 느리다. 버튼 비활성화 처리를 확인하려고 길게 준다.
  const doc = docs.get(id);
  if (!doc) throw new ApiError(404, "문서를 찾을 수 없습니다.");
  return {
    summary: `[mock 요약] "${doc.title}" 문서의 핵심은 세 가지입니다. 첫째, ... 둘째, ... 셋째, ...`,
  };
}

// ─── 녹취록 ──────────────────────────────────────────────────────────

/**
 * 상태를 저장하지 않고 "업로드 시각으로부터 몇 초 지났는가"로 계산한다.
 * 폴링할 때마다 자연스럽게 다음 단계로 넘어간다.
 */
const TIMELINE: { until: number; status: MeetingStatus }[] = [
  { until: 3_000, status: "pending" },
  { until: 15_000, status: "transcribing" },
  { until: 22_000, status: "summarizing" },
  { until: Infinity, status: "done" },
];

interface MockMeeting {
  id: number;
  title: string;
  startedAt: number;
  canceled: boolean;
}

let nextMeetingId = 1;
const rawMeetings = new Map<number, MockMeeting>();

const TRANSCRIPT =
  "[mock 전사] 안녕하세요. 오늘 회의에서는 MVP 범위를 정하겠습니다. " +
  "우선 로그인과 문서 작성이 먼저 들어가고, 녹취록과 요약이 그 다음입니다. " +
  "RAG 챗봇은 문서가 쌓인 뒤에 붙이는 게 맞다고 봅니다.";

function project(m: MockMeeting): MeetingDetail {
  const elapsed = Date.now() - m.startedAt;
  const status: MeetingStatus = m.canceled
    ? "canceled"
    : TIMELINE.find((t) => elapsed < t.until)!.status;

  const done = status === "done";
  const started = status === "summarizing" || done;

  return {
    id: m.id,
    title: m.title,
    status,
    progress: m.canceled
      ? null
      : Math.min(100, Math.round((elapsed / 22_000) * 100)),
    document_id: done ? 2 : null,
    error: null,
    transcript: started ? TRANSCRIPT : null,
    created_at: new Date(m.startedAt).toISOString(),
  };
}

export async function uploadMeeting(
  file: File,
  title: string,
): Promise<MeetingDetail> {
  await delay(700); // 업로드는 원래 느리다.
  const m: MockMeeting = {
    id: nextMeetingId++,
    title: title || file.name,
    startedAt: Date.now(),
    canceled: false,
  };
  rawMeetings.set(m.id, m);
  return project(m);
}

export async function listMeetings(): Promise<MeetingDetail[]> {
  await delay();
  return [...rawMeetings.values()].map(project);
}

export async function getMeeting(id: number): Promise<MeetingDetail> {
  await delay(120); // 폴링용이라 짧게.
  const m = rawMeetings.get(id);
  if (!m) throw new ApiError(404, "녹취록을 찾을 수 없습니다.");
  return project(m);
}

export async function cancelMeeting(id: number): Promise<MeetingDetail> {
  await delay();
  const m = rawMeetings.get(id);
  if (!m) throw new ApiError(404, "녹취록을 찾을 수 없습니다.");
  m.canceled = true;
  return project(m);
}

// ─── 챗봇 ────────────────────────────────────────────────────────────

export async function ask(body: ChatRequest): Promise<ChatResponse> {
  await delay(1500);
  return {
    answer: `[mock 답변] "${body.question}"에 대해서는 아래 문서에 근거가 있습니다.`,
    sources: [
      {
        document_id: 2,
        title: "7월 4주차 회의",
        snippet: "지난 회의에서는 MVP 범위와 역할 분담을 정했습니다.",
      },
    ],
  };
}
