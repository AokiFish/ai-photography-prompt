"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UserMenu } from "@/components/UserMenu";

const LINKS = [
  { href: "/", label: "首页", en: "Index" },
  { href: "/gallery", label: "图集", en: "Gallery" },
  { href: "/builder", label: "构建器", en: "Builder" },
  { href: "/saved", label: "收藏", en: "Saved" },
  { href: "/history", label: "历史", en: "History" },
  { href: "/about", label: "关于", en: "About" },
  { href: "/faq", label: "问答", en: "FAQ" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className="fixed inset-x-0 top-0 z-[300] transition-colors duration-300"
      style={{
        background: scrolled ? "rgba(20,20,20,.82)" : "transparent",
        backdropFilter: scrolled ? "blur(10px)" : "none",
        borderBottom: scrolled ? "1px solid var(--line)" : "1px solid transparent",
      }}
    >
      <nav className="pad-x flex items-center justify-between" style={{ height: 64 }}>
        <Link href="/" className="flex items-baseline gap-2 group">
          <span className="serif" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.01em" }}>
            AI 摄影提示词图鉴
          </span>
          <span className="mono hidden sm:inline" style={{ color: "var(--accent)" }}>
            THE PROMPT PHOTOGRAPH
          </span>
        </Link>

        <ul className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="relative text-[13px] tracking-wide transition-colors"
                style={{ color: isActive(l.href) ? "var(--accent)" : "var(--paper)" }}
              >
                {l.label}
                <span
                  className="absolute -bottom-1 left-0 h-px bg-accent transition-all duration-300"
                  style={{ width: isActive(l.href) ? "100%" : "0%" }}
                />
              </Link>
            </li>
          ))}
          <li>
            <UserMenu />
          </li>
        </ul>

        <button
          type="button"
          className="md:hidden flex flex-col gap-[5px] p-2"
          aria-label="菜单"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="block h-px w-6 bg-paper" style={{ transform: open ? "rotate(45deg) translate(2px,2px)" : "none", transition: "transform .2s" }} />
          <span className="block h-px w-6 bg-paper" style={{ opacity: open ? 0 : 1, transition: "opacity .2s" }} />
          <span className="block h-px w-6 bg-paper" style={{ transform: open ? "rotate(-45deg) translate(2px,-2px)" : "none", transition: "transform .2s" }} />
        </button>
      </nav>

      {/* 移动端抽屉 */}
      <div
        className="md:hidden overflow-hidden transition-[max-height,opacity] duration-300"
        style={{ maxHeight: open ? 320 : 0, opacity: open ? 1 : 0, borderTop: open ? "1px solid var(--line)" : "none" }}
      >
        <ul className="pad-x flex flex-col py-4">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="flex items-baseline justify-between py-3 text-base"
                style={{ color: isActive(l.href) ? "var(--accent)" : "var(--paper)" }}
              >
                <span>{l.label}</span>
                <span className="mono" style={{ color: "var(--faint)" }}>{l.en}</span>
              </Link>
            </li>
          ))}
          <li className="pt-2">
            <UserMenu />
          </li>
        </ul>
      </div>
    </header>
  );
}
