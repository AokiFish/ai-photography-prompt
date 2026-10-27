// 浏览历史：登录用户「看过的提示词详情页」写进 history 表（按 user_id+prompt_id 去重，重复只更新时间）。
// POST → body: {promptId} 记录一次浏览（需登录）
// GET  → 返回该用户最近的浏览记录（含 prompt_id 与 viewed_at），供前端/调试使用
import { getDB } from "@/lib/db";
import { getServerUser } from "@/lib/session";

export const runtime = "edge";

export async function GET() {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });
  const db = getDB();
  if (!db) return Response.json({ error: "服务端未绑定 D1" }, { status: 503 });
  const { results } = await db
    .prepare("SELECT prompt_id, viewed_at FROM history WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 200")
    .bind(user.id)
    .all<{ prompt_id: string; viewed_at: number }>();
  return Response.json({ items: results });
}

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });
  const db = getDB();
  if (!db) return Response.json({ error: "服务端未绑定 D1" }, { status: 503 });

  let body: { promptId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }
  const id = typeof body.promptId === "string" ? body.promptId.trim() : "";
  if (!id) return Response.json({ error: "缺少 promptId" }, { status: 400 });

  // 幂等：重复浏览只刷新 viewed_at（INSERT OR REPLACE 会重置整行，故用 upsert 写法）
  await db
    .prepare(
      `INSERT INTO history (user_id, prompt_id, viewed_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id, prompt_id) DO UPDATE SET viewed_at=excluded.viewed_at`,
    )
    .bind(user.id, id, Date.now())
    .run();
  return Response.json({ ok: true });
}
