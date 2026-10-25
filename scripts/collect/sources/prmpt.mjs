// PRMPT 采集器 — https://prmpt.it.com/
// 精品画廊（编辑 / 时尚 / 肖像类提示词）。
//
// 实测（2026-10-25）：站点为 SPA，首页 HTML 仅含营销文案，真实提示词在
// Next.js 的 __NEXT_DATA__（SSR 首屏 JSON）或详情页里。本采集器优先解析
// __NEXT_DATA__，其次回退 og:description / 最长 <pre>，并对发现的详情链接递归抓取。
// 对解析失败容忍——拿不到就跳过该条，绝不中断工作流。

import { fetchText, inferStyle } from "../util.mjs";

const BASE = "https://prmpt.it.com";
const SKIP = new Set(["/", "/about", "/faq", "/saved", "/gallery", "/contact"]);

// 提示词特征词：用于从混杂 JSON / HTML 中筛出真正的摄影提示词。
const PROMPT_HINT =
  /(shot on|camera|lens|f\/|mm\b|kodak|portra|cinematic|portrait|film grain|anamorphic|bokeh|chiaroscuro|editorial|85mm|35mm|50mm|shallow depth|depth of field|rim light|softbox)/i;

function isLikelyPrompt(s) {
  if (!s || typeof s !== "string" || s.length < 40) return false;
  return PROMPT_HINT.test(s);
}

// 递归遍历 __NEXT_DATA__ JSON，收集候选提示词与站内详情链接。
function walk(obj, prompts, links) {
  if (obj == null) return;
  if (typeof obj === "string") {
    if (isLikelyPrompt(obj)) prompts.push(obj);
    if (/^https?:\/\/prmpt\.it\.com\//.test(obj)) {
      try {
        const u = new URL(obj);
        if (!SKIP.has(u.pathname)) links.push(u.href);
      } catch {
        /* 忽略非法 URL */
      }
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v) => walk(v, prompts, links));
    return;
  }
  if (typeof obj === "object") {
    for (const k of Object.keys(obj)) walk(obj[k], prompts, links);
  }
}

function extractNextData(html) {
  const m = html.match(
    /<script\s+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!m) return { prompts: [], links: [] };
  try {
    const data = JSON.parse(m[1]);
    const prompts = [];
    const links = [];
    walk(data, prompts, links);
    return {
      prompts: [...new Set(prompts)].slice(0, 40),
      links: [...new Set(links)],
    };
  } catch {
    return { prompts: [], links: [] };
  }
}

function pick(re, html, group = 1) {
  const m = html.match(re);
  return m ? m[group].trim() : "";
}

// 从单页 HTML 提取最可能的提示词文本与配图（兜底策略）。
function extractFromHtml(html, url) {
  const ogDesc = pick(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    html
  );
  const metaDesc = pick(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    html
  );
  const title =
    pick(/<title>([^<]+)<\/title>/i, html) ||
    pick(/<h1[^>]*>([^<]+)<\/h1>/i, html);
  const ogImage = pick(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    html
  );

  const blocks = [
    ...html.matchAll(/<(pre|code)[^>]*>([\s\S]*?)<\/pre>/gi),
  ].map((m) => m[2]);
  const longestPre = blocks.sort((a, b) => b.length - a.length)[0] || "";

  const candidate = ogDesc || longestPre || metaDesc;
  if (!isLikelyPrompt(candidate)) return null; // 不是有效提示词

  return {
    title: title.slice(0, 120),
    promptText: candidate.replace(/\s+/g, " ").trim().slice(0, 2000),
    imageUrl: ogImage || null,
  };
}

function discoverLinks(html) {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const out = [];
  for (const h of hrefs) {
    try {
      const u = new URL(h, BASE);
      if (u.origin !== BASE) continue;
      const path = u.pathname;
      if (SKIP.has(path) || path === "/") continue;
      if (/prompt|^\/p\/|^\/[a-z0-9-]{6,}$/i.test(path)) out.push(u.href);
    } catch {
      /* 忽略非法 URL */
    }
  }
  return [...new Set(out)];
}

function withPrompt(text, url) {
  return {
    id: `prmpt:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: "prmpt",
    sourceUrl: url,
    title: null,
    promptText: text.replace(/\s+/g, " ").trim().slice(0, 2000),
    negativePrompt: null,
    category: null,
    style: inferStyle(text),
    model: null,
    imageUrl: null,
    tags: [],
    collectedAt: Date.now(),
  };
}

/**
 * @param {object} opts
 * @param {number} opts.limit  最多采集条数
 * @param {number} opts.delay 请求间隔(ms)
 */
export async function collectPrmpt({ limit = 24, delay = 2000 } = {}) {
  const results = [];
  try {
    const home = await fetchText(BASE, { delay: 800 });
    const hasNextData = /<script\s+id=["']__NEXT_DATA__["']/i.test(home);
    console.log(
      `[prmpt] 首页 HTML 长度 ${home.length}, 含 __NEXT_DATA__: ${hasNextData}`
    );

    // 1) 优先从 __NEXT_DATA__ 拿真提示词
    const nd = extractNextData(home);
    console.log(
      `[prmpt] __NEXT_DATA__ 候选提示词 ${nd.prompts.length}, 详情链接 ${nd.links.length}`
    );
    for (const p of nd.prompts) {
      results.push(withPrompt(p, BASE));
      if (results.length >= limit) break;
    }

    // 2) 补抓详情页（__NEXT_DATA__ 链接 + a 标签发现的链接）
    const links = [...new Set([...nd.links, ...discoverLinks(home)])].slice(
      0,
      limit * 2
    );
    for (const link of links) {
      if (results.length >= limit) break;
      try {
        const html = await fetchText(link, { delay });
        const ex = extractFromHtml(html, link);
        if (ex) results.push(withId(ex, link));
      } catch (e) {
        console.warn(`[prmpt] 跳过 ${link}: ${e.message}`);
      }
    }
  } catch (e) {
    console.warn(`[prmpt] 首页抓取失败: ${e.message}`);
  }

  // 去重（按 promptText 近似）
  const seen = new Set();
  const dedup = results.filter((r) => {
    const key = r.promptText.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return dedup;
}

function withId(r, url) {
  const slug = new URL(url).pathname.replace(/\//g, "") || "home";
  return {
    id: `prmpt:${slug}`,
    source: "prmpt",
    sourceUrl: url,
    title: r.title || null,
    promptText: r.promptText,
    negativePrompt: null,
    category: null,
    style: inferStyle(r.promptText),
    model: null,
    imageUrl: r.imageUrl,
    tags: [],
    collectedAt: Date.now(),
  };
}
