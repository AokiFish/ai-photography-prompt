"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-client";

/**
 * 导航栏右侧的登录态入口：未登录显示 GitHub / Google 登录按钮；
 * 已登录显示头像 + 名称 + 登出。按钮可用性由 /api/auth/config 决定（缺密钥置灰）。
 */
export function UserMenu() {
  const { user, loading, enabled, login, logout } = useAuth();
  const [busy, setBusy] = useState<"github" | "google" | null>(null);

  if (loading) {
    return <span className="mono" style={{ color: "var(--faint)" }}>…</span>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-2.5">
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar}
            alt=""
            width={26}
            height={26}
            className="h-[26px] w-[26px] rounded-full border object-cover"
            style={{ borderColor: "var(--line-strong)" }}
          />
        ) : (
          <span
            className="grid h-[26px] w-[26px] place-items-center rounded-full"
            style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 12 }}
          >
            {(user.name || "?").slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[120px] truncate text-[13px] sm:inline" style={{ color: "var(--paper)" }}>
          {user.name}
        </span>
        <button
          type="button"
          onClick={logout}
          className="mono rounded px-2 py-1 transition-colors"
          style={{ color: "var(--muted)", border: "1px solid var(--line)" }}
        >
          登出
        </button>
      </div>
    );
  }

  const Btn = ({ p, label }: { p: "github" | "google"; label: string }) => (
    <button
      type="button"
      disabled={!enabled[p] || busy !== null}
      onClick={() => {
        setBusy(p);
        login(p);
        // 弹窗关闭后（无论成败）解除忙碌态
        setTimeout(() => setBusy(null), 1200);
      }}
      title={enabled[p] ? `用 ${label} 登录` : `未配置 ${label} 登录（需在 Cloudflare 配密钥）`}
      className="mono rounded px-2.5 py-1 transition-colors disabled:opacity-40"
      style={{ color: "var(--paper)", border: "1px solid var(--line)" }}
    >
      {busy === p ? "…" : label}
    </button>
  );

  return (
    <div className="flex items-center gap-2">
      <Btn p="github" label="GitHub" />
      <Btn p="google" label="Google" />
    </div>
  );
}
