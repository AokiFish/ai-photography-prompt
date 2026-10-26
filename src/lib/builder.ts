// 提示词构建器（/builder）的类型、逻辑与数据入口。
//
// ⚠ 数据与采集数据集（data/prompts.json / D1 的 prompts 表）**完全分开**：
// 构建器的维度、选项、预设都存在 **data/builder.json** 里，属于独立的静态数据文件，
// 不进 prompts 表、不与 PRMPT 采集数据混合。改文案/加选项改那份 JSON 即可。
//
// 每个选项带：
//   zh   — 中文名（界面显示）
//   desc — 中文一句话注解（告诉用户这会带来什么画面效果）
//   en   — 拼进最终提示词的英文短语（写给 Midjourney / SD / Nano Banana 等模型）
//   thumb— 效果参考图（public/thumbs/ 下的文件名；画幅类没有图）
//
// 页面锚点与 hash 路由一一对应：#cat-style / #cat-expr / #cat-camera / #cat-shot /
// #cat-angle / #cat-lens / #cat-aperture / #cat-motion / #cat-light / #cat-texture /
// #cat-mood / #cat-comp / #cat-ratio。

import raw from "../../data/builder.json";

export interface BuilderOption {
  id: string;
  zh: string;
  desc: string;
  en: string;
  thumb: string | null;
}

export interface BuilderCategory {
  id: string; // 与 hash 后缀一致：cat-<id>
  zh: string;
  en: string;
  hint: string;
  /** true = 可多选（只有「细节质感」需要叠加） */
  multi?: boolean;
  options: BuilderOption[];
}

export interface BuilderPreset {
  id: string;
  zh: string;
  en: string;
  realism?: boolean;
  sel: Record<string, string | string[]>;
}

// JSON 的字面量类型过窄（各预设 sel 的键不同），先转 unknown 再断言成目标结构。
const DATA = raw as unknown as {
  thumbBase: string;
  realismCue: string;
  avoidPack: string[];
  categories: BuilderCategory[];
  presets: BuilderPreset[];
};

export const BUILDER_CATEGORIES: BuilderCategory[] = DATA.categories;
export const BUILDER_PRESETS: BuilderPreset[] = DATA.presets;

/** Realism mode 追加的真实感提示语。 */
export const REALISM_CUE: string = DATA.realismCue;

/** Realism mode 的「排除词包」（负向提示词）。 */
export const AVOID_PACK: string[] = DATA.avoidPack;

/** 选项参考图的站点路径（无图返回 null）。 */
export function thumbUrl(o: BuilderOption): string | null {
  return o.thumb ? `${DATA.thumbBase}${o.thumb}` : null;
}

export type BuilderSelection = Record<string, string[]>;

/** 空选择（每类一个空数组）。 */
export function emptySelection(): BuilderSelection {
  return Object.fromEntries(BUILDER_CATEGORIES.map((c) => [c.id, []]));
}

/** 每类随机挑一项（多选类挑 2 项）——「Surprise me」用。 */
export function randomSelection(): BuilderSelection {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const sel: BuilderSelection = emptySelection();
  for (const c of BUILDER_CATEGORIES) {
    if (!c.options.length) continue;
    if (c.multi) {
      const pool = [...c.options];
      const n = Math.min(2, pool.length);
      const chosen: BuilderOption[] = [];
      for (let i = 0; i < n; i++) {
        chosen.push(pick(pool));
        pool.splice(
          pool.findIndex((x) => x.id === chosen[i].id),
          1
        );
      }
      sel[c.id] = chosen.map((o) => o.id);
    } else {
      sel[c.id] = [pick(c.options).id];
    }
  }
  return sel;
}

const optionById = (catId: string, optId: string) =>
  BUILDER_CATEGORIES.find((c) => c.id === catId)?.options.find((o) => o.id === optId);

/** 已选摘要（按面板要展示的顺序）。 */
export function summaryOf(sel: BuilderSelection) {
  const out: { cat: BuilderCategory; opts: BuilderOption[] }[] = [];
  for (const c of BUILDER_CATEGORIES) {
    const opts = (sel[c.id] ?? [])
      .map((id) => optionById(c.id, id))
      .filter(Boolean) as BuilderOption[];
    if (opts.length) out.push({ cat: c, opts });
  }
  return out;
}

/** 把预设铺成一份选择（未涉及的维度清空，保证「一键换一套」而不是叠加）。 */
export function selectionFromPreset(preset: BuilderPreset): BuilderSelection {
  const sel = emptySelection();
  for (const c of BUILDER_CATEGORIES) {
    const v = preset.sel[c.id];
    if (v === undefined) continue;
    sel[c.id] = Array.isArray(v) ? [...v] : [v];
  }
  return sel;
}

export type BuilderDetails = {
  /** 主题详情 */
  details: string;
  /** 动作与姿势 */
  action: string;
  /** 环境 */
  env: string;
};

export const EMPTY_DETAILS: BuilderDetails = { details: "", action: "", env: "" };

/**
 * 把选择拼成一条自然语言英文提示词。
 *
 * 顺序按「摄影工作流」：先说画面里有什么（主题详情 → 动作姿势 → 环境），
 * 再说怎么拍的（风格 → 机身 → 镜头 → 光圈 → 景别 → 机位 → 光 → 色调
 * → 构图 → 质感细节 → 运动 → 表情 → 画幅），最后补 Realism 提示语。
 *
 * 开启 Realism mode 时额外返回一段「排除词包」作为负向提示词。
 */
export function buildPrompt(
  sel: BuilderSelection,
  details: BuilderDetails = EMPTY_DETAILS,
  realism = false
): { prompt: string; negative: string } {
  const take = (id: string) =>
    (sel[id] ?? [])
      .map((o) => optionById(id, o)?.en)
      .filter(Boolean) as string[];

  const scene = [details.details, details.action, details.env]
    .map((s) => (s ?? "").trim().replace(/\s+/g, " "))
    .filter(Boolean);

  const parts: string[] = [...scene];
  parts.push(...take("style"));
  parts.push(...take("camera"));
  parts.push(...take("lens"));
  parts.push(...take("aperture"));
  parts.push(...take("shot"));
  parts.push(...take("angle"));
  parts.push(...take("light"));
  parts.push(...take("mood"));
  parts.push(...take("comp"));
  parts.push(...take("texture"));
  parts.push(...take("motion"));
  parts.push(...take("expr"));
  parts.push(...take("ratio"));
  if (realism) parts.push(REALISM_CUE);

  const unique = [...new Set(parts)];
  return {
    prompt: unique.length ? `${unique.join(", ")}.` : "",
    negative: realism ? `Avoid: ${AVOID_PACK.join(", ")}.` : "",
  };
}
