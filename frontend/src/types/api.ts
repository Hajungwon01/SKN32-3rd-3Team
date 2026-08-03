/**
 * API 계약 초안.
 *
 * 이 파일이 프론트의 타입이자 백엔드에 넘길 명세다. 여기서 합의가 끝나면
 * A는 이걸 그대로 Pydantic 모델로 옮기면 된다.
 *
 * 규칙 두 가지:
 *  - 필드명은 snake_case. FastAPI/Pydantic 기본값에 맞춘다. 프론트에서
 *    camelCase로 바꾸는 변환 계층은 MVP에서 넣지 않는다 (버그만 는다).
 *  - 시간은 전부 ISO 8601 UTC 문자열.
 */

// ─── 인증 ────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ─── 문서 ────────────────────────────────────────────────────────────

/** 목록·트리에 쓰는 가벼운 형태. 본문은 들어있지 않다. */
export interface DocumentSummary {
  id: number;
  title: string;
  parent_id: number | null;
  updated_at: string;
}

export interface DocumentDetail extends DocumentSummary {
  /**
   * 에디터(TipTap) 문서 JSON. 프론트만 해석한다.
   * 백엔드는 통째로 저장만 하면 되므로 JSON/TEXT 컬럼이면 충분하다.
   */
  content: unknown;

  /**
   * 같은 본문의 평문. 요약·RAG·검색이 쓰는 건 전부 이쪽이다.
   * 만들어내는 책임은 프론트에 있다 — editor.getText() 결과를 같이 보낸다.
   * 이걸 빼먹으면 D가 백엔드에서 JSON을 파싱하는 코드를 따로 짜게 된다.
   */
  content_text: string;
}

export interface DocumentSaveRequest {
  title: string;
  content: unknown;
  content_text: string;
  parent_id?: number | null;
}

// ─── 녹취록 (STT) ────────────────────────────────────────────────────

export type MeetingStatus =
  | "pending" // 업로드됨, 대기 중
  | "transcribing" // STT 진행 중
  | "summarizing" // LLM이 문서로 정리 중
  | "done"
  | "failed"
  | "canceled";

/** 상태가 끝난(더 폴링할 필요 없는) 상태인지. */
export const TERMINAL_STATUSES: MeetingStatus[] = ["done", "failed", "canceled"];

export interface Meeting {
  id: number;
  title: string;
  status: MeetingStatus;
  /** 0~100. 서버가 모르면 null — 그 경우 프론트는 무한 스피너를 쓴다. */
  progress: number | null;
  /** 문서화가 끝나면 채워진다. done 이전에는 null. */
  document_id: number | null;
  /** status === "failed" 일 때만 채워진다. 사용자에게 그대로 보여줄 문장. */
  error: string | null;
  created_at: string;
}

export interface MeetingDetail extends Meeting {
  /** 전사 원문. transcribing 이전에는 null. */
  transcript: string | null;
}

// ─── 요약 ────────────────────────────────────────────────────────────

export interface SummaryResponse {
  summary: string;
}

// ─── RAG 챗봇 ────────────────────────────────────────────────────────

export interface ChatRequest {
  question: string;
}

export interface ChatSource {
  document_id: number;
  title: string;
  /** 근거가 된 청크 일부. 클릭하면 해당 문서로 이동시킨다. */
  snippet: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
}
