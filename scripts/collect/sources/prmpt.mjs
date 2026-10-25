// PRMPT 采集器 — https://prmpt.it.com/
// 精品画廊（编辑 / 时尚 / 肖像类提示词）。
//
// 实测（2026-10-25）：/gallery 为 SSR，每张卡片首行即站点分类标签
// （fashion / cinematic / portrait / landscape / artistic / romantic /
// architectural / lingerie / automotive / lifestyle …），且与本项目
// PRO_CATEGORIES 的英文键同名。本采集器只负责「抓原始数据」：
//   1) 抓 /gallery（含分页 ?page=N），解析每张卡片的分类标签 + slug + 缩略图
//   2) 逐条爬详情页 /prompt/<slug> 取真实提示词 + 配图 + 标题
// 分类「归一映射」交给 util.mjs 的 normalizeItem，本文件不擅自定分类。
// 对解析失败容忍——拿不到就跳过该条，绝不中断工作流。

import { fetchText, KNOWN_CATEGORIES } from "../util.mjs";

const BASE = "https://prmpt.it.com";

// 从卡片文本里识别分类标签（已知键 + 常见同义词）
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

// 解析 gallery 页：提取所有 /prompt/ 卡片（分类标签 + slug + 缩略图）
export function parseGalleryCards(html) {
  const cards = [];
  const seen = new Set();
  const re = /<a[^>]+href=["'](\/prompt\/[^"']+)["'][\s\S]*?<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (seen.has(href)) continue;
    seen.add(href);
    const inner = m[0];
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const catM = text.match(CAT_RE);
    const siteCategory = catM ? catM[1].toLowerCase() : null;
    const imgM = inner.match(/<img[^>]+src=["']([^"']+)["']/i);
    cards.push({
      slug: href.replace(/^\/prompt\//, ""),
      sourceUrl: BASE + href,
      siteCategory,
      galleryImage: imgM ? imgM[1] : null,
    });
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

  return {
    title: title ? title.slice(0, 120) : null,
    promptText: promptText || null,
    imageUrl: ogImage || null,
  };
}

/**
 * @param {object} opts
 * @param {number} opts.limit    最多采集条数（默认 60）
 * @param {number} opts.delay    请求间隔(ms)
 * @param {number} opts.maxPages 最多翻页数（默认 6）
 */
export async function collectPrmpt({ limit = 60, delay = 1500, maxPages = 6 } = {}) {
  const raw = [];
  const seen = new Set();
  try {
    let page = 0;
    while (raw.length < limit && page < maxPages) {
      const url = page === 0 ? `${BASE}/gallery` : `${BASE}/gallery?page=${page + 1}`;
      const html = await fetchText(url, { delay: page === 0 ? 800 : delay });
      const cards = parseGalleryCards(html);
      console.log(`[prmpt] gallery 第 ${page + 1} 页解析到 ${cards.length} 卡片`);
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
            category: c.siteCategory, // 原始标签，交给 normalizeItem 映射
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
    console.warn(`[prmpt] 采集异常: ${e.message}`);
  }
  return raw;
}
