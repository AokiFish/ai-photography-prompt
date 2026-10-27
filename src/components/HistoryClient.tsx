"use client";

import { useEffect, useState } from "react";
import { readLocalHistory, type HistoryItem, type LocalHistoryItem } from "@/lib/history-store";
import { CopyButton } from "./CopyButton";
import { Reveal } from "./Reveal";

const SOURCE_LABEL: Record<string, string> = {
  refine: "精炼",
  builder: "构建器",
  gallery: "图集",
};

function toItem(l: LocalHistoryItem): HistoryItem {
  return {
    id: l.id,
    text: l.promptText,
    source: l.source,
    createdAt: l.createdAt,
    openHref: l.promptSlug ? `/prompt/${l.promptSlug}` : undefined,
  };
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// items 为 null → 本地模式（未登录，客户端读 localStorage，最多 20）
// items 为数组 → 云端模式（已登录，服务端已读取最多 500 条）
export function HistoryClient({ items }: { items: HistoryItem[] | null }) {
  const [local, setLocal] = useState<HistoryItem[] | null>(null);

  useEffect(() => {
    if (items === null) setLocal(readLocalHistory().map(toItem));
  }, [items]);

  const list = items === null ? (local ?? []) : items;
  const isLocal = items === null;

  return (
    <div className="pad-x" style={{ paddingTop: "clamp(40px,7vh,80px)", paddingBottom: "clamp(60px,9vh,110px)" }}>
      <Reveal>
        <div className="kicker" style={{ marginBottom: 22 }}>
          <span className="lbl mono">历史 · HISTORY</span>
          <span className="rule" />
          <span className="mono" style={{ color: "var(--faint)" }}>
            {isLocal ? `本机 · ${list.length}/20` : `云端 · ${list.length}/500`}
          </span>
        </div>
        <h1 className="display" style={{ fontSize: "clamp(34px,6vw,72px)", marginBottom: 14 }}>
          提示词历史
        </h1>
        <p style={{ maxWidth: "44em", color: "var(--muted)", fontSize: 15, lineHeight: 1.8 }}>
          你用 AI 精炼、在构建器复制、或在详情页复制过的提示词都会保存在这里。
          {isLocal
            ? "当前未登录，仅存本机最近 20 条；登录后会合并进云端（最多 500 条）。"
            : "登录状态下保存，跨设备同步，超出 500 条自动移除最早的。"}
        </p>
      </Reveal>

      <div className="mt-9">
        {list.length === 0 ? (
          <div className="py-20 text-center">
            <p className="serif" style={{ fontSize: 24, color: "var(--muted)" }}>
              还没有记录
            </p>
            <p className="mono mt-3" style={{ color: "var(--faint)" }}>
              用「用 AI 精炼」、在构建器点「复制」、或在详情页复制提示词，都会自动出现在这里
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {list.map((it) => (
              <li key={it.id} className="hairline">
                <div className="flex flex-col gap-2 py-4" style={{ paddingLeft: 8, paddingRight: 8 }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="mono rounded"
                      style={{ background: "rgba(237,231,218,.1)", color: "var(--paper-2)", padding: "2px 7px", fontSize: 10 }}
                    >
                      {SOURCE_LABEL[it.source] ?? it.source}
                    </span>
                    <span className="mono" style={{ color: "var(--faint)", fontSize: 11 }}>
                      {fmtTime(it.createdAt)}
                    </span>
                    {it.openHref && (
                      <a href={it.openHref} className="mono" style={{ color: "var(--accent)", fontSize: 11 }}>
                        重新打开 ↗
                      </a>
                    )}
                  </div>
                  <p
                    className="rounded"
                    style={{
                      background: "var(--ink-3)",
                      border: "1px solid var(--line)",
                      padding: "12px 14px",
                      fontFamily: "var(--font-mono),monospace",
                      fontSize: 12.5,
                      lineHeight: 1.8,
                      color: "var(--paper-2)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      // 内联截断（不用 Tailwind line-clamp 类，避免线上未生效）：最多 4 行预览
                      display: "-webkit-box",
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      maxHeight: "calc(4 * 1.8 * 12.5px)",
                    }}
                  >
                    {it.text}
                  </p>
                  <div>
                    <CopyButton text={it.text} label="复制" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
