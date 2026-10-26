"use client";

import { useState, type CSSProperties } from "react";
import { showToast } from "@/lib/toast";

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  /** 额外样式（详情页底部的大号「Copy Prompt」按钮用） */
  style?: CSSProperties;
}

export function CopyButton({
  text,
  label = "复制",
  copiedLabel = "已复制",
  className = "",
  style,
}: CopyButtonProps) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setDone(true);
      showToast(copiedLabel);
      setTimeout(() => setDone(false), 1400);
    } catch {
      showToast("复制失败，请手动选择");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`copy inline-flex items-center gap-2 ${done ? "done" : ""} ${className}`}
      style={style}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 0 0 1 2-2h10" />
      </svg>
      <span>{done ? copiedLabel : label}</span>
    </button>
  );
}
