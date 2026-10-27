import { getAllPrompts } from "@/lib/prompts";
import { getDB } from "@/lib/db";
import { getServerUser } from "@/lib/session";
import { promptSlug } from "@/lib/types";
import { HistoryClient } from "@/components/HistoryClient";
import type { HistoryItem } from "@/lib/history-store";

export const dynamic = "force-dynamic";
// D1 经 @cloudflare/next-on-pages 访问，必须在 edge runtime 内调用。
export const runtime = "edge";

export default async function HistoryPage() {
  const user = await getServerUser();

  // 未登录：客户端读 localStorage（最多 20），传 null 让 HistoryClient 自行加载
  if (!user) {
    return <HistoryClient items={null} />;
  }

  // 登录：服务端读云端（最多 500），组装展示数据（含图集来源的「重新打开」链接）。
  // 远程 history 表若仍是旧结构（缺 prompt_text 列）会抛错，捕获后降级展示并提示，不再整页崩溃。
  let items: HistoryItem[] = [];
  let schemaError = false;
  try {
    const all = await getAllPrompts();
    const byId = new Map(all.map((p) => [p.id, p]));
    const db = getDB();
    if (db) {
      const { results } = await db
        .prepare(
          "SELECT id, prompt_id, prompt_text, source, created_at FROM history WHERE user_id = ? ORDER BY created_at DESC LIMIT 500",
        )
        .bind(user.id)
        .all<{
          id: number;
          prompt_id: string | null;
          prompt_text: string;
          source: "refine" | "builder" | "gallery";
          created_at: number;
        }>();
      items = results.map((r) => {
        const p = r.prompt_id ? byId.get(r.prompt_id) : undefined;
        const slug = p ? promptSlug(p) : null;
        return {
          id: String(r.id),
          text: r.prompt_text,
          source: r.source,
          createdAt: r.created_at,
          openHref: slug ?? undefined,
        };
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 缺 prompt_text 列 / 缺 history 表 → 明确告诉前端需要跑迁移
    schemaError = /prompt_text|no such (table|column)|history/i.test(msg);
    console.error("[history] 加载失败：", msg);
  }

  return <HistoryClient items={items} schemaError={schemaError} />;
}
