import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPromptBySlug, getRelatedPrompts } from "@/lib/prompts";
import { PRO_CATEGORIES, STYLE_LABELS, STYLE_INTRO, displayPromptText } from "@/lib/types";
import { PlateImage } from "@/components/PlateImage";
import { CopyButton } from "@/components/CopyButton";
import { SaveButton } from "@/components/SaveButton";
import { GalleryClient } from "@/components/GalleryClient";

export const dynamic = "force-dynamic";
// D1 经 @cloudflare/next-on-pages 访问，必须在 edge runtime 内调用。
export const runtime = "edge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const prompt = await getPromptBySlug(slug);
  if (!prompt) return { title: "未找到提示词" };
  return {
    title: prompt.title ?? "提示词详情",
    // SEO 描述优先用简短陈述；完整 prompt（可能是 JSON）截出来没法读。
    description: (prompt.abstract ?? prompt.promptText ?? "").slice(0, 120),
  };
}

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const prompt = await getPromptBySlug(slug);
  if (!prompt) notFound();

  const catLabel = PRO_CATEGORIES[prompt.category ?? ""] ?? null;
  // JSON 型提示词按源站原样紧凑显示（不缩进美化），复制也是同一份
  const promptOut = displayPromptText(prompt.promptText);
  // 底部关联卡片：同分类 + 相关推荐
  const { moreInCategory, related } = await getRelatedPrompts(prompt);

  return (
    <div className="pad-x" style={{ paddingTop: "clamp(34px,6vh,60px)", paddingBottom: "clamp(60px,9vh,110px)" }}>
      <div className="kicker" style={{ marginBottom: 22 }}>
        <Link href="/gallery" className="lbl mono" style={{ color: "var(--faint)" }}>
          ← 图集 · GALLERY
        </Link>
      </div>

      <div
        className="grid grid-cols-1 gap-8 md:grid-cols-[1.05fr_1fr]"
        style={{ maxWidth: 1080, margin: "0 auto" }}
      >
        {/* 大图：contain 完整显示不裁切；高度与右栏一致（底部对齐） */}
        <div
          className="aspect-[4/5] overflow-hidden border md:aspect-auto md:h-[calc(100vh-170px)]"
          style={{ background: "var(--ink-2)", borderColor: "var(--line-strong)" }}
        >
          <PlateImage
            src={prompt.imageUrl}
            alt={prompt.title ?? prompt.abstract ?? ""}
            styleKey={prompt.style}
            bare
            fit="contain"
          />
        </div>

        {/* 详情：与图等高，内容超出时在**本栏内部**滚动（对齐源站） */}
        <div className="flex flex-col md:h-[calc(100vh-170px)] md:overflow-y-auto md:pr-2">
          <div className="flex flex-wrap items-center gap-2">
            {catLabel && (
              <span
                className="mono rounded"
                style={{ background: "rgba(237,231,218,.1)", color: "var(--paper-2)", padding: "4px 9px" }}
              >
                {catLabel}
              </span>
            )}
            <span
              className="mono rounded"
              style={{ border: "1px solid var(--line)", color: "var(--muted)", padding: "4px 9px" }}
            >
              {STYLE_LABELS[prompt.style]}
            </span>
          </div>

          {prompt.title && (
            <h1
              className="serif mt-4"
              style={{ fontSize: "clamp(24px,3vw,34px)", fontWeight: 500, lineHeight: 1.2 }}
            >
              {prompt.title}
            </h1>
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
              <CopyButton text={promptOut} label="复制" />
            </div>
            <p
              className="mt-2 rounded"
              style={{
                background: "var(--ink-3)",
                border: "1px solid var(--line)",
                padding: "14px 16px",
                fontFamily: "var(--font-mono),monospace",
                fontSize: 12.5,
                lineHeight: 1.75,
                color: "var(--paper-2)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {promptOut}
            </p>
          </div>

          {prompt.negativePrompt && (
            <div className="mt-4">
              <span className="lbl mono" style={{ color: "var(--faint)" }}>反向提示词</span>
              <p
                className="mt-2 rounded"
                style={{
                  background: "var(--ink-3)",
                  border: "1px solid var(--line)",
                  padding: "12px 16px",
                  fontFamily: "var(--font-mono),monospace",
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: "var(--faint)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {prompt.negativePrompt}
              </p>
            </div>
          )}

          {prompt.tags && prompt.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {prompt.tags.map((t) => (
                <span
                  key={t}
                  className="mono rounded"
                  style={{ border: "1px solid var(--line)", color: "var(--muted)", padding: "3px 9px", fontSize: 11 }}
                >
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

        </div>
      </div>

      {/* 底部大号复制条：往下拉看完就能直接复制（上方提示词标题旁的复制按钮保留） */}
      <div
        className="flex items-center gap-3"
        style={{ maxWidth: 1080, margin: "20px auto 0" }}
      >
        <CopyButton
          text={promptOut}
          label="Copy Prompt · 复制提示词"
          copiedLabel="已复制 ✓"
          className="flex-1 justify-center"
          style={{
            background: "var(--ink-2)",
            border: "1px solid var(--line-strong)",
            borderRadius: 999,
            padding: "16px 20px",
            color: "var(--paper)",
            fontSize: 14,
            letterSpacing: 0,
            textTransform: "none",
          }}
        />
        <SaveButton
          id={prompt.id}
          className="shrink-0 justify-center"
        />
      </div>

      {/* 同分类更多（对齐源站 "More in <category>"） */}
      {moreInCategory.length > 0 && (
        <section style={{ maxWidth: 1080, margin: "clamp(48px,7vh,80px) auto 0" }}>
          <div className="kicker" style={{ marginBottom: 18 }}>
            <span className="lbl mono">
              更多{catLabel ?? "同类"} · More in {prompt.category}
            </span>
            <span className="rule" />
            <Link href={`/gallery?category=${prompt.category}`} className="mono" style={{ color: "var(--faint)" }}>
              查看全部 →
            </Link>
          </div>
          <GalleryClient prompts={moreInCategory} />
        </section>
      )}

      {/* 相关提示（同摄影语言 / 共同标签） */}
      {related.length > 0 && (
        <section style={{ maxWidth: 1080, margin: "clamp(40px,6vh,64px) auto 0" }}>
          <div className="kicker" style={{ marginBottom: 18 }}>
            <span className="lbl mono">相关提示 · Related prompts</span>
            <span className="rule" />
          </div>
          <GalleryClient prompts={related} />
        </section>
      )}
    </div>
  );
}
