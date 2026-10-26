"use client";

import type { Prompt } from "@/lib/types";
import { PRO_CATEGORIES } from "@/lib/types";
import { PlateImage } from "@/components/PlateImage";
import { CopyButton } from "@/components/CopyButton";
import { SaveButton } from "@/components/SaveButton";

// 卡片徽标与文本一律显示**专业分类**（官方 12 类中文标签）。
// 不显示摄影风格（style）——那会冒出「其他 / 人像」这类用户不要的词。
const categoryLabel = (p: Prompt) => PRO_CATEGORIES[p.category ?? ""] ?? null;

export function PromptCard({ prompt, onOpen }: { prompt: Prompt; onOpen?: () => void }) {
  const catLabel = categoryLabel(prompt);
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.();
        }
      }}
      className="group relative flex cursor-pointer flex-col border border-line bg-ink-2 transition-[transform,border-color] duration-500 ease-editorial hover:-translate-y-1 hover:border-line-strong"
      // 圆角与源站一致：rounded-2xl = 1rem = 16px（实测 prmpt.it.com 卡片用 1rem）
      style={{ borderRadius: 16, overflow: "hidden" }}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <div className="absolute inset-0 transition-transform duration-700 ease-editorial group-hover:scale-[1.04]">
          <PlateImage
            src={prompt.imageUrl}
            alt={prompt.title ?? prompt.abstract ?? ""}
            styleKey={prompt.style}
            label={catLabel ?? undefined}
          />
        </div>
        {catLabel && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <span className="mono rounded" style={{ background: "rgba(20,20,20,.6)", color: "var(--paper-2)", padding: "4px 9px", backdropFilter: "blur(3px)" }}>
              {catLabel}
            </span>
          </div>
        )}
        <span
          className="mono pointer-events-none absolute bottom-3 right-3 rounded opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: "rgba(20,20,20,.6)", color: "var(--paper)", padding: "4px 9px", fontSize: 10.5, backdropFilter: "blur(3px)" }}
        >
          查看大图 ↗
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {prompt.title && (
          <h3 className="serif" style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.2 }}>
            {prompt.title}
          </h3>
        )}
        {catLabel && (
          <span className="mono" style={{ color: "var(--faint)" }}>{catLabel}</span>
        )}
        {/* 卡片只显示「简短描述」（源站一句话陈述），**固定 2 行**。
            ⚠ 绝不在此铺 promptText：完整提示词长短悬殊（有的是 3000 字符 JSON），
            会让瀑布流卡片高度失控、排版很丑。完整 prompt 只在详情页/弹窗/复制按钮里用。
            ⚠ 截断用**内联样式**而非 Tailwind 的 line-clamp-2 类：
            工具类依赖构建产物/CSS 缓存，曾出现线上没生效（卡片铺了 6 行）的情况。
            这里同时给 -webkit-line-clamp 与 maxHeight 双保险，任何浏览器都封顶 2 行。 */}
        {prompt.abstract && (
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.75,
              color: "var(--paper-2)",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
              maxHeight: "calc(2 * 1.75 * 13px)", // 兜底：即使 -webkit-box 不生效也封顶 2 行
            }}
          >
            {prompt.abstract}
          </p>
        )}
        <div
          className="mt-auto flex items-center gap-2 pt-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <CopyButton text={prompt.promptText} label="复制" />
          <SaveButton id={prompt.id} />
        </div>
      </div>
    </article>
  );
}
