// PRMPT 采集器 — https://prmpt.it.com/
// 精品画廊（编辑 / 时尚 / 肖像类提示词）。
//
// 实测（2026-10-25）：站点为 Next.js。/gallery 可能是 SSR（初始 HTML 含
// <a href="/prompt/..."> 卡片）也可能是 CSR（卡片由 __NEXT_DATA__ 首屏 JSON
// 经 JS 渲染）。本采集器两种都兼容：先按 <a> 卡片解析，解析不到再回退到
// __NEXT_DATA__ 里的 prompt 对象；两者都为 0 时再回退首页 __NEXT_DATA__。
// 分类「归一映射」交给 util.mjs 的 normalizeItem，本文件不擅自定分类。

import { fetchText, KNOWN_CATEGORIES } from "../util.mjs";

const BASE = "https://prmpt.it.com";

// 从文本里识别分类标签（已知键 + 常见同义词）
const CAT_RE = new RegExp(
  "\\b(" +
    [...KNOWN_CATEGORIES].join("|") +
    "|editorial|streetwear|street|wedding|travel|car|building|fine[ -]?art)\\b",
  "i"
);

function pick(re, html, group = 1) {
  const m = html.match(re);
  return m ? m[group].trim() : "";
}

// 解析 gallery 页：优先 <a href="/prompt/..."> 卡片；否则从 __NEXT_DATA__ 取对象。
export function parseGalleryCards(html) {
  const cards = [];
  const seen = new Set();

  // 策略 A：<a> 卡片
  const re = /<a[^>]+href=["']([^"']*\/prompt\/[^"']+)["'][\s\S]*?<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    const inner = m[0];
    const slug = href.replace(/^.*\/prompt\//, "").replace(/[?#].*$/, "");
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const catM = text.match(CAT_RE);
    const imgM = inner.match(/<img[^>]+src=["']([^"']+)["']/i);
    cards.push({
      slug,
      sourceUrl: href.startsWith("http") ? href : BASE + href,
      siteCategory: catM ? catM[1].toLowerCase() : null,
      galleryImage: imgM ? imgM[1] : null,
    });
  }
  if (cards.length) return cards;

  // 策略 B：__NEXT_DATA__ 里的 prompt 对象
  const nd = html.match(/<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nd) {
    let data;
    try {
      data = JSON.parse(nd[1]);
    } catch {
      return cards;
    }
    const walk = (v) => {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === "object") {
        const o = v;
        const slug = typeof o.slug === "string" ? o.slug : null;
        const title = typeof o.title === "string" ? o.title : null;
        const img =
          typeof o.image === "string"
            ? o.image
            : typeof o.imageUrl === "string"
            ? o.imageUrl
            : typeof o.cover === "string"
            ? o.cover
            : null;
        const cat = typeof o.category === "string" ? o.category : null;
        if ((slug || title) && img && !seen.has(slug || title)) {
          seen.add(slug || title);
          cards.push({
            slug: slug || title,
            sourceUrl: slug ? BASE + "/prompt/" + slug : BASE,
            siteCategory: cat ? cat.toLowerCase() : null,
            galleryImage: img,
          });
        }
        Object.values(o).forEach(walk);
      }
    };
    walk(data);
  }
  return cards;
}

// 从详情页提取真实提示词 + 配图 + 标题
export function extractDetail(html) {
  const ogDesc = pick(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    html
  );
  const ogImage = pick(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    html
  );
  const title =
    pick(/<title>([^<]+)<\/title>/i, html) ||
    pick(/<h1[^>]*>([^<]+)<\/h1>/i, html);

  // 真实提示词：优先 <pre>/<code> 中含摄影关键词的块；否则回退 og:description
  const blocks = [...html.matchAll(/<(pre|code)[^>]*>([\s\S]*?)<\/\1>/gi)].map(
    (x) => x[2]
  );
  const longest = blocks.sort((a, b) => b.length - a.length)[0] || "";
  const promptText = (
    longest && longest.length > 40 ? longest : ogDesc
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

  // 从详情页提取「明确标注」的分类（优于 gallery 卡片全文扫描，避免误判人像等）：
  // 1) 面包屑 /category/<key>  2) URL 中 ?category=<key>  3) <meta property="article:section">
  // 取不到则回退 null，由调用方回退到卡片标注的 siteCategory。
  const catM =
    html.match(/href=["'][^"']*\/category\/([a-z0-9-]+)/i) ||
    html.match(/[?&]category=([a-z0-9-]+)/i) ||
    html.match(/<meta[^>]+property=["']article:section["'][^>]+content=["']([^"']+)["']/i);
  const detailCategory = catM ? catM[1].toLowerCase() : null;

  return {
    title: title ? title.slice(0, 120) : null,
    promptText: promptText || null,
    imageUrl: ogImage || null,
    category: detailCategory, // 详情页权威分类，collectPrmpt 会优先采用
  };
}

// 首页 __NEXT_DATA__ 兜底：遍历 JSON 找像提示词的长字符串（保证不退化到 0 条）
const PROMPT_HINT =
  /(shot on|camera|kodak|portra|cinematic|portrait|lens|fujifilm|35mm|85mm|editorial|aperture|film grain)/i;
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function extractHomepage(html) {
  const m = html.match(/<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return [];
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const found = [];
  const seenText = new Set();
  const walk = (v) => {
    if (typeof v === "string") {
      const s = v.trim();
      if (s.length > 40 && s.length < 2000 && PROMPT_HINT.test(s) && !seenText.has(s)) {
        seenText.add(s);
        found.push(s);
      }
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(data);
  const ogImage = pick(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    html
  );
  return found.slice(0, 40).map((t, i) => ({
    id: `prmpt:home:${i}:${hash(t)}`,
    source: "prmpt",
    sourceUrl: BASE,
    title: null,
    promptText: t.slice(0, 2000),
    negativePrompt: null,
    category: null,
    style: null,
    model: null,
    imageUrl: ogImage || null,
    tags: [],
    collectedAt: Date.now(),
  }));
}

/**
 * @param {object} opts
 * @param {number} opts.limit    最多采集条数（默认 60）
 * @param {number} opts.delay    请求间隔(ms)
 * @param {number} opts.maxPages 最多翻页数（默认 6）
 */
export async function collectPrmpt({ limit = 0, delay = 1500, maxPages = 30 } = {}) {
  const raw = [];
  const seen = new Set();

  // 策略 A：/gallery 分页（limit<=0 表示抓全部，直到末页或 maxPages）
  let galleryTotal = 0;
  try {
    let page = 0;
    while (page < maxPages && (limit <= 0 || raw.length < limit)) {
      const url = page === 0 ? `${BASE}/gallery` : `${BASE}/gallery?page=${page + 1}`;
      const html = await fetchText(url, { delay: page === 0 ? 800 : delay });
      const cards = parseGalleryCards(html);
      console.log(`[prmpt] gallery 第 ${page + 1} 页解析到 ${cards.length} 卡片`);
      galleryTotal += cards.length;
      if (cards.length === 0) break;

      for (const c of cards) {
        if (raw.length >= limit) break;
        if (seen.has(c.slug)) continue;
        seen.add(c.slug);
        try {
          const dhtml = await fetchText(c.sourceUrl, { delay });
          const d = extractDetail(dhtml);
          raw.push({
            id: `prmpt:${c.slug}`,
            source: "prmpt",
            sourceUrl: c.sourceUrl,
            title: d.title,
            promptText: d.promptText,
            negativePrompt: null,
            category: d.category || c.siteCategory, // 详情页明确分类优先，否则卡片标注
            style: null,
            model: null,
            imageUrl: d.imageUrl || c.galleryImage,
            tags: [],
            collectedAt: Date.now(),
          });
        } catch (e) {
          console.warn(`[prmpt] 跳过 ${c.sourceUrl}: ${e.message}`);
        }
      }

      page++;
      // 无显式分页链接且本页卡片很少，视为已到末页
      if (!/\/gallery\?page=\d+/i.test(html) && cards.length < 12) break;
    }
  } catch (e) {
    console.warn(`[prmpt] gallery 采集异常: ${e.message}`);
  }

  // 策略 B：gallery 解析为 0，回退首页 __NEXT_DATA__（保证不退化到 0）
  if (raw.length === 0) {
    console.log(`[prmpt] gallery 解析为 0，回退首页 __NEXT_DATA__ 提取`);
    try {
      const home = await fetchText(BASE, { delay: 800 });
      const items = extractHomepage(home);
      console.log(`[prmpt] 首页提取到 ${items.length} 条`);
      for (const it of items) {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          raw.push(it);
        }
      }
    } catch (e) {
      console.warn(`[prmpt] 首页提取失败: ${e.message}`);
    }
  }

  console.log(`[prmpt] 合计 ${raw.length} 条（gallery 卡片约 ${galleryTotal}）`);
  return raw;
}
