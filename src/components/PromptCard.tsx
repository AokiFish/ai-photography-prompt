"use client";

import type { Prompt } from "@/lib/types";
import { STYLE_LABELS } from "@/lib/types";
import { PlateImage } from "@/components/PlateImage";
import { CopyButton } from "@/components/CopyButton";
import { SaveButton } from "@/components/SaveButton";

export function PromptCard({ prompt, onOpen }: { prompt: Prompt; onOpen?: () => void }) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.();
        }
      }}
      className="group relative flex cursor-pointer flex-col border border-line bg-ink-2 transition-[transform,border-color] duration-500 ease-editorial hover:-translate-y-1 hover:border-line-strong"
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <div className="absolute inset-0 transition-transform duration-700 ease-editorial group-hover:scale-[1.04]">
          <PlateImage
            src={prompt.imageUrl}
            alt={prompt.title ?? prompt.promptText.slice(0, 40)}
            styleKey={prompt.style}
            label={STYLE_LABELS[prompt.style]}
          />
        </div>
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span className="mono rounded" style={{ background: "rgba(20,20,20,.6)", color: "var(--paper-2)", padding: "4px 9px", backdropFilter: "blur(3px)" }}>
            {STYLE_LABELS[prompt.style]}
          </span>
        </div>
        <span
          className="mono pointer-events-none absolute bottom-3 right-3 rounded opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: "rgba(20,20,20,.6)", color: "var(--paper)", padding: "4px 9px", fontSize: 10.5, backdropFilter: "blur(3px)" }}
        >
          查看大图 ↗
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {prompt.title && (
          <h3 className="serif" style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.2 }}>
            {prompt.title}
          </h3>
        )}
        {prompt.category && (
          <span className="mono" style={{ color: "var(--faint)" }}>{prompt.category}</span>
        )}
        <p className="line-clamp-4" style={{ fontFamily: "var(--font-mono),monospace", fontSize: 12.5, lineHeight: 1.7, color: "var(--paper-2)" }}>
          {prompt.promptText}
        </p>
        {prompt.negativePrompt && (
          <p className="line-clamp-2" style={{ fontFamily: "var(--font-mono),monospace", fontSize: 11.5, lineHeight: 1.6, color: "var(--faint)" }}>
            <span style={{ color: "var(--accent)" }}>neg </span>
            {prompt.negativePrompt}
          </p>
        )}
        <div
          className="mt-auto flex items-center gap-2 pt-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <CopyButton text={prompt.promptText} label="复制" />
          <SaveButton id={prompt.id} />
        </div>
      </div>
    </article>
  );
}
