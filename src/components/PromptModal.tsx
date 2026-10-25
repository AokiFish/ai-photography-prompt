"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Prompt } from "@/lib/types";
import { STYLE_LABELS, STYLE_INTRO, PRO_CATEGORIES, resolveOwnSiteUrl } from "@/lib/types";
import { PlateImage } from "@/components/PlateImage";
import { CopyButton } from "@/components/CopyButton";
import { SaveButton } from "@/components/SaveButton";

export function PromptModal({ prompt, onClose }: { prompt: Prompt; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // 主按钮：跳站内详情页 /prompt/<slug>（每张图在自己站上的独立页面）。
  const ownUrl = resolveOwnSiteUrl(prompt);
  // 徽标只显示**专业分类**（官方 12 类）；确实没有分类数据时才回退摄影风格。
  const catLabel = PRO_CATEGORIES[prompt.category ?? ""] ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={prompt.title ?? "提示词详情"}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      style={{ background: "rgba(8,8,8,.82)", backdropFilter: "blur(6px)", animation: "pmFade .25s ease" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative grid max-h-[90vh] w-full max-w-[1000px] grid-cols-1 overflow-hidden border md:grid-cols-[1.05fr_1fr]"
        style={{ background: "var(--ink-2)", borderColor: "var(--line-strong)", animation: "pmPop .3s cubic-bezier(.2,.7,.2,1)" }}
      >
        <button
          onClick={onClose}
          aria-label="关闭"
          className="mono absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded"
          style={{ background: "rgba(20,20,20,.7)", color: "var(--paper)", border: "1px solid var(--line-strong)", fontSize: 18 }}
        >
          ×
        </button>

        {/* 大图 */}
        <div className="relative min-h-[260px] bg-ink md:min-h-[560px]">
          <PlateImage
            src={prompt.imageUrl}
            alt={prompt.title ?? prompt.promptText.slice(0, 40)}
            styleKey={prompt.style}
            bare
          />
        </div>

        {/* 详情 */}
        <div className="flex max-h-[90vh] flex-col overflow-y-auto p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono rounded" style={{ background: "rgba(237,231,218,.1)", color: "var(--paper-2)", padding: "4px 9px" }}>
              {catLabel ?? STYLE_LABELS[prompt.style]}
            </span>
          </div>

          {prompt.title && (
            <h2 className="serif mt-4" style={{ fontSize: "clamp(22px,3vw,30px)", fontWeight: 500, lineHeight: 1.2 }}>
              {prompt.title}
            </h2>
          )}

          {/* 类型介绍 */}
          <div className="mt-5">
            <span className="lbl mono">类型介绍 · {STYLE_LABELS[prompt.style]}</span>
            <p className="mt-2" style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.85 }}>
              {STYLE_INTRO[prompt.style]}
            </p>
          </div>

          {/* 完整提示词 */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span className="lbl mono">完整提示词</span>
              <CopyButton text={prompt.promptText} label="复制" />
            </div>
            <p
              className="mt-2 rounded"
              style={{ background: "var(--ink-3)", border: "1px solid var(--line)", padding: "14px 16px", fontFamily: "var(--font-mono),monospace", fontSize: 12.5, lineHeight: 1.75, color: "var(--paper-2)", whiteSpace: "pre-wrap" }}
            >
              {prompt.promptText}
            </p>
          </div>

          {prompt.negativePrompt && (
            <div className="mt-4">
              <span className="lbl mono" style={{ color: "var(--faint)" }}>反向提示词</span>
              <p
                className="mt-2 rounded"
                style={{ background: "var(--ink-3)", border: "1px solid var(--line)", padding: "12px 16px", fontFamily: "var(--font-mono),monospace", fontSize: 12, lineHeight: 1.7, color: "var(--faint)", whiteSpace: "pre-wrap" }}
              >
                {prompt.negativePrompt}
              </p>
            </div>
          )}

          {prompt.tags && prompt.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {prompt.tags.map((t) => (
                <span key={t} className="mono rounded" style={{ border: "1px solid var(--line)", color: "var(--muted)", padding: "3px 9px", fontSize: 11 }}>
                  #{t}
                </span>
              ))}
            </div>
          )}

          {prompt.model && (
            <p className="mono mt-4" style={{ color: "var(--faint)", fontSize: 11.5 }}>
              模型 · {prompt.model}
              {prompt.width ? ` · ${prompt.width}×${prompt.height}` : ""}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
            <SaveButton id={prompt.id} />
            {ownUrl && (
              <Link
                href={ownUrl}
                className="mono rounded"
                style={{ background: "var(--accent)", color: "#141414", border: "1px solid var(--accent)", padding: "9px 16px", fontSize: 11.5 }}
              >
                打开完整网页 ↗
              </Link>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes pmFade{from{opacity:0}to{opacity:1}}@keyframes pmPop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
