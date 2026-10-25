// Lexica 采集器 — https://lexica.art/
// 社区图像 / 提示词搜索引擎。
//
// 端点（已知结构，需按真实响应核对）：
//   GET https://lexica.art/api/v1/search?q=<query>&cursor=<n>
//   → { images: [ { id, prompt, src, width, height, model, seed, ... } ], cursor, ... }
// 若端点/字段有变动，解析会失败并被下方 try/catch 吞掉（打印警告、跳过该查询），
// 不会中断整个工作流。请上线后按一次真实响应微调映射。

import { fetchJson, BROWSER_UA, sleep } from "../util.mjs";

const API = "https://lexica.art/api/v1/search";

// 检索词 → 专业分类键（PRO_CATEGORIES 英文键）+ 核心风格键（CORE_STYLES）。
// category 用英文键，与图集筛选行传值一致；中文标签已由归一层统一，旧中文写法已弃用。
const QUERIES = [
  { q: "cinematic portrait", style: "cinematic", category: "portrait" },
  { q: "minimalist architecture", style: "minimalist", category: "architectural" },
  { q: "35mm film street photography", style: "film", category: "lifestyle" },
  { q: "black and white portrait", style: "monochrome", category: "portrait" },
  { q: "macro nature close up", style: "macro", category: "landscape" },
  { q: "cyberpunk noir city", style: "noir", category: "cinematic" },
  { q: "fashion editorial", style: "portrait", category: "fashion" },
  { q: "landscape fine art", style: "landscape", category: "landscape" },
];

/**
 * @param {object} opts
 * @param {number} opts.perQuery 每个检索词最多采集条数
 * @param {number} opts.delay    请求间隔(ms)，遵守安全抓取间隔
 */
export async function collectLexica({ perQuery = 8, delay = 3000, retries = 4 } = {}) {
  const results = [];
  // lexica 对 bot UA 返回 500/429，必须用浏览器 UA + Referer 绕过；
  // 服务端偶发 5xx / 限流（429）由 fetchText 内部重试 + 指数退避兜底。
  const headers = { "User-Agent": BROWSER_UA, Referer: "https://lexica.art/" };
  for (const { q, style, category } of QUERIES) {
    let cursor = 0;
    let fetched = 0;
    try {
      while (fetched < perQuery) {
        const url = `${API}?q=${encodeURIComponent(q)}&cursor=${cursor}`;
        let data;
        try {
          data = await fetchJson(url, { delay, accept: "application/json", headers, retries });
        } catch (e) {
          console.warn(`[lexica] 查询 "${q}" 请求失败（放弃该查询）: ${e.message}`);
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
    await sleep(delay); // 查询间隔，降低连续请求触发限流的概率
  }
  return results;
}

// lexica 请求头已改用 BROWSER_UA（util.mjs 导出），见 collectLexica 内 headers。
