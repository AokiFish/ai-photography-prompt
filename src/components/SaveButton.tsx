"use client";

import { useEffect, useState } from "react";
import { isSaved, toggleSaved } from "@/lib/saved";
import { showToast } from "@/lib/toast";
import { useAuth } from "@/lib/auth-client";

interface SaveButtonProps {
  id: string;
  className?: string;
}

export function SaveButton({ id, className = "" }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setSaved(isSaved(id));
  }, [id]);

  // 登录态下，把本地收藏变更同步进 D1（本地仍保留，二者取并集）。
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/saved", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ids?: string[] } | null) => {
        if (cancelled || !data?.ids) return;
        const on = isSaved(id);
        const inCloud = data.ids.includes(id);
        // 仅当本地和云端不一致时才补齐云端（不覆盖用户刚点的本地操作）
        if (on && !inCloud) syncToCloud(id, true);
        else if (!on && inCloud) syncToCloud(id, false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  function syncToCloud(pid: string, wantSaved: boolean) {
    fetch("/api/saved", {
      method: wantSaved ? "POST" : "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ promptId: pid }),
    }).catch(() => {});
  }

  function handle() {
    const now = toggleSaved(id);
    setSaved(now);
    showToast(now ? "已收藏" : "已取消收藏");
    if (user) syncToCloud(id, now);
  }

  return (
    <button
      type="button"
      onClick={handle}
      aria-pressed={saved}
      aria-label={saved ? "取消收藏" : "收藏"}
      className={`copy inline-flex items-center gap-2 ${saved ? "done" : ""} ${className}`}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
      </svg>
      <span>{saved ? "已藏" : "收藏"}</span>
    </button>
  );
}
