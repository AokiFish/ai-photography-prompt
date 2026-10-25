import { getDB } from "@/lib/db";
import { SEED_PROMPTS } from "@/data/seed";
import type { Prompt, Source, StyleKey } from "@/lib/types";

interface PromptRow {
  id: string;
  source: string;
  source_url: string | null;
  title: string | null;
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

// 历史遗留：旧 lexica 采集器曾把中文分类（人像/时尚…）直接入 DB，
// 与现筛选行的英文键不一致。读取时反向归一，清理脏数据，无需重爬。
const CN_CATEGORY_TO_KEY: Record<string, string> = {
  人像: "fashion",
  建筑: "architectural",
  纪实: "lifestyle",
  自然: "landscape",
  夜景: "noir",
  时尚: "fashion",
  风光: "landscape",
  艺术: "artistic",
  汽车: "automotive",
  内衣: "lingerie",
  浪漫: "romantic",
  生活方式: "lifestyle",
  产品: "product",
  电影: "artistic",
  肖像: "fashion",
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
 * 按图去重：同一 image_url 只保留最早采集的一条（其 style/category 即主归属）。
 * image_url 为空的行无法按图去重，按各自 id 保留。
 * 目的：每张图只在一个主类别里出现，不跨「核心 / 专业」筛选重复。
 */
function dedupeByImage(rows: Prompt[]): Prompt[] {
  const byImg = new Map<string, Prompt>();
  const noImg: Prompt[] = [];
  // 升序遍历：最早采集的一条作为该图的主记录
  const sorted = [...rows].sort((a, b) => a.collectedAt - b.collectedAt);
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
