"use client";

import { useEffect, useState } from "react";
import { PromptCard } from "@/components/PromptCard";
import { Reveal } from "@/components/Reveal";
import { getSaved, onSavedChange } from "@/lib/saved";
import { SEED_PROMPTS } from "@/data/seed";
import type { Prompt } from "@/lib/types";

export default function SavedPage() {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSavedIds(getSaved());
    setLoaded(true);
    const off = onSavedChange(setSavedIds);
    return () => off();
  }, []);

  const all = SEED_PROMPTS;

  const saved = all.filter((p) => savedIds.includes(p.id));

  return (
    <div className="pad-x" style={{ paddingTop: "clamp(40px,7vh,80px)", paddingBottom: "clamp(60px,9vh,110px)" }}>
      <Reveal>
        <div className="kicker" style={{ marginBottom: 22 }}>
          <span className="lbl mono">收藏 · SAVED</span>
          <span className="rule" />
          <span className="mono" style={{ color: "var(--faint)" }}>{saved.length} 条</span>
        </div>
        <h1 className="display" style={{ fontSize: "clamp(34px,6vw,72px)", marginBottom: 14 }}>
          我的收藏夹
        </h1>
        <p style={{ maxWidth: "42em", color: "var(--muted)", fontSize: 15, lineHeight: 1.8 }}>
          收藏保存在本机浏览器（localStorage），无需登录。换设备不会同步——这是有意保持轻量的设计。
        </p>
      </Reveal>

      {!loaded ? (
        <p className="mono py-20 text-center" style={{ color: "var(--faint)" }}>读取中…</p>
      ) : saved.length === 0 ? (
        <div className="py-20 text-center">
          <p className="serif" style={{ fontSize: 24, color: "var(--muted)" }}>还没有收藏</p>
          <p className="mono mt-3" style={{ color: "var(--faint)" }}>
            去 <a href="/gallery" style={{ color: "var(--accent)" }}>图集</a> 点「收藏」即可出现在这里
          </p>
        </div>
      ) : (
        <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {saved.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) as 0 | 1 | 2 | 3}>
              <PromptCard prompt={p} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
