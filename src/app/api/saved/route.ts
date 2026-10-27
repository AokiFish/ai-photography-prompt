// 收藏的 D1 同步：登录用户把收藏写进 saved 表（本地 localStorage 仍保留，二者取并集）。
// GET  → 返回该用户已收藏的 prompt_id 列表
// POST → 新增一条（body: {promptId}）
// DELETE → 取消一条（body: {promptId}）
// 未登录一律 401（本地收藏不进 D1，由前端兜底）。
import { getDB } from "@/lib/db";
import { getServerUser } from "@/lib/session";

export const runtime = "edge";

export async function GET() {
  const user = await getServerUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });
  const db = getDB();
  if (!db) return Response.json({ error: "服务端未绑定 D1" }, { status: 503 });
  const { results } = await db
    .prepare("SELECT prompt_id FROM saved WHERE user_id = ? ORDER BY created_at DESC")
    .bind(user.id)
    .all<{ prompt_id: string }>();
  return Response.json({ ids: results.map((r) => r.prompt_id) });
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

  await db
    .prepare("INSERT OR REPLACE INTO saved (user_id, prompt_id, created_at) VALUES (?, ?, ?)")
    .bind(user.id, id, Date.now())
    .run();
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
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

  await db.prepare("DELETE FROM saved WHERE user_id = ? AND prompt_id = ?").bind(user.id, id).run();
  return Response.json({ ok: true });
}
