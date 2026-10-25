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
    category: r.category,
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
    const where: string[] = [];
    const vals: unknown[] = [];
    if (filters.source) {
      where.push("source = ?");
      vals.push(filters.source);
    }
    if (filters.style) {
      where.push("style = ?");
      vals.push(filters.style);
    }
    if (filters.category) {
      where.push("category = ?");
      vals.push(filters.category);
    }
    if (filters.q) {
      where.push("(prompt_text LIKE ? OR title LIKE ? OR category LIKE ?)");
      vals.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
    }
    const sql =
      "SELECT * FROM prompts" +
      (where.length ? " WHERE " + where.join(" AND ") : "") +
      " ORDER BY collected_at DESC";
    const stmt = db.prepare(sql);
    stmt.bind(...vals);
    const { results } = await stmt.all<PromptRow>();
    const rows = results.map(rowToPrompt);
    return rows.length ? rows : SEED_PROMPTS.filter(applySeedFilter(filters));
  }
  // 本地兜底
  return SEED_PROMPTS.filter(applySeedFilter(filters));
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
