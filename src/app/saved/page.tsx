import { getAllPrompts } from "@/lib/prompts";
import { getDB } from "@/lib/db";
import { getServerUser } from "@/lib/session";
import { SavedClient } from "@/components/SavedClient";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";
// D1 经 @cloudflare/next-on-pages 访问，必须在 edge runtime 内调用。
export const runtime = "edge";

export default async function SavedPage() {
  // 全量数据由服务端取（D1），客户端只按 id 过滤。
  const all = await getAllPrompts();

  // 登录用户：从 D1 saved 表取云端收藏，与本地 localStorage 合并展示。
  let serverIds: string[] = [];
  const user = await getServerUser();
  if (user) {
    const db = getDB();
    if (db) {
      const { results } = await db
        .prepare("SELECT prompt_id FROM saved WHERE user_id = ?")
        .bind(user.id)
        .all<{ prompt_id: string }>();
      serverIds = results.map((r) => r.prompt_id);
    }
  }

  return (
    <div className="pad-x" style={{ paddingTop: "clamp(40px,7vh,80px)", paddingBottom: "clamp(60px,9vh,110px)" }}>
      <Reveal>
        <div className="kicker" style={{ marginBottom: 22 }}>
          <span className="lbl mono">收藏 · SAVED</span>
          <span className="rule" />
          <span className="mono" style={{ color: "var(--faint)" }}>
            {user ? "本机 + 云端" : "本机"}
          </span>
        </div>
        <h1 className="display" style={{ fontSize: "clamp(34px,6vw,72px)", marginBottom: 14 }}>
          我的收藏夹
        </h1>
        <p style={{ maxWidth: "42em", color: "var(--muted)", fontSize: 15, lineHeight: 1.8 }}>
          {user
            ? "收藏保存在本机浏览器（localStorage）并同步到云端（D1），登录同账号即可跨设备查看。"
            : "收藏保存在本机浏览器（localStorage），无需登录。登录后会同步到云端，换设备也能查看。"}
        </p>
      </Reveal>

      <div className="mt-9">
        <SavedClient prompts={all} serverIds={serverIds} />
      </div>
    </div>
  );
}
