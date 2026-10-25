// Lexica 采集器（网页爬虫版）— https://lexica.art/
// 旧版用 /api/v1/search 接口，现该接口持续返回 HTTP 500（服务端/反爬），故改为
// 直接抓取网页 HTML 解析，绕开 API。
//
// 解析策略（与 prmpt.mjs 同构、稳健）：
//   策略 A：列表/搜索页里的 <a href="/prompt/<id>"> 卡片 + 内嵌 <img>
//   策略 B：__NEXT_DATA__ 首屏 JSON 里找 {id, prompt, src} 对象（Next.js SSR 兜底）
//   详情页：og:description（常含完整 prompt）+ og:image + <pre>/<code> 文本块
//
// lexica 搜索页 URL 形式不确定，searchUrls() 给出多个候选，依次尝试，首个解析到
// 卡片的即用；全部失败则回退首页热门流。请上线后按一次真实日志微调。

import { fetchText, BROWSER_UA, sleep } from "../util.mjs";

const BASE = "https://lexica.art";

// 检索词 → 专业分类键（PRO_CATEGORIES 英文键）+ 核心风格键（CORE_STYLES）。
// category 用英文键，与图集筛选行传值一致。
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

// lexica 搜索页 URL 候选（形式不明，依次尝试）。
function searchUrls(q) {
  const eq = encodeURIComponent(q);
  return [`${BASE}/?q=${eq}`, `${BASE}/search?q=${eq}`, `${BASE}/prompt?q=${eq}`];
}

function pick(re, html, group = 1) {
  const m = html.match(re);
  return m ? m[group].trim() : "";
}

// 策略 A：<a href="/prompt/..."> 卡片
function parseCardsFromAnchors(html) {
  const cards = [];
  const seen = new Set();
  const re = /<a[^>]+href=["']([^"']*\/prompt\/[^"']+)["'][\s\S]*?<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    const inner = m[0];
    const id = href.replace(/^.*\/prompt\//, "").replace(/[?#].*$/, "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const imgM = inner.match(/<img[^>]+src=["']([^"']+)["']/i);
    cards.push({
      id,
      sourceUrl: href.startsWith("http") ? href : BASE + href,
      galleryImage: imgM ? imgM[1] : null,
    });
  }
  return cards;
}

// 策略 B：__NEXT_DATA__ 里找 {id, prompt, src} 对象
function parseCardsFromNextData(html) {
  const nd = html.match(/<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!nd) return [];
  let data;
  try {
    data = JSON.parse(nd[1]);
  } catch {
    return [];
  }
  const cards = [];
  const seen = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      const id = typeof v.id === "string" ? v.id : null;
      const prompt = typeof v.prompt === "string" ? v.prompt : null;
      const src =
        typeof v.src === "string" ? v.src : typeof v.image === "string" ? v.image : null;
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

function parseCards(html) {
  const a = parseCardsFromAnchors(html);
  if (a.length) return a;
  return parseCardsFromNextData(html);
}

// 详情页：og:description（常含完整 prompt）+ og:image + <pre>/<code> 文本块
function extractDetail(html) {
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
  const blocks = [...html.matchAll(/<(pre|code)[^>]*>([\s\S]*?)<\/\1>/gi)].map((x) => x[2]);
  const longest = blocks.sort((a, b) => b.length - a.length)[0] || "";
  const promptText = (longest && longest.length > 40 ? longest : ogDesc)
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
 * @param {number} opts.perQuery 每个检索词最多采集条数
 * @param {number} opts.delay    请求间隔(ms)
 * @param {number} opts.retries  详情页请求重试次数（搜索页探索用 1，快速换候选）
 */
export async function collectLexica({ perQuery = 8, delay = 3000, retries = 4 } = {}) {
  const results = [];
  const headers = { "User-Agent": BROWSER_UA, Referer: BASE + "/" };

  for (const { q, style, category } of QUERIES) {
    let fetched = 0;
    const seen = new Set();
    try {
      // 1) 搜索页（多 URL 候选，探索阶段仅重试 1 次以快速换下一个）
      let cards = [];
      for (const url of searchUrls(q)) {
        try {
          const html = await fetchText(url, { delay, accept: "text/html", headers, retries: 1 });
          cards = parseCards(html);
          if (cards.length) {
            console.log(`[lexica] 搜索页命中 ${cards.length} 卡片 @ ${url}`);
            break;
          }
          console.warn(`[lexica] 搜索页无卡片 @ ${url}`);
        } catch (e) {
          console.warn(`[lexica] 搜索页请求失败 @ ${url}: ${e.message}`);
        }
      }

      // 2) 全部搜索页无果，回退首页热门流
      if (!cards.length) {
        try {
          const home = await fetchText(BASE + "/", { delay, accept: "text/html", headers, retries: 1 });
          cards = parseCards(home);
          console.log(`[lexica] 回退首页解析 ${cards.length} 卡片`);
        } catch (e) {
          console.warn(`[lexica] 首页解析失败: ${e.message}`);
        }
      }

      // 3) 抓详情页补全 prompt / 图片
      for (const c of cards) {
        if (fetched >= perQuery) break;
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        let d = { promptText: null, imageUrl: c.galleryImage, title: null };
        try {
          const dhtml = await fetchText(c.sourceUrl, { delay, accept: "text/html", headers, retries });
          d = extractDetail(dhtml);
        } catch (e) {
          console.warn(`[lexica] 详情页失败 ${c.sourceUrl}: ${e.message}`);
        }
        const imageUrl = d.imageUrl || c.galleryImage;
        if (!imageUrl) continue; // 无图不要
        results.push({
          id: `lexica:${c.id}`,
          source: "lexica",
          sourceUrl: c.sourceUrl,
          title: d.title,
          promptText: d.promptText,
          negativePrompt: null,
          category,
          style,
          model: null,
          imageUrl,
          width: null,
          height: null,
          tags: [],
          collectedAt: Date.now(),
        });
        fetched++;
      }
      console.log(`[lexica] 查询 "${q}" 采集 ${fetched} 条`);
    } catch (e) {
      console.warn(`[lexica] 查询 "${q}" 异常: ${e.message}`);
    }
    await sleep(delay); // 查询间隔，降低限流概率
  }
  return results;
}
