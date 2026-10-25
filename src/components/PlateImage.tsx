"use client";

import { useState } from "react";
import type { StyleKey } from "@/lib/types";

const GRADIENTS: Record<StyleKey, string> = {
  cinematic: "linear-gradient(135deg,#0b1f24 0%,#2a1a0e 60%,#3a2410 100%)",
  minimalist: "linear-gradient(135deg,#221d15 0%,#3a3326 100%)",
  film: "linear-gradient(135deg,#2a1c10 0%,#1a120a 100%)",
  monochrome: "linear-gradient(135deg,#0c0c0c 0%,#2b2b2b 100%)",
  macro: "linear-gradient(135deg,#0e1f12 0%,#16331c 100%)",
  noir: "linear-gradient(135deg,#0a1622 0%,#1a0a1e 100%)",
  portrait: "linear-gradient(135deg,#241a12 0%,#33241a 100%)",
  landscape: "linear-gradient(135deg,#101a22 0%,#1c2a33 100%)",
  other: "linear-gradient(135deg,#161616 0%,#262626 100%)",
};

interface PlateImageProps {
  src?: string | null;
  alt: string;
  styleKey: StyleKey;
  label?: string;
  className?: string;
  bare?: boolean; // 弹窗大图：不显示角落标签
}

// 有图显示图；无图或加载失败则回退到与风格对应的渐变占位（编辑式「印样」美学）。
export function PlateImage({ src, alt, styleKey, label, className = "", bare = false }: PlateImageProps) {
  const [errored, setErrored] = useState(false);
  const showImg = src && !errored;

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ background: GRADIENTS[styleKey] }}
    >
      {showImg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      )}
      {!showImg && !bare && (
        <div className="absolute inset-0 flex items-end p-4">
          <span className="mono" style={{ color: "rgba(237,231,218,.7)" }}>
            {label ?? "PLATE"}
          </span>
        </div>
      )}
      {/* 暗角，强化胶片/画廊感 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: "inset 0 0 120px 20px rgba(0,0,0,.45)",
        }}
      />
    </div>
  );
}
