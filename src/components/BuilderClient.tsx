"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUILDER_CATEGORIES,
  BUILDER_PRESETS,
  EMPTY_DETAILS,
  buildPrompt,
  emptySelection,
  randomSelection,
  selectionFromPreset,
  summaryOf,
  thumbUrl,
  type BuilderCategory,
  type BuilderDetails,
  type BuilderOption,
  type BuilderPreset,
  type BuilderSelection,
} from "@/lib/builder";
import { CopyButton } from "@/components/CopyButton";

// 提示词构建器：左边选视觉项（含预设 / 更多细节 / Realism mode），右边实时出提示词。
// 每个类目都是一个锚点区块（#cat-style … #cat-ratio），左侧索引与该导航联动。

const ONE_BTN = "mono rounded inline-flex items-center justify-center gap-2 cursor-pointer transition-all duration-200";

const DETAIL_FIELDS: { key: keyof BuilderDetails; zh: string; en: string; placeholder: string }[] = [
  { key: "details", zh: "主题详情", en: "Subject details", placeholder: "例：一位穿红色风衣的女性" },
  { key: "action", zh: "动作与姿势", en: "Action and pose", placeholder: "例：侧身回望，手插口袋" },
  { key: "env", zh: "环境", en: "Environment", placeholder: "例：雨后的东京街头，霓虹招牌" },
];

export function BuilderClient() {
  const [sel, setSel] = useState<BuilderSelection>(emptySelection);
  const [details, setDetails] = useState<BuilderDetails>(EMPTY_DETAILS);
  const [realism, setRealism] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [presetId, setPresetId] = useState<string | null>(null);
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

  // 滚动时高亮左侧索引
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

  const { prompt, negative } = useMemo(() => buildPrompt(sel, details, realism), [sel, details, realism]);
  const summary = useMemo(() => summaryOf(sel), [sel]);
  const pickedCount = summary.reduce((n, s) => n + s.opts.length, 0);
  const fullText = [prompt, negative].filter(Boolean).join("\n\n");

  const applyPreset = (p: BuilderPreset) => {
    setSel(selectionFromPreset(p));
    setRealism(!!p.realism);
    setPresetId(p.id);
    setMoreOpen(true);
  };

  const toggle = (cat: BuilderCategory, optId: string) => {
    setPresetId(null); // 手动改动后不再是「纯预设」
    setSel((prev) => {
      const cur = prev[cat.id] ?? [];
      if (cat.multi) {
        return { ...prev, [cat.id]: cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] };
      }
      return { ...prev, [cat.id]: cur[0] === optId ? [] : [optId] };
    });
  };

  const clearCat = (catId: string) => {
    setPresetId(null);
    setSel((prev) => ({ ...prev, [catId]: [] }));
  };

  const resetAll = () => {
    setSel(emptySelection());
    setDetails(EMPTY_DETAILS);
    setRealism(false);
    setPresetId(null);
    setMoreOpen(false);
  };

  const surprise = () => {
    setSel(randomSelection());
    setPresetId(null);
  };

  return (
    <div className="pad-x grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ────────── 左：预设 + 更多细节 + 维度选择 ────────── */}
      <div className="min-w-0">
        {/* 预设 */}
        <div className="rounded" style={{ background: "var(--ink-2)", border: "1px solid var(--line)", padding: 18 }}>
          <div className="kicker" style={{ marginBottom: 14 }}>
            <span className="lbl mono">预设 · PRESETS</span>
            <span className="rule" />
          </div>
          <div className="flex flex-wrap gap-2">
            {BUILDER_PRESETS.map((p) => {
              const on = presetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={ONE_BTN}
                  style={{
                    padding: "7px 12px",
                    border: `1px solid ${on ? "var(--accent)" : "var(--line-strong)"}`,
                    color: on ? "var(--accent)" : "var(--paper-2)",
                    background: on ? "var(--accent-soft)" : "transparent",
                  }}
                >
                  {p.zh}
                  <span style={{ color: "var(--faint)", textTransform: "none" }}>{p.en}</span>
                </button>
              );
            })}
          </div>

          {/* More detail（可展开） */}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={ONE_BTN}
            style={{ marginTop: 16, background: "none", border: "1px solid var(--line-strong)", color: "var(--muted)", padding: "6px 12px" }}
          >
            More detail {moreOpen ? "−" : "+"}
          </button>

          {moreOpen && (
            <div className="mt-4 flex flex-col gap-3">
              {DETAIL_FIELDS.map((f) => (
                <label key={f.key} className="flex flex-col gap-1.5">
                  <span className="mono" style={{ color: "var(--faint)" }}>
                    {f.zh} · {f.en}
                  </span>
                  <input
                    value={details[f.key]}
                    onChange={(e) => setDetails((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{
                      background: "var(--ink-3)",
                      border: "1px solid var(--line)",
                      borderRadius: 3,
                      color: "var(--paper)",
                      padding: "9px 11px",
                      fontSize: 13,
                    }}
                  />
                </label>
              ))}

              {/* Realism mode */}
              <button
                type="button"
                onClick={() => setRealism((v) => !v)}
                className="flex items-center justify-between cursor-pointer"
                style={{
                  background: realism ? "var(--accent-soft)" : "var(--ink-3)",
                  border: `1px solid ${realism ? "var(--accent)" : "var(--line)"}`,
                  borderRadius: 3,
                  padding: "11px 13px",
                }}
                aria-pressed={realism}
              >
                <span style={{ fontSize: 13.5, color: realism ? "var(--accent)" : "var(--paper-2)" }}>
                  Realism mode
                  <span className="block" style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 3 }}>
                    追加真实感提示语与排除词包
                  </span>
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 34,
                    height: 18,
                    borderRadius: 999,
                    background: realism ? "var(--accent)" : "var(--line-strong)",
                    position: "relative",
                    transition: "background .2s",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: realism ? 18 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: realism ? "#141414" : "var(--paper-2)",
                      transition: "left .2s",
                    }}
                  />
                </span>
              </button>
            </div>
          )}
        </div>

        {/* 维度索引 */}
        <nav
          className="sticky mt-6 flex flex-wrap gap-2 py-3"
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
            {fullText ? (
              <p
                style={{
                  fontFamily: "var(--font-mono),monospace",
                  fontSize: 12.5,
                  lineHeight: 1.85,
                  color: "var(--paper-2)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {fullText}
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
              onClick={surprise}
              className={ONE_BTN}
              style={{ background: "var(--accent)", color: "#141414", border: "1px solid var(--accent)", padding: "9px 14px" }}
            >
              Surprise me
            </button>
            <button
              type="button"
              onClick={resetAll}
              className={ONE_BTN}
              style={{ border: "1px solid var(--line-strong)", color: "var(--muted)", padding: "9px 14px" }}
            >
              Reset
            </button>
            {fullText && <CopyButton text={fullText} label="复制" />}
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
  const thumb = thumbUrl(option);
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
        padding: thumb ? 9 : "11px 13px",
        position: "relative",
      }}
    >
      {/* 效果参考图：让用户「看见」这个选项长什么样，而不是只念参数名 */}
      {thumb && (
        <span
          className="block"
          style={{
            aspectRatio: "4 / 3",
            overflow: "hidden",
            borderRadius: 2,
            marginBottom: 9,
            background: "var(--ink-3)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={option.zh}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </span>
      )}
      {selected && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: thumb ? 16 : 10,
            right: thumb ? 16 : 11,
            width: 7,
            height: 7,
            borderRadius: 999,
            background: "var(--accent)",
          }}
        />
      )}
      <span
        className="block"
        style={{
          fontSize: 13.5,
          color: selected ? "var(--accent)" : "var(--paper-2)",
          lineHeight: 1.45,
          paddingRight: 12,
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
