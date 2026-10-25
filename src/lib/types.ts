// 数据模型 — 全站统一

export type Source = "prmpt" | "lexica";

export type StyleKey =
  | "cinematic"
  | "minimalist"
  | "film"
  | "monochrome"
  | "macro"
  | "noir"
  | "portrait"
  | "landscape"
  | "other";

export interface Prompt {
  id: string;
  source: Source; // 数据来源（分类维度之一）
  sourceUrl?: string | null;
  title?: string | null;
  promptText: string; // 核心/完整提示词
  negativePrompt?: string | null;
  category?: string | null; // 自由分类标签（中文，如「夜景」「人像」）
  style: StyleKey; // 摄影语言分类
  model?: string | null;
  imageUrl?: string | null;
  width?: number | null;
  height?: number | null;
  tags?: string[]; // 存储为 JSON，此处用数组
  collectedAt: number;
}

export interface SourceMeta {
  key: Source;
  label: string;
  lastRun?: number | null;
  status?: string | null;
  count?: number | null;
}

// 首页图鉴 plate（编辑式精排，不等同于 gallery 数据）
export interface HomePlate {
  num: string; // "01"
  title: string; // 中文名
  en: string; // 英文名
  style: StyleKey;
  tag: string; // 标签组
  desc: string;
  core: string; // 核心提示词
  full: string; // 完整提示词
  exif: string[]; // 拍摄参数
  imageUrl?: string | null;
}

export const STYLE_LABELS: Record<StyleKey, string> = {
  cinematic: "电影感",
  minimalist: "极简",
  film: "胶片",
  monochrome: "黑白",
  macro: "微距",
  noir: "夜影",
  portrait: "人像",
  landscape: "风光",
  other: "其他",
};

export const SOURCE_LABELS: Record<Source, string> = {
  prmpt: "PRMPT",
  lexica: "Lexica",
};

// 首页精选的 6 种核心风格 —— 图集「核心」筛选行固定展示，不随数据变化。
export const CORE_STYLES: StyleKey[] = [
  "cinematic",
  "minimalist",
  "film",
  "monochrome",
  "macro",
  "noir",
];

// 专业分类（英语键 → 中文标签）—— 图集「专业」筛选行。数据为采集后归类所用。
export const PRO_CATEGORIES: Record<string, string> = {
  architectural: "建筑",
  artistic: "艺术",
  automotive: "汽车",
  beauty: "美丽",
  cinematic: "电影",
  fashion: "时尚",
  landscape: "地貌",
  lifestyle: "生活方式",
  lingerie: "内衣",
  portrait: "肖像",
  product: "产品",
  romantic: "浪漫",
};

// 弹窗里的「类型介绍」——每种摄影语言的简要说明（编辑式口吻）。
export const STYLE_INTRO: Record<StyleKey, string> = {
  cinematic:
    "借电影机的取景与调色逻辑，强调光线方向、景深与情绪氛围，画面像一帧被定格的电影。",
  minimalist:
    "大量留白、克制构图与单一主体，用负空间制造呼吸感——越简单越难。",
  film: "模拟 35mm / 过期胶卷的色调与颗粒，光晕、漏光与轻微偏色造就怀旧质感。",
  monochrome:
    "剥离色彩后只剩光影与结构，靠反差与层次说话，适合人像与建筑。",
  macro: "极近对焦放大微观细节，浅景深把背景化成柔光，常拍自然与材质。",
  noir: "黑色电影美学：硬光、浓影、湿冷街道与霓虹，高反差营造悬疑。",
  portrait: "以人物为主体的肖像语言，讲究神情、用光与皮肤质感。",
  landscape: "广阔场景与大气透视，追求宁静、层次与自然的色彩克制。",
  other: "难以归入上述语言的混合风格。",
};
