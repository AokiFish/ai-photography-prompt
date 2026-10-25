"use client";

import { useEffect, useState } from "react";
import { isSaved, toggleSaved } from "@/lib/saved";
import { showToast } from "@/lib/toast";

interface SaveButtonProps {
  id: string;
  className?: string;
}

export function SaveButton({ id, className = "" }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isSaved(id));
  }, [id]);

  function handle() {
    const now = toggleSaved(id);
    setSaved(now);
    showToast(now ? "已收藏" : "已取消收藏");
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
