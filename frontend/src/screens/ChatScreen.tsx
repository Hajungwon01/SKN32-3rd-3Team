import { useState } from "react";
import type { FormEvent } from "react";
import { chat } from "../lib/api";
import type { ChatSource } from "../types/api";

interface Message {
  role: "me" | "bot";
  text: string;
  sources?: ChatSource[];
}

interface Props {
  onOpenDocument: (id: number) => void;
}

export default function ChatScreen({ onOpenDocument }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  async function ask(e: FormEvent) {
    e.preventDefault();
    const text = question.trim();
    if (!text) return;

    setMessages((prev) => [...prev, { role: "me", text }]);
    setQuestion("");
    setAsking(true);

    try {
      const answer = await chat.ask({ question: text });
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: answer.answer, sources: answer.sources },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: err instanceof Error ? err.message : "답변을 가져오지 못했습니다.",
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <>
      <h1 className="login__title" style={{ fontSize: 22, marginBottom: 6 }}>
        문서에게 묻기
      </h1>
      <p className="meta" style={{ marginBottom: 26 }}>
        답변에는 근거 문서가 함께 붙습니다
      </p>

      <div className="stack" style={{ marginBottom: 24 }}>
        {messages.length === 0 && (
          <p className="empty">
            쌓인 문서와 회의록을 근거로 답합니다. 무엇이든 물어보세요.
          </p>
        )}

        {messages.map((message, i) => (
          <div key={i}>
            <div className={`bubble bubble--${message.role}`}>{message.text}</div>

            {message.sources && message.sources.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {message.sources.map((source) => (
                  <button
                    key={source.document_id}
                    className="source"
                    onClick={() => onOpenDocument(source.document_id)}
                  >
                    {source.title} — {source.snippet}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {asking && <p className="empty">찾는 중</p>}
      </div>

      <form className="row" onSubmit={ask}>
        <input
          className="input"
          style={{ flex: 1 }}
          value={question}
          placeholder="예: 지난 회의에서 정한 MVP 범위가 뭐였지?"
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button className="btn btn--primary" disabled={asking || !question.trim()}>
          묻기
        </button>
      </form>
    </>
  );
}
