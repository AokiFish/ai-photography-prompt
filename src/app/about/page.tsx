import { Reveal } from "@/components/Reveal";

export const metadata = {
  title: "关于",
  description: "关于 AI 摄影提示词图鉴：我们把「想拍什么」翻译成 AI 听得懂的句子。",
};

const PILLARS = [
  { n: "01", t: "翻译，不是咒语", d: "提示词的本质是把脑中的画面翻译成模型听得懂的名词与动词。我们聚焦「可复用的摄影语言」，而非堆砌形容词。" },
  { n: "02", t: "分类，不混装", d: "数据按来源（PRMPT / Lexica）与摄影语言（电影感、极简、胶片…）双维度归类，便于检索与策展，绝不全塞一桶。" },
  { n: "03", t: "每日更新", d: "GitHub Action 每天 08:00 以安全间隔采集两个源，写入 Cloudflare D1；站点读取即时反映最新收藏。" },
  { n: "04", t: "轻量收藏", d: "收藏存于本机浏览器，无需登录、无追踪。把复杂留给我们，把简单留给你。" },
];

const STACK = [
  ["框架", "Next.js (App Router)"],
  ["样式", "Tailwind CSS + 设计令牌"],
  ["数据库", "Cloudflare D1 (SQLite)"],
  ["部署", "Cloudflare Pages"],
  ["采集", "Node 脚本 + GitHub Actions"],
  ["字体", "Newsreader / Space Grotesk / Space Mono"],
];

export default function AboutPage() {
  return (
    <div className="pad-x" style={{ paddingTop: "clamp(40px,7vh,80px)", paddingBottom: "clamp(60px,9vh,110px)" }}>
      <Reveal>
        <div className="kicker" style={{ marginBottom: 22 }}>
          <span className="lbl mono">关于 · ABOUT</span>
          <span className="rule" />
        </div>
        <h1 className="display" style={{ fontSize: "clamp(34px,6vw,76px)", maxWidth: "14em", lineHeight: 1.04 }}>
          把「想拍什么」<br />翻译成 AI 听得懂的句子
        </h1>
        <p style={{ maxWidth: "42em", marginTop: "clamp(26px,4vh,40px)", color: "var(--paper)", fontSize: "clamp(15px,1.9vw,18px)", lineHeight: 1.9 }}>
          AI 摄影提示词图鉴是一本可照着拍的提示词集。我们不教你念咒语，而是带你穿行在六种摄影语言之间——
          每种风格配一句核心提示词与可直接复制的完整提示词，像翻一本暗房里的画廊画册。
        </p>
      </Reveal>

      <Reveal>
        <div className="grid grid-cols-1 gap-px md:grid-cols-2" style={{ background: "var(--line)", marginTop: "clamp(40px,6vh,64px)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          {PILLARS.map((p, i) => (
            <div key={p.n} style={{ background: "var(--ink)", padding: "clamp(22px,3vw,34px)" }}>
              <div className="flex items-center gap-3" style={{ marginBottom: 10 }}>
                <span className="mono" style={{ color: "var(--accent)" }}>{p.n}</span>
                <span className="serif" style={{ fontWeight: 500, fontSize: 22 }}>{p.t}</span>
              </div>
              <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.8 }}>{p.d}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal>
        <h2 className="display" style={{ fontSize: "clamp(26px,4vw,44px)", marginTop: "clamp(50px,8vh,84px)", marginBottom: 18 }}>
          数据从哪来
        </h2>
        <p style={{ maxWidth: "44em", color: "var(--muted)", fontSize: 15, lineHeight: 1.85 }}>
          采集器每天以「正常的安全间隔」轮询两个来源：<b style={{ color: "var(--paper-2)", fontWeight: 600 }}>PRMPT</b>（编辑 / 时尚 / 肖像类精品画廊）与
          <b style={{ color: "var(--paper-2)", fontWeight: 600 }}> Lexica</b>（社区图像与提示词搜索引擎）。每条记录都标注来源与摄影语言，
          写入 D1 时按这两个维度建立索引——分类清晰，互不混淆。
        </p>
      </Reveal>

      <Reveal>
        <h2 className="display" style={{ fontSize: "clamp(26px,4vw,44px)", marginTop: "clamp(44px,7vh,72px)", marginBottom: 18 }}>
          技术栈
        </h2>
        <dl className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3" style={{ background: "var(--line)", border: "1px solid var(--line)" }}>
          {STACK.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1.5" style={{ background: "var(--ink-2)", padding: "clamp(18px,2.5vw,26px)" }}>
              <dt className="mono" style={{ fontSize: 10, letterSpacing: ".18em", color: "var(--faint)", textTransform: "uppercase" }}>{k}</dt>
              <dd className="serif" style={{ fontSize: 18 }}>{v}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </div>
  );
}
