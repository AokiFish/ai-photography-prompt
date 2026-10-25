"use client";

import { useState } from "react";
import type { Prompt } from "@/lib/types";
import { PromptCard } from "@/components/PromptCard";
import { PromptModal } from "@/components/PromptModal";
import { Reveal } from "@/components/Reveal";

export function GalleryClient({ prompts }: { prompts: Prompt[] }) {
  const [selected, setSelected] = useState<Prompt | null>(null);

  if (prompts.length === 0) {
    return (
      <p className="mono py-20 text-center" style={{ color: "var(--faint)" }}>
        没有匹配的提示词 — 调整筛选条件试试
      </p>
    );
  }

  return (
    <>
      <div className="mt-9 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {prompts.map((p, i) => (
          <Reveal key={p.id} delay={(i % 4) as 0 | 1 | 2 | 3}>
            <PromptCard prompt={p} onOpen={() => setSelected(p)} />
          </Reveal>
        ))}
      </div>
      {selected && <PromptModal prompt={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
