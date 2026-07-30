import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { auth } from "./lib/api";
import type { User } from "./types/api";

interface SessionValue {
  user: User | null;
  /** 부팅 시 세션 확인이 끝났는지. false 동안은 아무 화면도 그리지 않는다. */
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 부팅 시 한 번. 401은 에러가 아니라 "아직 로그인 안 함"이라는 정상 경로다.
    auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await auth.login(email, password));
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
  }, []);

  return (
    <SessionContext value={{ user, ready, login, logout }}>{children}</SessionContext>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession은 SessionProvider 안에서만 쓸 수 있습니다.");
  return value;
}
