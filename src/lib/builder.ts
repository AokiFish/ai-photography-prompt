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

/** 右侧预览里「场景描述」为空时的占位符（与源站一致，提示用户这里该填主体）。 */
export const SCENE_PLACEHOLDER = "[describe the scene]";

/**
 * 把选择拼成一条自然语言英文提示词。
 *
 * 顺序按「摄影工作流」：
 *   1) 场景描述（左侧顶部大输入框，空则用 [describe the scene] 占位）
 *   2) 主题详情 → 动作姿势 → 环境（More detail）
 *   3) 怎么拍的：风格 → 机身 → 镜头 → 光圈 → 景别 → 机位 → 光 → 色调
 *      → 构图 → 质感细节 → 运动 → 表情 → 画幅
 *   4) Realism 提示语
 *
 * 开启 Realism mode 时额外返回一段「排除词包」作为负向提示词。
 */
/** Realism mode 的提示说明（开启时显示，中文在前英文在后）。 */
export const REALISM_NOTE = {
  en: "Realism mode pushes toward photography and fights the Anime style.",
  zh: "写实模式更偏向摄影，反对动漫风格。",
};

// ──────────── 输出模型：同一套选择，按不同模型的口味排版 ────────────
export interface BuilderModel {
  id: "mj" | "sd" | "nat" | "nb";
  zh: string;
  en: string;
  note: string;
}

export const BUILDER_MODELS: BuilderModel[] = [
  { id: "mj", zh: "Midjourney", en: "Midjourney", note: "短语优先，最重要的放最前，参数放末尾。" },
  { id: "sd", zh: "Stable Diffusion", en: "Stable Diffusion", note: "标签式主体 + 独立负向提示词，附 SDXL 尺寸。" },
  { id: "nat", zh: "自然语言", en: "Natural language", note: "给 GPT Image / Imagen / Flux 这类模型的通顺英文句子。" },
  { id: "nb", zh: "Nano Banana Pro", en: "Nano Banana Pro", note: "带标签的结构化简报，适合它的思考步骤。" },
];

/** 各画幅对应的 --ar 参数与 SDXL 建议尺寸。 */
const RATIO_AR: Record<string, string> = {
  "1-1": "1:1",
  "4-5": "4:5",
  "3-2": "3:2",
  "16-9": "16:9",
  "9-16": "9:16",
  "21-9": "21:9",
};
const RATIO_SIZE: Record<string, string> = {
  "1-1": "1024×1024",
  "4-5": "896×1152",
  "3-2": "1216×832",
  "16-9": "1344×768",
  "9-16": "768×1344",
  "21-9": "1536×640",
};

/** 分段结构：把「选了什么」按维度拆开，供不同模型各自排版。 */
export interface BuilderSegments {
  /** 场景描述；未填且有其内容时为 [describe the scene] 占位符 */
  subject: string;
  /** More detail 三项：主题详情 / 动作姿势 / 环境 */
  details: string[];
  /** 各摄影维度的英文短语（键 = 维度 id） */
  byCat: Record<string, string[]>;
  /** Realism 提示语（开启时才有） */
  realism: string[];
  /** 画幅 id（mj / sd 用来算参数与尺寸） */
  ratioId: string | null;
}

const DETAIL_LABELS = { details: "details", action: "action", env: "env" } as const;

/** 把当前状态拆成分段（不排版），供 renderPrompt 按模型渲染。 */
export function buildSegments(
  sel: BuilderSelection,
  details: BuilderDetails = EMPTY_DETAILS,
  realism = false,
  subject = ""
): { segments: BuilderSegments; negative: string } {
  const byCat: Record<string, string[]> = {};
  for (const c of BUILDER_CATEGORIES) {
    if (c.id === "ratio") continue;
    const vals = (sel[c.id] ?? [])
      .map((id) => optionById(c.id, id)?.en)
      .filter(Boolean) as string[];
    if (vals.length) byCat[c.id] = vals;
  }

  const detailList = [details.details, details.action, details.env]
    .map((s) => (s ?? "").trim().replace(/\s+/g, " "))
    .filter(Boolean);

  const scene = subject.trim().replace(/\s+/g, " ");
  const ratioId = (sel.ratio ?? [])[0] ?? null;
  const hasOther = detailList.length > 0 || Object.keys(byCat).length > 0 || realism;

  return {
    segments: {
      subject: scene || (hasOther ? SCENE_PLACEHOLDER : ""),
      details: detailList,
      byCat,
      realism: realism ? [REALISM_CUE] : [],
      ratioId,
    },
    negative: realism ? AVOID_PACK.join(", ") : "",
  };
}

/** 按模型排版：mj 带 --ar/--no，sd 分正负两段 + 尺寸，nb 是带标签的简报。 */
export function renderPrompt(model: BuilderModel["id"], seg: BuilderSegments, negative: string): string {
  const flat = [seg.subject, ...seg.details, ...Object.values(seg.byCat).flat(), ...seg.realism].filter(Boolean);
  const unique = [...new Set(flat)];
  if (!unique.length) return "";

  const ratioKey = seg.ratioId ?? "";

  if (model === "mj") {
    const head = unique.join(", ");
    const ar = RATIO_AR[ratioKey] ? ` --ar ${RATIO_AR[ratioKey]}` : "";
    const no = negative ? ` --no ${negative}` : "";
    return `${head}.${ar}${no}`;
  }

  if (model === "sd") {
    const lines = [`Prompt: ${unique.join(", ")}.`];
    if (negative) lines.push("", `Negative prompt: ${negative}.`);
    if (RATIO_SIZE[ratioKey]) lines.push("", `Size: ${RATIO_SIZE[ratioKey]}`);
    return lines.join("\n");
  }

  if (model === "nb") {
    const label: Record<string, string> = {
      details: "Subject details",
      action: "Action and pose",
      env: "Environment",
      style: "Style",
      camera: "Camera",
      expr: "Expression",
      shot: "Shot size",
      angle: "Angle",
      lens: "Lens",
      aperture: "Depth of field",
      motion: "Motion",
      light: "Lighting",
      texture: "Detail and texture",
      mood: "Palette",
      comp: "Composition",
      ratio: "Aspect ratio",
      realism: "Realism",
    };
    const lines = [`Subject: ${seg.subject}`];
    seg.details.forEach((v, i) => {
      const key = Object.values(DETAIL_LABELS)[i] ?? `detail${i}`;
      lines.push(`${label[key] ?? key}: ${v}`);
    });
    for (const c of BUILDER_CATEGORIES) {
      if (c.id === "ratio") continue;
      const vals = seg.byCat[c.id];
      if (vals?.length) lines.push(`${label[c.id] ?? c.id}: ${vals.join(", ")}`);
    }
    if (seg.realism.length) lines.push("Realism: on");
    if (ratioKey) lines.push(`Aspect ratio: ${RATIO_AR[ratioKey] ?? ratioKey}`);
    if (negative) lines.push(`Avoid: ${negative}`);
    return lines.filter((l) => !/:\s*$/.test(l)).join("\n");
  }

  // nat：通顺的英文句子
  return `${unique.join(", ")}.${negative ? `\n\nAvoid: ${negative}.` : ""}`;
}

/** 兼容旧调用：默认按「自然语言」渲染。 */
export function buildPrompt(
  sel: BuilderSelection,
  details: BuilderDetails = EMPTY_DETAILS,
  realism = false,
  subject = ""
): { prompt: string; negative: string } {
  const { segments, negative } = buildSegments(sel, details, realism, subject);
  return { prompt: renderPrompt("nat", segments, negative), negative: negative ? `Avoid: ${negative}.` : "" };
}
