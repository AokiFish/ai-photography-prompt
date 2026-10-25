"use client";

import { useState } from "react";

const QA = [
  {
    q: "这些提示词是给哪些模型用的？",
    a: "提示词是描述性的摄影语言，跨模型通用。标注了模型的条目（如 Midjourney、SDXL）仅供参考；多数提示词在 Midjourney、Stable Diffusion、FLUX 等主流模型上都能直接复用。",
  },
  {
    q: "图集里的数据多久更新一次？",
    a: "GitHub Action 每天 08:00（北京时间）运行一次采集工作流，以安全间隔轮询 PRMPT 与 Lexica，去重后写入 Cloudflare D1。站点读取即时反映最新数据。",
  },
  {
    q: "为什么数据要按来源和语言分类？",
    a: "不同来源的提示词风格差异很大（PRMPT 偏编辑/时尚，Lexica 偏社区多样）。按「来源 + 摄影语言」双维度归类，既保留出处可追溯，又便于按风格策展检索，避免把所有内容混成一桶。",
  },
  {
    q: "收藏会同步到别的设备吗？",
    a: "不会。收藏保存在你当前浏览器的 localStorage，无需登录、无追踪。这是有意保持轻量的取舍——若需要跨设备同步，后续可接入账号体系。",
  },
  {
    q: "图片加载不出来怎么办？",
    a: "部分采集到的图像链接可能失效或需鉴权。任一图像加载失败时，卡片会自动回退到与摄影语言对应的渐变占位（编辑式「印样」风格），提示词与收藏功能不受影响。",
  },
  {
    q: "可以自己提交提示词吗？",
    a: "当前版本为只读画廊。采集器面向公开来源。若你想贡献，欢迎在仓库提 PR，或等待后续「用户投稿」功能。",
  },
];

export function FaqList() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="border-t" style={{ borderColor: "var(--line)" }}>
      {QA.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ borderBottom: "1px solid var(--line)" }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-6 py-6 text-left"
            >
              <span className="serif" style={{ fontSize: "clamp(18px,2.4vw,24px)", fontWeight: 500, lineHeight: 1.25 }}>
                {item.q}
              </span>
              <span
                className="mono shrink-0"
                style={{ color: "var(--accent)", fontSize: 22, transition: "transform .3s", transform: isOpen ? "rotate(45deg)" : "none" }}
                aria-hidden
              >
                +
              </span>
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-500 ease-editorial"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="max-w-prose pb-7" style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.9 }}>
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
