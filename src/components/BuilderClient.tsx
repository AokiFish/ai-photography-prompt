"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUILDER_CATEGORIES,
  buildPrompt,
  emptySelection,
  randomSelection,
  summaryOf,
  type BuilderCategory,
  type BuilderOption,
  type BuilderSelection,
} from "@/lib/builder";
import { CopyButton } from "@/components/CopyButton";

// 提示词构建器：左边选视觉项，右边实时出一条英文提示词。
// 每个类目都是一个锚点区块（#cat-style … #cat-ratio），左侧索引与该导航联动。

const ONE_BTN = "mono rounded inline-flex items-center justify-center gap-2 cursor-pointer transition-all duration-200";

export function BuilderClient() {
  const [sel, setSel] = useState<BuilderSelection>(emptySelection);
  const [active, setActive] = useState<string>(BUILDER_CATEGORIES[0].id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // hash 变化（含首次进入 /builder/#cat-light）→ 滚动到对应区块并高亮
  useEffect(() => {
    const go = () => {
      const id = window.location.hash.replace(/^#cat-/, "");
      if (!id) return;
      const el = sectionRefs.current[id];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(id);
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);

  // 滚动时高亮左侧索引（用 IntersectionObserver，避免频繁 scroll 计算）
  useEffect(() => {
    const els = BUILDER_CATEGORIES.map((c) => sectionRefs.current[c.id]).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id.replace(/^cat-/, ""));
      },
      { rootMargin: "-72px 0px -60% 0px", threshold: 0.01 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const prompt = useMemo(() => buildPrompt(sel), [sel]);
  const summary = useMemo(() => summaryOf(sel), [sel]);
  const pickedCount = summary.reduce((n, s) => n + s.opts.length, 0);

  const toggle = (cat: BuilderCategory, optId: string) => {
    setSel((prev) => {
      const cur = prev[cat.id] ?? [];
      if (cat.multi) {
        return { ...prev, [cat.id]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
      }
      return { ...prev, [cat.id]: cur[0] === optId ? [] : [optId] };
    });
  };

  const clearCat = (catId: string) => setSel((prev) => ({ ...prev, [catId]: [] }));

  return (
    <div className="pad-x grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ────────── 左：类目索引 + 选择区 ────────── */}
      <div className="min-w-0">
        <nav
          className="sticky flex flex-wrap gap-2 py-3"
          style={{ top: 64, zIndex: 60, background: "var(--ink)", borderBottom: "1px solid var(--line)" }}
          aria-label="构建维度"
        >
          {BUILDER_CATEGORIES.map((c) => {
            const on = active === c.id;
            const has = (sel[c.id] ?? []).length > 0;
            return (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                className={ONE_BTN}
                style={{
                  padding: "5px 11px",
                  border: `1px solid ${on ? "var(--accent)" : "var(--line-strong)"}`,
                  color: on ? "var(--accent)" : has ? "var(--paper-2)" : "var(--muted)",
                  background: on ? "var(--accent-soft)" : "transparent",
                }}
              >
                {c.zh}
                {has && <span style={{ color: "var(--accent)" }}>·</span>}
              </a>
            );
          })}
        </nav>

        <div className="mt-8 flex flex-col gap-9">
          {BUILDER_CATEGORIES.map((c) => (
            <section
              key={c.id}
              id={`cat-${c.id}`}
              ref={(el) => {
                sectionRefs.current[c.id] = el;
              }}
              style={{ scrollMarginTop: 132 }}
            >
              <div className="kicker" style={{ marginBottom: 16 }}>
                <span className="lbl mono">
                  {c.zh} · {c.en}
                </span>
                <span className="rule" />
                {(sel[c.id] ?? []).length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearCat(c.id)}
                    className="mono cursor-pointer"
                    style={{ color: "var(--faint)", background: "none", border: "none" }}
                  >
                    清除
                  </button>
                )}
              </div>
              <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 14 }}>
                {c.hint}
                {c.multi && <span style={{ color: "var(--accent)" }}> 可多选。</span>}
              </p>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {c.options.map((o) => (
                  <OptionTile
                    key={o.id}
                    option={o}
                    selected={(sel[c.id] ?? []).includes(o.id)}
                    onToggle={() => toggle(c, o.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* ────────── 右：实时面板（Surprise me / Reset） ────────── */}
      <aside className="min-w-0">
        <div
          className="sticky flex flex-col gap-4 rounded"
          style={{
            top: 100,
            background: "var(--ink-2)",
            border: "1px solid var(--line-strong)",
            padding: 20,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="lbl mono">实时提示词 · LIVE</span>
            <span className="mono" style={{ color: "var(--faint)" }}>
              {pickedCount} 项
            </span>
          </div>

          <div
            style={{
              background: "var(--ink-3)",
              border: "1px solid var(--line)",
              borderRadius: 4,
              padding: 14,
              minHeight: 140,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {prompt ? (
              <p style={{ fontFamily: "var(--font-mono),monospace", fontSize: 12.5, lineHeight: 1.85, color: "var(--paper-2)", whiteSpace: "pre-wrap" }}>
                {prompt}
              </p>
            ) : (
              <p className="mono" style={{ color: "var(--faint)", lineHeight: 1.9, textTransform: "none" }}>
                还没有选择 — 点亮左边的选项开始拼装，<br />
                或直接按一下「Surprise me」。
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSel(randomSelection())}
              className={ONE_BTN}
              style={{ background: "var(--accent)", color: "#141414", border: "1px solid var(--accent)", padding: "9px 14px" }}
            >
              Surprise me
            </button>
            <button
              type="button"
              onClick={() => setSel(emptySelection())}
              className={ONE_BTN}
              style={{ border: "1px solid var(--line-strong)", color: "var(--muted)", padding: "9px 14px" }}
            >
              Reset
            </button>
            {prompt && (
              <CopyButton
                text={prompt}
                label="复制"
                className="mono rounded"
              />
            )}
          </div>

          {summary.length > 0 && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <span className="lbl mono" style={{ color: "var(--faint)" }}>
                已选摘要
              </span>
              <ul className="mt-2.5 flex flex-col gap-2">
                {summary.map(({ cat, opts }) => (
                  <li key={cat.id} className="flex gap-3" style={{ fontSize: 13 }}>
                    <span className="mono shrink-0" style={{ color: "var(--faint)", width: 74, paddingTop: 2 }}>
                      {cat.zh}
                    </span>
                    <span style={{ color: "var(--paper-2)", lineHeight: 1.7 }}>{opts.map((o) => o.zh).join("、")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function OptionTile({
  option,
  selected,
  onToggle,
}: {
  option: BuilderOption;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className="cursor-pointer text-left transition-all duration-200"
      style={{
        background: selected ? "var(--accent-soft)" : "var(--ink-2)",
        border: `1px solid ${selected ? "var(--accent)" : "var(--line)"}`,
        borderRadius: 3,
        padding: "11px 13px",
      }}
    >
      <span
        className="block"
        style={{
          fontSize: 13.5,
          color: selected ? "var(--accent)" : "var(--paper-2)",
          lineHeight: 1.45,
        }}
      >
        {option.zh}
      </span>
      <span className="block" style={{ fontSize: 11.5, color: "var(--faint)", lineHeight: 1.6, marginTop: 3 }}>
        {option.desc}
      </span>
    </button>
  );
}
