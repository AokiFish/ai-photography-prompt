import { getAllPrompts } from "@/lib/prompts";
import { SavedClient } from "@/components/SavedClient";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";
// D1 经 @cloudflare/next-on-pages 访问，必须在 edge runtime 内调用。
export const runtime = "edge";

export default async function SavedPage() {
  // 全量数据由服务端取（D1），客户端只按 localStorage 里的 id 过滤。
  const all = await getAllPrompts();

  return (
    <div className="pad-x" style={{ paddingTop: "clamp(40px,7vh,80px)", paddingBottom: "clamp(60px,9vh,110px)" }}>
      <Reveal>
        <div className="kicker" style={{ marginBottom: 22 }}>
          <span className="lbl mono">收藏 · SAVED</span>
          <span className="rule" />
          <span className="mono" style={{ color: "var(--faint)" }}>本机</span>
        </div>
        <h1 className="display" style={{ fontSize: "clamp(34px,6vw,72px)", marginBottom: 14 }}>
          我的收藏夹
        </h1>
        <p style={{ maxWidth: "42em", color: "var(--muted)", fontSize: 15, lineHeight: 1.8 }}>
          收藏保存在本机浏览器（localStorage），无需登录。换设备不会同步——这是有意保持轻量的设计。
        </p>
      </Reveal>

      <div className="mt-9">
        <SavedClient prompts={all} />
      </div>
    </div>
  );
}
