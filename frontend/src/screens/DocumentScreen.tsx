import { useEffect, useState } from "react";
import { documents as documentsApi } from "../lib/api";
import type { DocumentDetail } from "../types/api";

interface Props {
  id: number;
  onSaved: () => void;
}

export default function DocumentScreen({ id, onSaved }: Props) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    let alive = true;
    void documentsApi.get(id).then((loaded) => {
      if (!alive) return;
      setDoc(loaded);
      setTitle(loaded.title);
      setText(loaded.content_text);
      setDirty(false);
      setSummary(null);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  async function save() {
    setSaving(true);
    try {
      const saved = await documentsApi.save(id, {
        title,
        /*
         * 여기가 A와 합의한 두 필드 규칙이 실제로 걸리는 자리다.
         *
         * content        — 에디터 전용. 백엔드는 통째로 저장만 한다.
         * content_text   — 요약·RAG·검색이 읽는 평문.
         *
         * TipTap을 넣으면 content가 editor.getJSON(),
         * content_text가 editor.getText()로 바뀐다. 백엔드는 안 바뀐다.
         */
        content: { format: "plaintext", text },
        content_text: text,
      });
      setDoc(saved);
      setDirty(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function summarize() {
    setSummarizing(true);
    try {
      const result = await documentsApi.summarize(id);
      setSummary(result.summary);
    } finally {
      setSummarizing(false);
    }
  }

  if (!doc) return <p className="empty">불러오는 중</p>;

  return (
    <>
      <input
        className="title-input"
        value={title}
        placeholder="제목 없는 문서"
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
      />

      <div className="spread" style={{ marginBottom: 20 }}>
        <span className="meta">
          {dirty ? "저장 안 됨" : `마지막 저장 ${formatTime(doc.updated_at)}`}
        </span>
        <div className="row">
          <button className="btn" onClick={() => void summarize()} disabled={summarizing}>
            {summarizing ? "요약 중" : "요약 만들기"}
          </button>
          <button
            className="btn btn--primary"
            onClick={() => void save()}
            disabled={saving || !dirty}
          >
            {saving ? "저장 중" : "저장"}
          </button>
        </div>
      </div>

      {/*
        에디터는 아직 textarea다. 관통이 먼저고, 여기를 TipTap으로 바꿔도
        위 save()의 계약은 그대로 남는다. 커스텀 블록은 MVP가 아니다.
      */}
      <textarea
        className="textarea"
        value={text}
        placeholder="여기에 문서를 씁니다."
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
      />

      {summary && (
        <>
          <hr className="divider" />
          <div className="panel panel--soft">
            <p className="meta" style={{ marginTop: 0 }}>
              AI 요약
            </p>
            <p style={{ margin: 0 }}>{summary}</p>
          </div>
        </>
      )}
    </>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
