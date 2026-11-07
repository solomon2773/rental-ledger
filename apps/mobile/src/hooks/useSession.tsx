import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { sessionStore } from "../lib/session";

interface SessionState {
  token: string | null;
  ready: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    sessionStore
      .get()
      .then(setToken)
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (t: string) => {
    await sessionStore.set(t);
    setToken(t);
  }, []);
  const signOut = useCallback(async () => {
    await sessionStore.clear();
    setToken(null);
  }, []);

  const value = useMemo(() => ({ token, ready, signIn, signOut }), [token, ready, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}
