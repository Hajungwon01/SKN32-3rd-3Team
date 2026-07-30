import { useState } from "react";
import type { FormEvent } from "react";
import { useSession } from "../session";

export default function LoginScreen() {
  const { login } = useSession();
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      // 에러 문구는 서버가 준 문장을 그대로 쓴다. 프론트가 추측해서
      // 바꿔 쓰면 백엔드 정책이 바뀔 때 두 군데가 어긋난다.
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <h1 className="login__title">팀 위키</h1>
        <p className="login__sub">회의 녹음이 문서가 되는 곳</p>

        <div className="field">
          <label className="meta field__label" htmlFor="email">
            이메일
          </label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label className="meta field__label" htmlFor="password">
            비밀번호
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="notice" style={{ marginTop: 14 }}>
            {error}
          </p>
        )}

        <button
          className="btn btn--primary"
          style={{ width: "100%", marginTop: 18 }}
          disabled={busy}
        >
          {busy ? "확인 중" : "로그인"}
        </button>

        <p className="meta" style={{ marginTop: 16, textTransform: "none" }}>
          mock 모드에서는 비밀번호에 아무 값이나 넣으면 통과합니다.
        </p>
      </form>
    </div>
  );
}
