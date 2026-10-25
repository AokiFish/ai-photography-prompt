// Lexica 采集器 — https://lexica.art/
//
// 采集策略（2026-10 修正）：lexica 官方搜索 API（/api/v1/search）对本机裸 fetch 被
// Cloudflare 拦（500/524）。故主路径用「无头浏览器内同源 fetch」调官方 API（见
// browser.mjs：先过质询、再同源请求，Cloudflare 不再拦），直接拿到每条的完整 prompt
// + 图片 + 尺寸 + 模型，无需再爬详情页。浏览器不可用时（本地未装 playwright）回退到
// 旧的 HTML 解析路径（搜索页锚点 + 首页兜底），但数据中心 IP 下该路径通常 0 条。
//
// 检索词 → 专业分类键（PRO_CATEGORIES 英文键）+ 核心风格键（CORE_STYLES）。

import { fetchText, BROWSER_UA, sleep } from "../util.mjs";
import { lexicaSearch } from "../browser.mjs";

const BASE = "https://lexica.art";

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

// ── API 路径：官方 /api/v1/search 的 JSON ────────────────────────────────
function apiRecord(img, { style, category }) {
  if (!img?.prompt || !img?.id) return null;
  return {
    id: `lexica:${img.id}`,
    source: "lexica",
    sourceUrl: `${BASE}/prompt/${img.id}`,
    title: null,
    promptText: String(img.prompt).replace(/\s+/g, " ").trim().slice(0, 2000),
    negativePrompt: null,
    category,
    style,
    model: img.model ?? null,
    imageUrl: img.src ?? img.srcSmall ?? null,
    width: img.width ?? null,
    height: img.height ?? null,
    tags: [],
    collectedAt: Date.now(),
  };
}

// ── 回退路径：HTML 解析（仅浏览器不可用时触发） ──────────────────────────
function searchUrls(q) {
  const eq = encodeURIComponent(q);
  return [`${BASE}/?q=${eq}`, `${BASE}/search?q=${eq}`, `${BASE}/prompt?q=${eq}`];
}
function parseCards(html) {
  const a = parseCardsFromAnchors(html);
  return a.length ? a : parseCardsFromNextData(html);
}
function parseCardsFromAnchors(html) {
  const cards = [];
  const seen = new Set();
  const re = /<a[^>]+href=["']([^"']*\/prompt\/[^"']+)["'][\s\S]*?<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    const id = href.replace(/^.*\/prompt\//, "").replace(/[?#].*$/, "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const imgM = m[0].match(/<img[^>]+src=["']([^"']+)["']/i);
    cards.push({ id, sourceUrl: href.startsWith("http") ? href : BASE + href, galleryImage: imgM ? imgM[1] : null });
  }
  return cards;
}
function parseCardsFromNextData(html) {
  const nd = html.match(/<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!nd) return [];
  let data;
  try { data = JSON.parse(nd[1]); } catch { return []; }
  const cards = [];
  const seen = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      const id = typeof v.id === "string" ? v.id : null;
      const prompt = typeof v.prompt === "string" ? v.prompt : null;
      const src = typeof v.src === "string" ? v.src : typeof v.image === "string" ? v.image : null;
      if (id && prompt && src && !seen.has(id)) {
        seen.add(id);
        cards.push({ id, sourceUrl: `${BASE}/prompt/${id}`, galleryImage: src });
      }
      Object.values(v).forEach(walk);
    }
  };
  walk(data);
  return cards;
}
function extractDetail(html) {
  const og = (p) => {
    const m = html.match(new RegExp(`<meta[^>]+property=["']${p}["'][^>]+content=["']([^"']+)["']`, "i"));
    return m ? m[1].trim() : "";
  };
  const blocks = [...html.matchAll(/<(pre|code)[^>]*>([\s\S]*?)<\/\1>/gi)].map((x) => x[2]);
  const longest = blocks.sort((a, b) => b.length - a.length)[0] || "";
  const promptText = (longest && longest.length > 40 ? longest : og("og:description"))
    .replace(/\s+/g, " ").trim().slice(0, 2000);
  return { promptText: promptText || null, imageUrl: og("og:image") || null };
}

/**
 * @param {object} opts
 * @param {number} opts.perQuery 每个检索词最多采集条数
 * @param {number} opts.delay    请求间隔(ms)
 */
export async function collectLexica({ perQuery = 8, delay = 3000 } = {}) {
  const results = [];
  const headers = { "User-Agent": BROWSER_UA, Referer: BASE + "/" };

  for (const q of QUERIES) {
    let fetched = 0;
    try {
      // 1) 主路径：无头浏览器内同源调官方 API
      const data = await lexicaSearch(q.q);
      if (data && Array.isArray(data.images)) {
        for (const img of data.images) {
          if (fetched >= perQuery) break;
          const rec = apiRecord(img, q);
          if (rec && rec.imageUrl) { results.push(rec); fetched++; }
        }
        console.log(`[lexica] 查询 "${q.q}" 采集 ${fetched} 条`);
      } else if (data === null) {
        // 2) 浏览器不可用 → 回退 HTML 解析（本地等情况）
        fetched = await fallbackHtml(q, { delay, headers, perQuery, results });
      } else {
        console.log(`[lexica] 查询 "${q.q}" 采集 0 条（API 无结果）`);
      }
    } catch (e) {
      console.warn(`[lexica] 查询 "${q.q}" 异常: ${e.message}`);
    }
    await sleep(delay);
  }
  return results;
}

// 旧的 HTML 回退路径（浏览器不可用时）。返回本次新增条数。
async function fallbackHtml(q, { delay, headers, perQuery, results }) {
  let fetched = 0;
  let cards = [];
  for (const url of searchUrls(q.q)) {
    try {
      const html = await fetchText(url, { delay, accept: "text/html", headers, retries: 1 });
      cards = parseCards(html);
      if (cards.length) { console.log(`[lexica] 搜索页命中 ${cards.length} 卡片 @ ${url}`); break; }
      console.warn(`[lexica] 搜索页无卡片 @ ${url}`);
    } catch (e) {
      console.warn(`[lexica] 搜索页请求失败 @ ${url}: ${e.message}`);
    }
  }
  if (!cards.length) {
    try {
      const home = await fetchText(BASE + "/", { delay, accept: "text/html", headers, retries: 1 });
      cards = parseCards(home);
      console.log(`[lexica] 回退首页解析 ${cards.length} 卡片`);
    } catch (e) {
      console.warn(`[lexica] 首页解析失败: ${e.message}`);
    }
  }
  const seen = new Set();
  for (const c of cards) {
    if (fetched >= perQuery) break;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    let d = { promptText: null, imageUrl: c.galleryImage };
    try {
      const dhtml = await fetchText(c.sourceUrl, { delay, accept: "text/html", headers, retries: 1 });
      d = extractDetail(dhtml);
    } catch (e) {
      console.warn(`[lexica] 详情页失败 ${c.sourceUrl}: ${e.message}`);
    }
    const imageUrl = d.imageUrl || c.galleryImage;
    if (!imageUrl) continue;
    results.push({
      id: `lexica:${c.id}`, source: "lexica", sourceUrl: c.sourceUrl, title: null,
      promptText: d.promptText, negativePrompt: null, category: q.category, style: q.style,
      model: null, imageUrl, width: null, height: null, tags: [], collectedAt: Date.now(),
    });
    fetched++;
  }
  console.log(`[lexica] 查询 "${q.q}" 采集 ${fetched} 条`);
  return fetched;
}
