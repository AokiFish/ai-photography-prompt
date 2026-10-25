// PRMPT 采集器 — https://prmpt.it.com/
// 精品画廊（编辑 / 时尚 / 肖像类提示词）。
//
// ⚠️ 选择器需按真实响应核对：prmpt.it.com 为客户端渲染画廊，具体 DOM 结构
// 在编写时未能实地抓取确认。本采集器采用通用提取策略（og:description / <pre> / <code> /
// 详情页链接），对解析失败容忍——拿不到就跳过该条，绝不中断工作流。
// 上线前请用一次真实响应微调下面 TODO 标注处。

import { fetchText, inferStyle } from "../util.mjs";

const BASE = "https://prmpt.it.com";
const SKIP = new Set(["/", "/about", "/faq", "/saved", "/gallery", "/contact"]);

function pick(re, html, group = 1) {
  const m = html.match(re);
  return m ? m[group].trim() : "";
}

// 从单页 HTML 提取最可能的提示词文本与配图。
function extractFromHtml(html, url) {
  const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i, html);
  const metaDesc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i, html);
  const title = pick(/<title>([^<]+)<\/title>/i, html) || pick(/<h1[^>]*>([^<]+)<\/h1>/i, html);
  const ogImage = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i, html);

  // 取最长的 <pre>/<code> 文本作为候选提示词
  const blocks = [...html.matchAll(/<(pre|code)[^>]*>([\s\S]*?)<\/pre>/gi)].map((m) => m[2]);
  const longestPre = blocks.sort((a, b) => b.length - a.length)[0] || "";

  const candidate = ogDesc || longestPre || metaDesc;
  if (!candidate || candidate.length < 20) return null; // 不是有效提示词

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
      // 仅保留疑似提示词详情页（含 prompt / p /  slug）
      if (/prompt|^\/p\/|^\/[a-z0-9-]{6,}$/i.test(path)) out.push(u.href);
    } catch {
      /* 忽略非法 URL */
    }
  }
  return [...new Set(out)];
}

/**
 * @param {object} opts
 * @param {number} opts.limit  最多采集条数
 * @param {number} opts.delay 请求间隔(ms)
 */
export async function collectPrmpt({ limit = 12, delay = 2000 } = {}) {
  const results = [];
  try {
    const home = await fetchText(BASE, { delay: 800 });
    // 首页直接尝试提取
    const root = extractFromHtml(home, BASE);
    if (root) results.push(withId(root, BASE));

    const links = discoverLinks(home).slice(0, limit);
    for (const link of links) {
      try {
        const html = await fetchText(link, { delay });
        const ex = extractFromHtml(html, link);
        if (ex) results.push(withId(ex, link));
      } catch (e) {
        console.warn(`[prmpt] 跳过 ${link}: ${e.message}`);
      }
      if (results.length >= limit) break;
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
