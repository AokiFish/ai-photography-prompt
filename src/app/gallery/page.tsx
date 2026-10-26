import Link from "next/link";
import type { Metadata } from "next";
import { getPrompts } from "@/lib/prompts";
import { GalleryClient } from "@/components/GalleryClient";
import { Reveal } from "@/components/Reveal";
import { CORE_STYLES, PRO_CATEGORIES, STYLE_LABELS, type Source, type StyleKey } from "@/lib/types";

export const dynamic = "force-dynamic";
// D1 经 @cloudflare/next-on-pages 访问，必须在 edge runtime 内调用。
export const runtime = "edge";

export const metadata: Metadata = {
  title: "图集",
  description: "按来源与摄影语言分类浏览的 AI 摄影提示词画廊。",
};

type SP = { source?: string; style?: string; category?: string; q?: string };

function buildHref(current: SP, key: keyof SP, value?: string) {
  const next = { ...current };
  if (value) next[key] = value;
  else delete next[key];
  const qs = new URLSearchParams(
    Object.entries(next).filter(([, v]) => v) as [string, string][]
  ).toString();
  return qs ? `/gallery?${qs}` : "/gallery";
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mono rounded-full"
      style={{
        border: `1px solid ${active ? "var(--accent)" : "var(--line-strong)"}`,
        color: active ? "var(--accent)" : "var(--muted)",
        padding: "6px 13px",
        background: active ? "var(--accent-soft)" : "transparent",
        transition: "all .2s",
      }}
    >
      {children}
    </Link>
  );
}

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const source = sp.source as Source | undefined;
  const style = sp.style as StyleKey | undefined;
  const category = sp.category;
  const q = sp.q;

  const [prompts] = await Promise.all([
    getPrompts({ source, style, category, q }),
  ]);

  const current: SP = { source, style, category, q };

  return (
    <div className="pad-x" style={{ paddingTop: "clamp(40px,7vh,80px)", paddingBottom: "clamp(60px,9vh,110px)" }}>
      <Reveal>
        <div className="kicker" style={{ marginBottom: 22 }}>
          <span className="lbl mono">图集 · GALLERY</span>
          <span className="rule" />
          <span className="mono" style={{ color: "var(--faint)" }}>{prompts.length} 条</span>
        </div>
        <h1 className="display" style={{ fontSize: "clamp(34px,6vw,72px)", marginBottom: 14 }}>
          提示词画廊
        </h1>
        <p style={{ maxWidth: "42em", color: "var(--muted)", fontSize: 15, lineHeight: 1.8 }}>
          精选 AI 摄影级照片和图片提示，按摄影语言与专业分类。每条都可直接复制、收藏，点击卡片查看大图与完整提示词。
        </p>
      </Reveal>

      {/* 搜索 */}
      <form action="/gallery" method="get" className="mt-7 flex max-w-md" role="search">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="搜索提示词 / 风格 / 标签…"
          className="mono w-full rounded-l"
          style={{ background: "var(--ink-3)", border: "1px solid var(--line-strong)", borderRight: "none", color: "var(--paper)", padding: "11px 14px", fontSize: 12, letterSpacing: ".04em" }}
        />
        <button type="submit" className="mono rounded-r" style={{ background: "var(--accent)", color: "#141414", border: "1px solid var(--accent)", padding: "0 18px", fontSize: 11 }}>
          搜索
        </button>
      </form>

      {/* 筛选：来源仅作内部数据区分，不在此暴露 */}
      <div className="mt-8 flex flex-col gap-4" style={{ borderTop: "1px solid var(--line)", paddingTop: 22 }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono mr-1" style={{ color: "var(--faint)", width: 56 }}>核心</span>
          <Chip href={buildHref(current, "style")} active={!style}>全部</Chip>
          {CORE_STYLES.map((k) => (
            <Chip key={k} href={buildHref(current, "style", k)} active={style === k}>
              {STYLE_LABELS[k]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono mr-1" style={{ color: "var(--faint)", width: 56 }}>专业</span>
          <Chip href={buildHref(current, "category")} active={!category}>全部</Chip>
          {Object.entries(PRO_CATEGORIES).map(([key, label]) => (
            <Chip key={key} href={buildHref(current, "category", key)} active={category === key}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      {/* 网格 + 详情弹窗（客户端） */}
      <GalleryClient prompts={prompts} />
    </div>
  );
}
