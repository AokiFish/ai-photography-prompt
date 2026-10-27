"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-client";

/**
 * 埋点：登录用户打开提示词详情页时，把这次浏览记录进 D1 history 表。
 * 仅登录态记录（匿名用户不写服务端）；组件无 UI，纯粹副作用。
 * useAuth 初次轮询完成后才发起请求，避免未登录瞬间误判。
 */
export function HistoryTracker({ promptId }: { promptId: string }) {
  const { user, loading } = useAuth();
  const sentRef = useRef(false);

  useEffect(() => {
    if (loading || !user || sentRef.current) return;
    sentRef.current = true;
    fetch("/api/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ promptId }),
    }).catch(() => {});
  }, [loading, user, promptId]);

  return null;
}
