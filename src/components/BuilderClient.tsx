"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUILDER_CATEGORIES,
  BUILDER_MODELS,
  BUILDER_PRESETS,
  EMPTY_DETAILS,
  REALISM_NOTE,
  SCENE_PLACEHOLDER,
  buildSegments,
  emptySelection,
  randomSelection,
  renderPrompt,
  selectionFromPreset,
  summaryOf,
  thumbUrl,
  type BuilderCategory,
  type BuilderDetails,
  type BuilderModel,
  type BuilderOption,
  type BuilderPreset,
  type BuilderSelection,
} from "@/lib/builder";
import { CopyButton } from "@/components/CopyButton";
import { RefineModelPicker } from "@/components/RefineModelPicker";
import { SERVER_MODEL_ID, findModel } from "@/lib/refine-models";
import { showToast } from "@/lib/toast";

// 提示词构建器：顶部写「画面里有什么」，下面点亮视觉项，右侧按模型实时出提示词。
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
  const [model, setModel] = useState<BuilderModel["id"]>("nat");
  const [refining, setRefining] = useState(false);
  const [modelId, setModelId] = useState<string>(SERVER_MODEL_ID);
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

  const { segments, negative } = useMemo(
    () => buildSegments(sel, details, realism, subject),
    [sel, details, realism, subject]
  );
  const rendered = useMemo(() => renderPrompt(model, segments, negative), [model, segments, negative]);
  const summary = useMemo(() => summaryOf(sel), [sel]);
  const pickedCount = summary.reduce((n, s) => n + s.opts.length, 0);
  const activeModel = BUILDER_MODELS.find((m) => m.id === model)!;

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

  /** 用 AI 精炼：把场景描述（没有就整条提示词）交给大模型润色，结果写回场景框。 */
  const refineWithAI = async () => {
    if (refining) return;
    const input = subject.trim() || rendered.replace(/\n+/g, " ").trim();
    if (!input) {
      showToast("先写点内容再精炼");
      return;
    }
    setRefining(true);
    try {
      // 选了自定义模型就带上它的配置；选「服务端配置」则一个都不传，让服务端用环境变量
      const m = modelId === SERVER_MODEL_ID ? null : findModel(modelId);
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input,
          ...(m ? { baseUrl: m.baseUrl, model: m.model, apiKey: m.apiKey } : {}),
        }),
      });
      const data = (await res.json()) as { text?: string; error?: string; detail?: string; hint?: string };
      if (!res.ok || !data.text) {
        // 把服务端给的诊断信息也说出来（只含变量名/状态，不含密钥）
        const parts = [data.error ?? "精炼失败", data.hint, data.detail].filter(Boolean).join(" · ");
        showToast(`精炼失败：${parts}`.slice(0, 120));
        return;
      }
      setSubject(data.text.trim());
      showToast("已用 AI 精炼");
    } catch {
      showToast("精炼失败：网络错误");
    } finally {
      setRefining(false);
    }
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

            {/* 用 AI 精炼 */}
            <div
              className="mt-3 flex flex-wrap items-center justify-between gap-3"
              style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}
            >
              <div className="flex flex-wrap items-center gap-3">
                {/* 模型选择 / 添加（服务端默认 or 用户自己的模型） */}
                <RefineModelPicker value={modelId} onChange={setModelId} />
                <span style={{ fontSize: 12.5, color: "var(--faint)", lineHeight: 1.6 }}>
                  用大模型把这段描述润色成更地道的英文提示词
                </span>
              </div>
              <button
                type="button"
                onClick={refineWithAI}
                disabled={refining}
                className={ONE_BTN}
                style={{
                  padding: "7px 13px",
                  border: "1px solid var(--accent)",
                  color: refining ? "var(--faint)" : "var(--accent)",
                  background: refining ? "transparent" : "var(--accent-soft)",
                  opacity: refining ? 0.7 : 1,
                  textTransform: "none",
                }}
              >
                {refining ? "精炼中…" : "✨ 用 AI 精炼"}
              </button>
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

        {/* Realism mode 开启时的说明 */}
        {realism && (
          <p className="mt-3 rounded" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)", padding: "10px 13px", fontSize: 12.5, lineHeight: 1.7, color: "var(--paper-2)" }}>
            {REALISM_NOTE.en}
            <br />
            <span style={{ color: "var(--accent)" }}>{REALISM_NOTE.zh}</span>
          </p>
        )}

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
              // 与图集筛选一致：无边框胶囊，靠颜色表态（样式见 globals.css 的 .filter-chip）。
              // ⚠ 只改样式：href 锚点跳转、滚动高亮（IntersectionObserver）、已选圆点都保持原样。
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                className="mono filter-chip"
                data-active={on}
                aria-current={on ? "true" : undefined}
                style={{ padding: "5px 11px" }}
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

      {/* ────────── 右：模型切换 + 实时提示词 ────────── */}
      <aside className="min-w-0">
        <div
          className="sticky flex flex-col gap-4 rounded"
          style={{
            top: 100,
            background: "var(--ink-2)",
            border: "1px solid var(--line-strong)",
            padding: 20,
            // 全右栏**唯一**的滚动条就在这里：面板限高 + 自身滚动，
            // 里面的提示词框/摘要都自适应高度、不各自滚动。
            maxHeight: "calc(100vh - 124px)",
            overflowY: "auto",
            scrollbarGutter: "stable",
            overscrollBehavior: "contain",
          }}
        >
          {/* 标题行在最上：左边 LIVE 标签，右边已选数量（只要中文，不再写 selected） */}
          <div className="flex items-center justify-between" style={{ flexShrink: 0 }}>
            <span className="lbl mono">实时提示词 · LIVE</span>
            <span className="mono" style={{ color: "var(--faint)", textTransform: "none" }}>
              {pickedCount} 已选中
            </span>
          </div>

          <div className="flex flex-wrap gap-2" style={{ flexShrink: 0 }}>
            {BUILDER_MODELS.map((m) => {
              const on = model === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModel(m.id)}
                  className={ONE_BTN}
                  style={{
                    padding: "5px 10px",
                    border: `1px solid ${on ? "var(--accent)" : "var(--line-strong)"}`,
                    color: on ? "var(--accent)" : "var(--muted)",
                    background: on ? "var(--accent-soft)" : "transparent",
                    textTransform: "none",
                  }}
                >
                  {m.en}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 11.5, color: "var(--faint)", lineHeight: 1.6, marginTop: -8, flexShrink: 0 }}>
            {activeModel.note}
          </p>

          <div
            style={{
              background: "var(--ink-3)",
              border: "1px solid var(--line)",
              borderRadius: 4,
              padding: 14,
              // ⚠ 这个框**不自己滚动**：文本自适应高度，生成多少就多长。
              // 全右栏只有面板一层滚动条（见外层 maxHeight + overflowY:auto）。
              // 不要再给它加 maxHeight / overflow，否则会多出一条滚动条（用户明确反对）。
              // flexShrink:0 —— 面板限高时禁止被压缩，否则内容会溢出并盖住下面的「已选摘要」。
              minHeight: 150,
              flexShrink: 0,
            }}
          >
            {rendered ? (
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
                {rendered.startsWith(SCENE_PLACEHOLDER) ? (
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
                    {rendered.slice(SCENE_PLACEHOLDER.length)}
                  </>
                ) : (
                  rendered
                )}
              </p>
            ) : (
              <p className="mono" style={{ color: "var(--faint)", lineHeight: 1.9, textTransform: "none" }}>
                先在上面写一句「画面里有什么」，<br />
                再点亮左边的选项——这里会实时长成一条提示词。
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2" style={{ flexShrink: 0 }}>
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
            {rendered && <CopyButton text={rendered} label="复制" />}
          </div>

          {/* 摘要同样不自己滚动：交给整块面板那唯一的滚动条 */}
          {summary.length > 0 && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, flexShrink: 0 }}>
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
        // 16px 圆角（与源站卡片一致）；内层缩略图小一圈（16 - 9 内边距 ≈ 8），转角才协调
        borderRadius: 16,
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
            borderRadius: 8,
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
