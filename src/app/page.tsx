import { HOME_PLATES, RECIPE_STEPS } from "@/data/home-plates";
import { Plate } from "@/components/Plate";
import { Reveal } from "@/components/Reveal";

export default function HomePage() {
  return (
    <>
      {/* ===== 页眉 / Masthead ===== */}
      <header className="pad-x" id="top" style={{ paddingTop: "clamp(56px,10vh,104px)", paddingBottom: "clamp(48px,8vh,90px)", borderBottom: "1px solid var(--line)" }}>
        <Reveal>
          <div className="mono flex items-center gap-4" style={{ marginBottom: "clamp(28px,5vh,48px)" }}>
            <span style={{ color: "var(--accent)" }}>VOL.01</span>
            <span>暗房 · 画廊 · 提示词图鉴</span>
            <span className="h-px flex-1" style={{ background: "var(--line)" }} />
            <span>AI PHOTOGRAPHY</span>
          </div>
        </Reveal>

        <Reveal delay={1}>
          <h1 className="display" style={{ fontSize: "clamp(44px,10vw,120px)" }}>
            AI 摄影
            <br />
            提示词图鉴
            <span className="block" style={{ fontFamily: "var(--font-sans),sans-serif", fontSize: ".34em", letterSpacing: ".14em", fontWeight: 400, color: "var(--muted)", marginTop: 18, textTransform: "uppercase" }}>
              The Prompt Photograph · 一册可以照着拍的提示词集
            </span>
          </h1>
        </Reveal>

        <Reveal delay={2}>
          <div className="lede" style={{ maxWidth: "36em", marginTop: "clamp(30px,6vh,56px)", fontSize: "clamp(15px,1.9vw,18px)", lineHeight: 1.9 }}>
            <p>
              不是教你怎么念咒语，而是带你在 <b style={{ fontWeight: 600, color: "var(--accent)" }}>六种摄影语言</b>{" "}
              之间穿行——电影感、极简、胶片、黑白、微距、夜影。每种风格配一张出图示例、一句核心提示词，以及可直接复制的完整提示词。
            </p>
            <p style={{ marginTop: 14, color: "var(--muted)", fontSize: ".92em" }}>
              把「想拍什么」翻译成 AI 听得懂的句子，是这时代的新摄影术。本册即为此而作：主体、光线、镜头、色彩、质感——五大配方，逐一对号入座。
            </p>
          </div>
        </Reveal>

        <Reveal delay={3}>
          <div className="flex flex-wrap gap-x-10 gap-y-3" style={{ marginTop: "clamp(34px,6vh,54px)", paddingTop: 22, borderTop: "1px solid var(--line)" }}>
            {[
              { k: "Type · 类型", v: "提示词图鉴 / Prompt Catalogue" },
              { k: "Plates · 收录", v: "06 种摄影风格" },
              { k: "Format · 画幅", v: "4:5 · 竖幅" },
              { k: "Ratio · 出图", v: "1831 × 2289" },
            ].map((m) => (
              <div key={m.k} className="flex flex-col gap-1.5">
                <span className="mono" style={{ fontSize: 10, letterSpacing: ".18em", color: "var(--faint)", textTransform: "uppercase" }}>{m.k}</span>
                <span className="mono" style={{ fontSize: 13, color: "var(--paper-2)" }}>{m.v}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </header>

      {/* ===== 索引 ===== */}
      <nav className="pad-x mono" aria-label="目录" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 py-4">
          {HOME_PLATES.map((p) => (
            <a key={p.num} href={`#p${p.num}`} className="inline-flex items-baseline gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
              <span className="mono" style={{ color: "var(--faint)", fontSize: 10 }}>{p.num}</span>
              {p.title} {p.en}
            </a>
          ))}
          <a href="#recipe" className="inline-flex items-baseline gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
            <span className="mono" style={{ color: "var(--faint)", fontSize: 10 }}>配方</span>
            提示词拆解
          </a>
        </div>
      </nav>

      {/* ===== 图鉴 Plates ===== */}
      {HOME_PLATES.map((plate, i) => (
        <div key={plate.num} id={`p${plate.num}`}>
          <Plate plate={plate} reverse={i % 2 === 1} />
        </div>
      ))}

      {/* ===== 配方拆解 ===== */}
      <section className="pad-x" id="recipe" style={{ paddingTop: "clamp(70px,11vh,120px)", paddingBottom: "clamp(70px,11vh,120px)", borderBottom: "1px solid var(--line)" }}>
        <Reveal>
          <div className="kicker" style={{ marginBottom: "clamp(26px,4vh,44px)" }}>
            <span className="lbl mono">配方拆解 · ANATOMY</span>
            <span className="rule" />
          </div>
          <h2 className="display" style={{ fontSize: "clamp(32px,5vw,60px)", marginBottom: 18 }}>
            一句好提示词，<br />由五味调和而成
          </h2>
          <p style={{ maxWidth: "40em", color: "var(--muted)", fontSize: 15, lineHeight: 1.8, marginBottom: "clamp(34px,6vh,54px)" }}>
            任何摄影提示词都可以拆成五块配方。写之前先想清楚这五味各是什么，句子自然就有了章法——顺序从主体到质感，由近及远。
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-px md:grid-cols-2" style={{ background: "var(--line)" }}>
          {RECIPE_STEPS.map((s, i) => (
            <Reveal key={s.n} delay={(i % 2) as 0 | 1}>
              <div style={{ background: "var(--ink)", padding: "clamp(20px,3vw,30px)" }}>
                <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
                  <span className="mono" style={{ color: "var(--accent)" }}>{s.n}</span>
                  <span className="serif" style={{ fontWeight: 500, fontSize: 20 }}>{s.title}</span>
                </div>
                {s.ex && (
                  <div className="mono" style={{ fontSize: 12.5, color: "var(--paper-2)", lineHeight: 1.7, borderLeft: "1px solid var(--line-strong)", paddingLeft: 14, marginTop: 4 }}>
                    {s.ex}
                  </div>
                )}
                <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.75, marginTop: 10 }}>{s.note}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
