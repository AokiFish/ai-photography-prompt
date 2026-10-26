"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUILDER_CATEGORIES,
  BUILDER_PRESETS,
  EMPTY_DETAILS,
  SCENE_PLACEHOLDER,
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

// 提示词构建器：顶部写「画面里有什么」，下面点亮视觉项，右侧实时拼出提示词。
// 每个类目都是一个锚点区块（#cat-style … #cat-ratio），左侧索引与该导航联动。

const ONE_BTN = "mono rounded inline-flex items-center justify-center gap-2 cursor-pointer transition-all duration-200";

const DETAIL_FIELDS: { key: keyof BuilderDetails; zh: string; en: string; placeholder: string }[] = [
  {
    key: "details",
    zh: "主题详情",
    en: "Subject details",
    placeholder: "年龄、外貌、衣着、发型、妆容。\n例：late 20s, curly red hair, oversized denim",
  },
  {
    key: "action",
    zh: "动作与姿势",
    en: "Action and pose",
    placeholder: "在做什么。\n例：laughing while turning away, one hand in her hair",
  },
  {
    key: "env",
    zh: "环境",
    en: "Environment",
    placeholder: "在哪里发生。\n例：an empty roadside gas station at night, wet asphalt",
  },
];

export function BuilderClient() {
  const [sel, setSel] = useState<BuilderSelection>(emptySelection);
  const [subject, setSubject] = useState("");
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

  const { prompt, negative } = useMemo(
    () => buildPrompt(sel, details, realism, subject),
    [sel, details, realism, subject]
  );
  const summary = useMemo(() => summaryOf(sel), [sel]);
  const pickedCount = summary.reduce((n, s) => n + s.opts.length, 0);
  const fullText = [prompt, negative].filter(Boolean).join("\n\n");

  const applyPreset = (p: BuilderPreset) => {
    setSel(selectionFromPreset(p));
    setRealism(!!p.realism);
    setPresetId(p.id);
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
    setSubject("");
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
      {/* ────────── 左：场景描述 + 预设 + 更多细节 + 维度选择 ────────── */}
      <div className="min-w-0">
        <div className="rounded" style={{ background: "var(--ink-2)", border: "1px solid var(--line)" }}>
          {/* 场景描述：写的内容就是右侧提示词的第一段 */}
          <label className="block">
            <span className="sr-only">画面里有什么</span>
            <textarea
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="画面里有什么？例：An old woman selling flowers at a market at dawn"
              rows={3}
              className="w-full"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--paper)",
                padding: "18px 20px",
                fontSize: 16,
                lineHeight: 1.7,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </label>

          {/* 预设：与场景描述同一张卡片，点一下整套铺开并同步到右侧提示词 */}
          <div style={{ borderTop: "1px solid var(--line)", padding: "14px 16px 16px" }}>
            <div className="flex items-start gap-3">
              <span className="mono shrink-0" style={{ color: "var(--faint)", paddingTop: 8, width: 74 }}>
                预设 Presets
              </span>
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
                        textTransform: "none",
                      }}
                    >
                      {p.en}
                      <span style={{ color: on ? "var(--accent)" : "var(--faint)" }}>{p.zh}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* More detail（左） + Realism mode（右） */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={ONE_BTN}
            style={{
              background: moreOpen ? "var(--accent-soft)" : "var(--ink-2)",
              border: `1px solid ${moreOpen ? "var(--accent)" : "var(--line-strong)"}`,
              color: moreOpen ? "var(--accent)" : "var(--paper-2)",
              padding: "9px 14px",
              textTransform: "none",
            }}
          >
            {moreOpen ? "−" : "+"} More detail <span style={{ color: "var(--faint)" }}>更多细节</span>
          </button>

          <div className="flex items-center gap-3">
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 13.5, color: realism ? "var(--accent)" : "var(--paper-2)" }}>Realism mode</span>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--faint)", marginTop: 2 }}>
                追加真实感提示与负向词包
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRealism((v) => !v)}
              aria-pressed={realism}
              aria-label="Realism mode"
              className="cursor-pointer"
              style={{
                width: 46,
                height: 24,
                borderRadius: 999,
                background: realism ? "var(--accent)" : "var(--line-strong)",
                position: "relative",
                transition: "background .2s",
                border: "none",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: realism ? 25 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  background: realism ? "#141414" : "var(--paper-2)",
                  transition: "left .2s",
                }}
              />
            </button>
          </div>
        </div>

        {/* 更多细节：三个文本框（与右侧提示词同步） */}
        {moreOpen ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {DETAIL_FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1.5">
                <span style={{ fontSize: 13, color: "var(--paper-2)" }}>
                  {f.en} <span style={{ color: "var(--faint)" }}>{f.zh}</span>
                </span>
                <textarea
                  value={details[f.key]}
                  onChange={(e) => setDetails((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={3}
                  style={{
                    background: "var(--ink-2)",
                    border: "1px solid var(--line)",
                    borderRadius: 3,
                    color: "var(--paper)",
                    padding: "9px 11px",
                    fontSize: 12.5,
                    lineHeight: 1.7,
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-3" style={{ color: "var(--faint)", fontSize: 12.5, lineHeight: 1.8 }}>
            只描述图片里的内容。任何语言都可以。
          </p>
        )}

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

      {/* ────────── 右：实时面板 ────────── */}
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
              minHeight: 150,
              maxHeight: 320,
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
                  wordBreak: "break-word",
                }}
              >
                {/* 场景描述占位符高亮，让用户一眼看见「这里要填拍什么」 */}
                {prompt.startsWith(SCENE_PLACEHOLDER) ? (
                  <>
                    <mark
                      style={{
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        borderRadius: 2,
                        padding: "0 2px",
                      }}
                    >
                      {SCENE_PLACEHOLDER}
                    </mark>
                    {prompt.slice(SCENE_PLACEHOLDER.length)}
                  </>
                ) : (
                  prompt
                )}
                {negative && (
                  <>
                    {"\n\n"}
                    <span style={{ color: "var(--faint)" }}>{negative}</span>
                  </>
                )}
              </p>
            ) : (
              <p className="mono" style={{ color: "var(--faint)", lineHeight: 1.9, textTransform: "none" }}>
                先在上面写一句「画面里有什么」，<br />
                再点亮左边的选项——这里会实时长成一条提示词。
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
      {/* 选中打勾：一眼看出「这条提示词用了哪些词」 */}
      {selected && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: thumb ? 16 : 10,
            right: thumb ? 16 : 11,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: "var(--accent)",
            color: "#141414",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          ✓
        </span>
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
