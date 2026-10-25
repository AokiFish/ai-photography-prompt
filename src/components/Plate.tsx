import type { HomePlate } from "@/lib/types";
import { PlateImage } from "@/components/PlateImage";
import { CopyButton } from "@/components/CopyButton";
import { Reveal } from "@/components/Reveal";

interface PlateProps {
  plate: HomePlate;
  reverse?: boolean;
}

export function Plate({ plate, reverse = false }: PlateProps) {
  return (
    <Reveal>
      <article className="grid grid-cols-1 border-b border-line md:grid-cols-[0.92fr_1.08fr]">
        {/* 画框 */}
        <div
          className={`relative bg-ink-2 ${reverse ? "md:order-2" : ""}`}
          style={{ borderRight: reverse ? "none" : "1px solid var(--line)" }}
        >
          <div className="aspect-[4/5] w-full md:aspect-auto md:h-full">
            <PlateImage
              src={plate.imageUrl}
              alt={`${plate.title} 示例图`}
              styleKey={plate.style}
              label={`PLATE ${plate.num} · ${plate.en.toUpperCase()}`}
            />
          </div>
          <span
            className="mono absolute left-3 bottom-3 rounded"
            style={{ color: "rgba(237,231,218,.7)", background: "rgba(20,20,20,.55)", padding: "5px 10px", backdropFilter: "blur(3px)" }}
          >
            PLATE {plate.num} · {plate.en.toUpperCase()}
          </span>
        </div>

        {/* 标签 */}
        <div
          className={`flex flex-col gap-[22px] ${reverse ? "md:order-1" : ""}`}
          style={{ background: "var(--ink-2)", padding: "clamp(28px,4vw,52px) var(--pad)" }}
        >
          <div className="flex items-start gap-5">
            <div className="serif" style={{ fontSize: "clamp(34px,4.5vw,54px)", color: "var(--accent)", lineHeight: 1, minWidth: "1.4em" }}>
              {plate.num}
            </div>
            <div>
              <h2 className="serif" style={{ fontSize: "clamp(30px,4vw,46px)", lineHeight: 1.05, fontWeight: 500, letterSpacing: "-.01em" }}>
                {plate.title}
                <span className="block" style={{ fontFamily: "var(--font-sans),sans-serif", fontWeight: 400, fontSize: ".42em", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--muted)", marginTop: 8 }}>
                  {plate.en}
                </span>
              </h2>
            </div>
          </div>

          <span
            className="mono inline-flex w-fit items-center gap-2 rounded-full"
            style={{ border: "1px solid var(--line-strong)", padding: "5px 12px", color: "var(--paper-2)" }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }} />
            {plate.tag}
          </span>

          <p style={{ fontSize: "clamp(14px,1.6vw,16px)", lineHeight: 1.85, maxWidth: "44em" }}>{plate.desc}</p>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2.5">
              <span className="mono flex items-center gap-3" style={{ color: "var(--accent)" }}>
                核心提示词 · CORE
                <span className="h-px flex-1" style={{ background: "var(--line)" }} />
              </span>
              <div style={{ borderLeft: "2px solid var(--accent)", padding: "6px 0 6px 16px", fontFamily: "var(--font-mono),monospace", fontSize: "clamp(12.5px,1.4vw,14.5px)", lineHeight: 1.75, color: "var(--paper-2)" }}>
                {plate.core}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="mono flex items-center gap-3" style={{ color: "var(--accent)" }}>
                完整提示词 · FULL
                <span className="h-px flex-1" style={{ background: "var(--line)" }} />
              </span>
              <div className="relative" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "18px 54px 18px 18px", background: "var(--ink-3)" }}>
                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-mono),monospace", fontSize: "clamp(12px,1.3vw,13.5px)", lineHeight: 1.8, color: "var(--paper)" }}>
                  {plate.full}
                </pre>
                <div className="absolute right-3 top-3">
                  <CopyButton text={plate.full} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2" style={{ paddingTop: 18, borderTop: "1px solid var(--line)" }}>
            {plate.exif.map((e) => (
              <span key={e} className="mono flex items-center gap-2" style={{ color: "var(--muted)" }}>
                <span style={{ color: "var(--accent)" }}>·</span>
                {e}
              </span>
            ))}
          </div>
        </div>
      </article>
    </Reveal>
  );
}
