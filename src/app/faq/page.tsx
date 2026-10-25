import { Reveal } from "@/components/Reveal";
import { FaqList } from "@/components/FaqList";

export const metadata = {
  title: "问答",
  description: "关于 AI 摄影提示词图鉴的常见问题：模型适配、数据更新、分类逻辑与收藏。",
};

export default function FaqPage() {
  return (
    <div className="pad-x" style={{ paddingTop: "clamp(40px,7vh,80px)", paddingBottom: "clamp(60px,9vh,110px)" }}>
      <Reveal>
        <div className="kicker" style={{ marginBottom: 22 }}>
          <span className="lbl mono">问答 · FAQ</span>
          <span className="rule" />
        </div>
        <h1 className="display" style={{ fontSize: "clamp(34px,6vw,72px)", marginBottom: 14 }}>
          常见问题
        </h1>
        <p style={{ maxWidth: "42em", color: "var(--muted)", fontSize: 15, lineHeight: 1.8 }}>
          关于模型适配、数据更新频率、分类逻辑与收藏机制。没找到答案？项目仓库里提 issue。
        </p>
      </Reveal>

      <Reveal>
        <div className="mt-9">
          <FaqList />
        </div>
      </Reveal>
    </div>
  );
}
