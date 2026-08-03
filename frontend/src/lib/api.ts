/**
 * 모든 네트워크 호출이 지나는 단 하나의 문.
 *
 * 화면 코드에서 fetch를 직접 부르지 않는다. 그래야:
 *  - mock ↔ 실서버 전환이 플래그 하나
 *  - 인증 방식이 바뀌어도 고칠 곳이 request() 한 군데
 *  - 에러 처리가 한 곳에 모인다
 */

import type {
  ChatRequest,
  ChatResponse,
  DocumentDetail,
  DocumentSaveRequest,
  DocumentSummary,
  MeetingDetail,
  SummaryResponse,
  User,
} from "../types/api";
import * as mock from "./mock";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const BASE = import.meta.env.VITE_API_BASE ?? "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;

  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    // 세션 쿠키 방식을 전제로 한다. Bearer 토큰으로 바꾼다면
    // 여기 headers에 Authorization을 넣는 것으로 끝난다.
    credentials: "include",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!res.ok) {
    // 백엔드가 FastAPI면 에러 본문이 { detail: "..." } 로 온다.
    const detail = await res
      .json()
      .then((b) => b?.detail)
      .catch(() => null);
    throw new ApiError(res.status, detail ?? `요청에 실패했습니다 (${res.status})`);
  }

  return res.status === 204 ? (undefined as T) : res.json();
}

// ─── 인증 ────────────────────────────────────────────────────────────

export const auth = {
  login: (email: string, password: string): Promise<User> =>
    USE_MOCK
      ? mock.login(email, password)
      : request("/auth/login", { method: "POST", json: { email, password } }),

  logout: (): Promise<void> =>
    USE_MOCK ? mock.logout() : request("/auth/logout", { method: "POST" }),

  /** 앱 부팅 시 세션 확인용. 미로그인이면 401 → ApiError. */
  me: (): Promise<User> => (USE_MOCK ? mock.me() : request("/me")),
};

// ─── 문서 ────────────────────────────────────────────────────────────

export const documents = {
  list: (): Promise<DocumentSummary[]> =>
    USE_MOCK ? mock.listDocuments() : request("/documents"),

  get: (id: number): Promise<DocumentDetail> =>
    USE_MOCK ? mock.getDocument(id) : request(`/documents/${id}`),

  create: (body: DocumentSaveRequest): Promise<DocumentDetail> =>
    USE_MOCK
      ? mock.createDocument(body)
      : request("/documents", { method: "POST", json: body }),

  save: (id: number, body: DocumentSaveRequest): Promise<DocumentDetail> =>
    USE_MOCK
      ? mock.saveDocument(id, body)
      : request(`/documents/${id}`, { method: "PUT", json: body }),

  remove: (id: number): Promise<void> =>
    USE_MOCK
      ? mock.removeDocument(id)
      : request(`/documents/${id}`, { method: "DELETE" }),

  /** 문서 본문을 LLM으로 요약. D 담당. */
  summarize: (id: number): Promise<SummaryResponse> =>
    USE_MOCK
      ? mock.summarize(id)
      : request(`/documents/${id}/summary`, { method: "POST" }),
};

// ─── 녹취록 ──────────────────────────────────────────────────────────

export const meetings = {
  list: (): Promise<MeetingDetail[]> =>
    USE_MOCK ? mock.listMeetings() : request("/meetings"),

  get: (id: number): Promise<MeetingDetail> =>
    USE_MOCK ? mock.getMeeting(id) : request(`/meetings/${id}`),

  /** 오디오 업로드. JSON이 아니라 multipart라서 request()를 우회한다. */
  upload: async (file: File, title: string): Promise<MeetingDetail> => {
    if (USE_MOCK) return mock.uploadMeeting(file, title);

    const form = new FormData();
    form.append("file", file);
    form.append("title", title);

    return request("/meetings", { method: "POST", body: form });
  },

  cancel: (id: number): Promise<MeetingDetail> =>
    USE_MOCK
      ? mock.cancelMeeting(id)
      : request(`/meetings/${id}/cancel`, { method: "POST" }),
};

// ─── 챗봇 ────────────────────────────────────────────────────────────

export const chat = {
  ask: (body: ChatRequest): Promise<ChatResponse> =>
    USE_MOCK ? mock.ask(body) : request("/chat", { method: "POST", json: body }),
};
