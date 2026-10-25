import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPromptBySlug } from "@/lib/prompts";
import { PRO_CATEGORIES, STYLE_LABELS, STYLE_INTRO } from "@/lib/types";
import { PlateImage } from "@/components/PlateImage";
import { CopyButton } from "@/components/CopyButton";
import { SaveButton } from "@/components/SaveButton";

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
    description: (prompt.promptText ?? "").slice(0, 120),
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
        {/* 大图 */}
        <div
          className="relative min-h-[300px] overflow-hidden border md:min-h-[620px]"
          style={{ background: "var(--ink-2)", borderColor: "var(--line-strong)" }}
        >
          <PlateImage
            src={prompt.imageUrl}
            alt={prompt.title ?? prompt.promptText.slice(0, 40)}
            styleKey={prompt.style}
            bare
          />
        </div>

        {/* 详情 */}
        <div className="flex flex-col">
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
              <CopyButton text={prompt.promptText} label="复制" />
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
              }}
            >
              {prompt.promptText}
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

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
            <SaveButton id={prompt.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
