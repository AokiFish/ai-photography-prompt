import Link from "next/link";

export function Footer() {
  return (
    <footer className="pad-x" style={{ background: "var(--ink)", paddingTop: "clamp(48px,8vh,80px)", paddingBottom: 34, borderTop: "1px solid var(--line)" }}>
      <div className="flex flex-wrap items-end justify-between gap-5" style={{ paddingBottom: 40 }}>
        <div className="serif" style={{ fontSize: "clamp(28px,4vw,44px)", lineHeight: 1.05, fontWeight: 500 }}>
          拍出你想要的那张照片
          <span className="block" style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: ".4em", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--accent)", marginTop: 8, fontWeight: 400 }}>
            THE PROMPT PHOTOGRAPH
          </span>
        </div>
        <Link href="#top" className="mono" style={{ color: "var(--accent)", borderBottom: "1px solid var(--accent)", paddingBottom: 2 }}>
          返回卷首 ↑
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2" style={{ paddingTop: 22, borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--faint)" }}>
        <span>© 2026 · AI 摄影提示词图鉴 · VOL.01</span>
        <span className="hidden sm:inline" style={{ color: "var(--muted)" }}>主体 · 光线 · 镜头 · 色彩 · 质感</span>
        <span style={{ color: "var(--muted)" }}>六种摄影语言，一册收齐</span>
      </div>
      <nav className="mt-4 flex flex-wrap gap-x-5 gap-y-1" style={{ fontSize: 11 }}>
        <Link href="/gallery" className="mono" style={{ color: "var(--muted)" }}>GALLERY</Link>
        <Link href="/about" className="mono" style={{ color: "var(--muted)" }}>ABOUT</Link>
        <Link href="/faq" className="mono" style={{ color: "var(--muted)" }}>FAQ</Link>
        <Link href="/saved" className="mono" style={{ color: "var(--muted)" }}>SAVED</Link>
      </nav>
    </footer>
  );
}
