import type { Metadata } from "next";
import { BuilderClient } from "@/components/BuilderClient";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "构建器",
  description:
    "像搭积木一样拼出一条摄影提示词：选风格、机身、镜头、光位、构图与画幅，右侧实时生成可直接复制的英文提示词。",
};

export default function BuilderPage() {
  return (
    <div style={{ paddingTop: "clamp(40px,7vh,80px)", paddingBottom: "clamp(60px,9vh,110px)" }}>
      <div className="pad-x">
        <Reveal>
          <div className="kicker" style={{ marginBottom: 22 }}>
            <span className="lbl mono">构建器 · BUILDER</span>
            <span className="rule" />
            <span className="mono" style={{ color: "var(--faint)" }}>
              13 个维度
            </span>
          </div>
          <h1 className="display" style={{ fontSize: "clamp(34px,6vw,72px)", marginBottom: 14 }}>
            提示词构建器
          </h1>
          <p style={{ maxWidth: "42em", color: "var(--muted)", fontSize: 15, lineHeight: 1.8 }}>
            先写一句「画面里有什么」，再点亮你想到的东西——风格、机身、镜头、光位、构图、画幅——右侧会实时拼出一条可以直接丢给图像模型的英文提示词，用到的词在左边都会打勾。懒得调参数，就按「Surprise me」或挑一个预设。
          </p>
        </Reveal>
      </div>

      <div className="mt-9">
        <BuilderClient />
      </div>
    </div>
  );
}
