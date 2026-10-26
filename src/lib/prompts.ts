import { getDB } from "@/lib/db";
import { SEED_PROMPTS } from "@/data/seed";
import { resolveDetailUrl, promptSlug } from "@/lib/types";
import type { Prompt, Source, StyleKey } from "@/lib/types";

interface PromptRow {
  id: string;
  source: string;
  source_url: string | null;
  title: string | null;
  abstract?: string | null;
  prompt_text: string;
  negative_prompt: string | null;
  category: string | null;
  style: string;
  model: string | null;
  image_url: string | null;
  width: number | null;
  height: number | null;
  tags: string | null;
  collected_at: number;
}

// 历史遗留：旧采集器曾把中文分类直接入 DB，与现筛选行的英文键不一致。
// 读取时反向归一为官方 12 分类键，清理脏数据，无需重爬。
const CN_CATEGORY_TO_KEY: Record<string, string> = {
  人像: "portrait",
  建筑: "architectural",
  纪实: "lifestyle",
  自然: "landscape",
  夜景: "cinematic",
  时尚: "fashion",
  风光: "landscape",
  艺术: "artistic",
  汽车: "automotive",
  内衣: "lingerie",
  浪漫: "romantic",
  浪漫主义: "romantic",
  生活方式: "lifestyle",
  产品: "product",
  电影: "cinematic",
  肖像: "portrait",
  美妆: "beauty",
};

function normalizeReadCategory(raw: string | null): string | null {
  if (!raw) return null;
  if (raw in CN_CATEGORY_TO_KEY) return CN_CATEGORY_TO_KEY[raw];
  // 已是英文键则原样返回（PRO_CATEGORIES 键）
  return raw;
}

function rowToPrompt(r: PromptRow): Prompt {
  let tags: string[] = [];
  if (r.tags) {
    try {
      const parsed = JSON.parse(r.tags);
      if (Array.isArray(parsed)) tags = parsed;
    } catch {
      tags = [];
    }
  }
  return {
    id: r.id,
    source: r.source as Source,
    sourceUrl: r.source_url,
    title: r.title,
    abstract: r.abstract ?? null,
    promptText: r.prompt_text,
    negativePrompt: r.negative_prompt,
    category: normalizeReadCategory(r.category),
    style: r.style as StyleKey,
    model: r.model,
    imageUrl: r.image_url,
    width: r.width,
    height: r.height,
    tags,
    collectedAt: r.collected_at,
  };
}

export interface PromptFilters {
  source?: Source;
  style?: StyleKey;
  category?: string;
  q?: string;
}

export async function getPrompts(filters: PromptFilters = {}): Promise<Prompt[]> {
  const db = getDB();
  if (db) {
    // 全量取出后在内存中去重 + 过滤：确保同一张图（同 image_url）只保留一条，
    // 作为它的“主类别”归属，杜绝跨「核心 / 专业」筛选重复出现。
    const stmt = db.prepare("SELECT * FROM prompts ORDER BY collected_at DESC");
    const { results } = await stmt.all<PromptRow>();
    const all = results.map(rowToPrompt);
    if (all.length === 0) return SEED_PROMPTS.filter(applySeedFilter(filters));
    const rows = dedupeByImage(all).filter(applySeedFilter(filters));
    return rows.sort((a, b) => b.collectedAt - a.collectedAt);
  }
  // 本地兜底（seed 为人工精排，保留全部，不去重以免合并不同提示词）
  return SEED_PROMPTS.filter(applySeedFilter(filters));
}

/**
 * 按图去重：同一 image_url 只保留一条，作为它的“主类别”归属，
 * 杜绝跨「核心 / 专业」筛选重复出现。
 *
 * 保留规则不是“谁采集得早”，而是**信息质量优先**：
 * 有真实内页链接 > 有标题 > 有分类 > 采集时间早。
 * 早期首页兜底写入的脏记录（source_url 为站点根、无标题/分类）因此
 * 不会压制后来采集的完整记录——否则弹窗的「打开完整网页」会跳到源站首页。
 * image_url 为空的行无法按图去重，按各自 id 保留。
 */
function dedupeByImage(rows: Prompt[]): Prompt[] {
  const byImg = new Map<string, Prompt>();
  const noImg: Prompt[] = [];
  const score = (p: Prompt) =>
    (resolveDetailUrl(p) ? 4 : 0) + (p.title ? 2 : 0) + (p.category ? 1 : 0);
  // 质量分降序 + 采集时间升序：同分时保留最早的一条
  const sorted = [...rows].sort(
    (a, b) => score(b) - score(a) || a.collectedAt - b.collectedAt
  );
  for (const r of sorted) {
    if (r.imageUrl) {
      if (byImg.has(r.imageUrl)) continue;
      byImg.set(r.imageUrl, r);
    } else {
      noImg.push(r);
    }
  }
  return [...byImg.values(), ...noImg];
}

/**
 * 取**全部**行（不做按图去重）——收藏页要用：
 * 用户在图集里收藏的是 D1 里的真实 id，而 getPrompts() 会按 image_url 去重；
 * 被去重掉的那条如果正好被收藏了，去重后就再也显示不出来。
 */
export async function getAllPrompts(): Promise<Prompt[]> {
  const db = getDB();
  if (db) {
    const stmt = db.prepare("SELECT * FROM prompts");
    const { results } = await stmt.all<PromptRow>();
    if (results.length) return results.map(rowToPrompt);
  }
  return SEED_PROMPTS;
}

export async function getPrompt(id: string): Promise<Prompt | null> {
  const db = getDB();
  if (db) {
    const stmt = db.prepare("SELECT * FROM prompts WHERE id = ?");
    stmt.bind(id);
    const row = await stmt.first<PromptRow>();
    if (row) return rowToPrompt(row);
  }
  return SEED_PROMPTS.find((p) => p.id === id) ?? null;
}

/**
 * 按「站内详情页 slug」取单条提示词（/prompt/<slug> 路由用）。
 * slug 由 promptSlug() 从 sourceUrl 或 id 派生，与卡片「打开完整网页」同源，
 * 保证图集点进去和路由直达是同一张图。找不到返回 null（详情页应 404）。
 */
export async function getPromptBySlug(slug: string): Promise<Prompt | null> {
  const db = getDB();
  if (db) {
    const stmt = db.prepare("SELECT * FROM prompts");
    const { results } = await stmt.all<PromptRow>();
    for (const r of results) {
      if (promptSlug(rowToPrompt(r)) === slug) return rowToPrompt(r);
    }
    return null;
  }
  return SEED_PROMPTS.find((p) => promptSlug(p) === slug) ?? null;
}

/**
 * 详情页底部的关联卡片（对齐源站的「More in <category>」与「Related prompts」）：
 *   moreInCategory —— 同一专业分类的其他提示词
 *   related        —— 排除上面这批后，按「同摄影语言 → 有共同标签」兜底推荐
 * 都排除当前这条本身，并沿用已有的按图去重（同图只留一条主记录）。
 */
export async function getRelatedPrompts(
  prompt: Prompt,
  { moreLimit = 8, relatedLimit = 8 }: { moreLimit?: number; relatedLimit?: number } = {}
): Promise<{ moreInCategory: Prompt[]; related: Prompt[] }> {
  const all = await getPrompts();
  const moreInCategory = prompt.category
    ? all.filter((p) => p.id !== prompt.id && p.category === prompt.category).slice(0, moreLimit)
    : [];

  const used = new Set([prompt.id, ...moreInCategory.map((p) => p.id)]);
  const sharesTag = (p: Prompt) => !!prompt.tags?.length && !!p.tags?.some((t) => prompt.tags?.includes(t));

  const related = all
    .filter((p) => !used.has(p.id))
    .filter((p) => p.style === prompt.style || sharesTag(p))
    .slice(0, relatedLimit);

  return { moreInCategory, related };
}

export interface Facets {
  sources: { key: Source; count: number }[];
  styles: { key: StyleKey; count: number }[];
  categories: { name: string; count: number }[];
  total: number;
}

export async function getFacets(): Promise<Facets> {
  const all = await getPrompts();
  const srcMap = new Map<Source, number>();
  const styleMap = new Map<StyleKey, number>();
  const catMap = new Map<string, number>();
  for (const p of all) {
    srcMap.set(p.source, (srcMap.get(p.source) ?? 0) + 1);
    styleMap.set(p.style, (styleMap.get(p.style) ?? 0) + 1);
    if (p.category) catMap.set(p.category, (catMap.get(p.category) ?? 0) + 1);
  }
  return {
    sources: [...srcMap.entries()].map(([key, count]) => ({ key, count })),
    styles: [...styleMap.entries()].map(([key, count]) => ({ key, count })),
    categories: [...catMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    total: all.length,
  };
}

function applySeedFilter(filters: PromptFilters) {
  return (p: Prompt) => {
    if (filters.source && p.source !== filters.source) return false;
    if (filters.style && p.style !== filters.style) return false;
    if (filters.category && p.category !== filters.category) return false;
    if (filters.q) {
      const hay = (p.promptText + " " + (p.title ?? "") + " " + (p.category ?? "")).toLowerCase();
      if (!hay.includes(filters.q.toLowerCase())) return false;
    }
    return true;
  };
}
