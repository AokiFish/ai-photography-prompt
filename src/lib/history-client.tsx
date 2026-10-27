"use client";

import { useCallback } from "react";
import { useAuth } from "./auth-client";
import { pushLocalHistory, type HistorySource } from "./history-store";

// 统一的「保存一条提示到历史」入口：
// - 登录：POST /api/history 进云端（服务端负责去重 + 500 上限淘汰）
// - 未登录：push 进 localStorage（最多 20，本地去重）
export function useHistory() {
  const { user } = useAuth();

  const save = useCallback(
    async (
      text: string,
      opts: { source: HistorySource; promptId?: string; promptSlug?: string | null },
    ) => {
      const t = (text ?? "").trim();
      if (!t) return;
      if (user) {
        try {
          await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptText: t, promptId: opts.promptId, source: opts.source }),
          });
        } catch {
          /* 网络错误忽略：历史保存是尽力而为，不应打断主流程 */
        }
      } else {
        pushLocalHistory({
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : String(Date.now()),
          promptId: opts.promptId,
          promptSlug: opts.promptSlug,
          promptText: t,
          source: opts.source,
          createdAt: Date.now(),
        });
      }
    },
    [user],
  );

  return { save };
}
