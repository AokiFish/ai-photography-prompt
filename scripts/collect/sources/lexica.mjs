// Lexica 采集器 — https://lexica.art/
// 社区图像 / 提示词搜索引擎。
//
// 端点（已知结构，需按真实响应核对）：
//   GET https://lexica.art/api/v1/search?q=<query>&cursor=<n>
//   → { images: [ { id, prompt, src, width, height, model, seed, ... } ], cursor, ... }
// 若端点/字段有变动，解析会失败并被下方 try/catch 吞掉（打印警告、跳过该查询），
// 不会中断整个工作流。请上线后按一次真实响应微调映射。

import { fetchJson, USER_AGENT } from "../util.mjs";

const API = "https://lexica.art/api/v1/search";

// 检索词 → 摄影语言 / 标签 映射
const QUERIES = [
  { q: "cinematic portrait", style: "cinematic", category: "人像" },
  { q: "minimalist architecture", style: "minimalist", category: "建筑" },
  { q: "35mm film street photography", style: "film", category: "纪实" },
  { q: "black and white portrait", style: "monochrome", category: "人像" },
  { q: "macro nature close up", style: "macro", category: "自然" },
  { q: "cyberpunk noir city", style: "noir", category: "夜景" },
  { q: "fashion editorial", style: "portrait", category: "时尚" },
  { q: "landscape fine art", style: "landscape", category: "风光" },
];

/**
 * @param {object} opts
 * @param {number} opts.perQuery 每个检索词最多采集条数
 * @param {number} opts.delay    请求间隔(ms)，遵守安全抓取间隔
 */
export async function collectLexica({ perQuery = 8, delay = 1500 } = {}) {
  const results = [];
  for (const { q, style, category } of QUERIES) {
    let cursor = 0;
    let fetched = 0;
    try {
      while (fetched < perQuery) {
        const url = `${API}?q=${encodeURIComponent(q)}&cursor=${cursor}`;
        let data;
        try {
          data = await fetchJson(url, { delay, accept: "application/json" });
        } catch (e) {
          console.warn(`[lexica] 查询 "${q}" 请求失败（跳过）: ${e.message}`);
          break;
        }
        const images = Array.isArray(data?.images) ? data.images : [];
        if (images.length === 0) break;

        for (const img of images) {
          if (!img?.prompt || !img?.id) continue;
          results.push({
            id: `lexica:${img.id}`,
            source: "lexica",
            sourceUrl: img.uri ? `https://lexica.art${img.uri}` : `https://lexica.art/prompt/${img.id}`,
            title: null,
            promptText: String(img.prompt).replace(/\s+/g, " ").trim().slice(0, 2000),
            negativePrompt: null,
            category,
            style,
            model: img.model ?? null,
            imageUrl: img.src ?? null,
            width: img.width ?? null,
            height: img.height ?? null,
            tags: [],
            collectedAt: Date.now(),
          });
          fetched++;
          if (fetched >= perQuery) break;
        }

        const next = data.cursor;
        if (next === undefined || next === null || next === cursor) break;
        cursor = next;
      }
      console.log(`[lexica] 查询 "${q}" 采集 ${fetched} 条`);
    } catch (e) {
      console.warn(`[lexica] 查询 "${q}" 异常: ${e.message}`);
    }
  }
  return results;
}

// 保留 USER_AGENT 引用，避免未使用告警（fetchJson 内部已用）
void USER_AGENT;
