"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AuthUser } from "@/lib/auth";

type Provider = "github" | "google";

interface AuthContextValue {
  user: AuthUser | null;
  /** 初次 /api/auth/me 轮询完成前为 true */
  loading: boolean;
  /** 可用的登录方式（缺密钥的服务商为 false），用于置灰按钮 */
  enabled: { github: boolean; google: boolean };
  login: (p: Provider) => void;
  logout: () => void;
  /** 重新拉取 /api/auth/me（登录弹窗回调后调用） */
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<{ github: boolean; google: boolean }>({ github: false, google: false });
  const winRef = useRef<Window | null>(null);
  const onMsgRef = useRef<((e: MessageEvent) => void) | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as { user: AuthUser | null };
      setUser(data.user);
    } catch {
      /* 网络错误就当未登录 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [me, cfg] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()) as Promise<{ user: AuthUser | null }>,
          fetch("/api/auth/config", { cache: "no-store" }).then((r) => r.json()) as Promise<{
            providers: { github: boolean; google: boolean };
          }>,
        ]);
        if (!alive) return;
        setUser(me.user ?? null);
        setEnabled(cfg.providers ?? { github: false, google: false });
      } catch {
        /* ignore */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(
    (p: Provider) => {
      const w = window.open(
        `/api/auth/login/${p}`,
        "aipp-oauth",
        "width=560,height=720,noopener=no",
      );
      winRef.current = w;
      if (onMsgRef.current) window.removeEventListener("message", onMsgRef.current);
      const handler = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        const t = (e.data as { type?: string })?.type;
        if (t === "aipp:auth") {
          w?.close();
          void refresh();
        } else if (t === "aipp:auth:error") {
          w?.close();
          // 不强制刷新，错误已在弹窗内提示
        }
      };
      onMsgRef.current = handler;
      window.addEventListener("message", handler);
    },
    [refresh],
  );

  const logout = useCallback(() => {
    void fetch("/api/auth/logout", { method: "POST" }).then(() => setUser(null));
  }, []);

  useEffect(() => {
    return () => {
      if (onMsgRef.current) window.removeEventListener("message", onMsgRef.current);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, enabled, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 <AuthProvider> 内使用");
  return ctx;
}
