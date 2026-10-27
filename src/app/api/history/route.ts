// 提示词历史（剪贴板）：登录用户把「精炼 / 构建器复制 / 图集复制」产生的提示存进 history 表。
// GET  → 返回该用户最近 500 条（含 prompt_text / source / created_at），供 /history 页与前端使用
// POST → body: {promptText, promptId?, source} 记录一条
//        去重：同 user+text+source 视为同一条，刷新到最前（而非新增）
//        容量：超过 500 条时删除最早的超出部分（滚动窗口）
// 未登录一律 401（本机历史走 localStorage，由前端兜底，不进 D1）。
import { getDB } from "@/lib/db";
import { getServerUser } from "@/lib/session";

export const runtime = "edge";

const MAX = 500;
const TEXT_LIMIT = 8000;

export async function GET() {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });
  const db = getDB();
  if (!db) return Response.json({ error: "服务端未绑定 D1" }, { status: 503 });
  const { results } = await db
    .prepare(
      "SELECT id, prompt_id, prompt_text, source, created_at FROM history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(user.id, MAX)
    .all<{ id: number; prompt_id: string | null; prompt_text: string; source: string; created_at: number }>();
  return Response.json({ items: results });
}

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });
  const db = getDB();
  if (!db) return Response.json({ error: "服务端未绑定 D1" }, { status: 503 });

  let body: { promptText?: unknown; promptId?: unknown; source?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }
  const text = typeof body.promptText === "string" ? body.promptText.trim().slice(0, TEXT_LIMIT) : "";
  if (!text) return Response.json({ error: "缺少 promptText" }, { status: 400 });
  const source = body.source === "refine" || body.source === "builder" || body.source === "gallery" ? body.source : "gallery";
  const promptId =
    typeof body.promptId === "string" && body.promptId.trim() ? body.promptId.trim() : null;
  const now = Date.now();

  // 去重：同一用户同一文本同一来源，刷新到最前（不新增重复条目）
  const existing = await db
    .prepare("SELECT id FROM history WHERE user_id = ? AND prompt_text = ? AND source = ? LIMIT 1")
    .bind(user.id, text, source)
    .first<{ id: number }>();
  if (existing) {
    await db.prepare("UPDATE history SET created_at = ? WHERE id = ?").bind(now, existing.id).run();
    return Response.json({ ok: true, updated: true });
  }

  await db
    .prepare("INSERT INTO history (user_id, prompt_id, prompt_text, source, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(user.id, promptId, text, source, now)
    .run();

  // 淘汰超额：保留最近 MAX 条，删最早的超出部分
  const row = await db
    .prepare("SELECT COUNT(*) AS c FROM history WHERE user_id = ?")
    .bind(user.id)
    .first<{ c: number }>();
  const count = row?.c ?? 0;
  if (count > MAX) {
    await db
      .prepare("DELETE FROM history WHERE user_id = ? ORDER BY created_at ASC LIMIT ?")
      .bind(user.id, count - MAX)
      .run();
  }
  return Response.json({ ok: true });
}
