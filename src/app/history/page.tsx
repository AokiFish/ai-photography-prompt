import Link from "next/link";
import { getAllPrompts } from "@/lib/prompts";
import { getDB } from "@/lib/db";
import { getServerUser } from "@/lib/session";
import { PRO_CATEGORIES, STYLE_LABELS, promptSlug } from "@/lib/types";
import { PlateImage } from "@/components/PlateImage";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";
// D1 经 @cloudflare/next-on-pages 访问，必须在 edge runtime 内调用。
export const runtime = "edge";

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function HistoryPage() {
  const user = await getServerUser();
  const all = await getAllPrompts();
  const byId = new Map(all.map((p) => [p.id, p]));

  // 未登录：历史只存于 D1（按登录用户），故未登录看不到。
  if (!user) {
    return (
      <div className="pad-x" style={{ paddingTop: "clamp(40px,7vh,80px)", paddingBottom: "clamp(60px,9vh,110px)" }}>
        <Reveal>
          <div className="kicker" style={{ marginBottom: 22 }}>
            <span className="lbl mono">历史 · HISTORY</span>
            <span className="rule" />
          </div>
          <h1 className="display" style={{ fontSize: "clamp(34px,6vw,72px)", marginBottom: 14 }}>
            浏览历史
          </h1>
          <p style={{ maxWidth: "42em", color: "var(--muted)", fontSize: 15, lineHeight: 1.8 }}>
            历史记录按登录账号保存在云端。请先在右上角用 GitHub 或 Google 登录后查看。
          </p>
        </Reveal>
      </div>
    );
  }

  const db = getDB();
  let items: { prompt: (typeof all)[number]; viewedAt: number }[] = [];
  if (db) {
    const { results } = await db
      .prepare("SELECT prompt_id, viewed_at FROM history WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 200")
      .bind(user.id)
      .all<{ prompt_id: string; viewed_at: number }>();
    for (const r of results) {
      const p = byId.get(r.prompt_id);
      if (p) items.push({ prompt: p, viewedAt: r.viewed_at });
    }
  }

  return (
    <div className="pad-x" style={{ paddingTop: "clamp(40px,7vh,80px)", paddingBottom: "clamp(60px,9vh,110px)" }}>
      <Reveal>
        <div className="kicker" style={{ marginBottom: 22 }}>
          <span className="lbl mono">历史 · HISTORY</span>
          <span className="rule" />
          <span className="mono" style={{ color: "var(--faint)" }}>云端 · {items.length}</span>
        </div>
        <h1 className="display" style={{ fontSize: "clamp(34px,6vw,72px)", marginBottom: 14 }}>
          浏览历史
        </h1>
        <p style={{ maxWidth: "42em", color: "var(--muted)", fontSize: 15, lineHeight: 1.8 }}>
          你登录期间看过的提示词详情，按最近浏览时间倒序排列。数据保存在云端，换设备也能看到。
        </p>
      </Reveal>

      <div className="mt-9">
        {items.length === 0 ? (
          <div className="py-20 text-center">
            <p className="serif" style={{ fontSize: 24, color: "var(--muted)" }}>
              还没有浏览记录
            </p>
            <p className="mono mt-3" style={{ color: "var(--faint)" }}>
              去 <a href="/gallery" style={{ color: "var(--accent)" }}>图集</a> 看看，每打开一条详情都会记在这里
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {items.map(({ prompt: p, viewedAt }) => {
              const slug = promptSlug(p);
              const href = slug ? `/prompt/${slug}` : "#";
              const catLabel = PRO_CATEGORIES[p.category ?? ""] ?? null;
              return (
                <li key={p.id} className="hairline">
                  <Link
                    href={href}
                    className="flex items-center gap-4 py-4 transition-colors hover:bg-ink-3"
                    style={{ paddingLeft: 8, paddingRight: 8 }}
                  >
                    <div
                      className="h-16 w-16 shrink-0 overflow-hidden rounded border"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <PlateImage src={p.imageUrl} alt={p.title ?? ""} styleKey={p.style} bare fit="cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {catLabel && (
                          <span className="mono rounded" style={{ background: "rgba(237,231,218,.1)", color: "var(--paper-2)", padding: "2px 7px", fontSize: 10 }}>
                            {catLabel}
                          </span>
                        )}
                        <span className="mono rounded" style={{ border: "1px solid var(--line)", color: "var(--muted)", padding: "2px 7px", fontSize: 10 }}>
                          {STYLE_LABELS[p.style]}
                        </span>
                      </div>
                      <p className="mt-1 truncate serif" style={{ fontSize: 16, color: "var(--paper)" }}>
                        {p.title ?? p.abstract ?? p.id}
                      </p>
                    </div>
                    <span className="mono shrink-0" style={{ color: "var(--faint)", fontSize: 11 }}>
                      {fmtTime(viewedAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
