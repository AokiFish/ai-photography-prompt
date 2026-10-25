// PRMPT 采集器 — https://prmpt.it.com/
//
// 重要（2026-10-25 实测）：该站是 **Vite React SPA**，卡片由客户端从 Firebase
// 拉取，分类页 /category/<key> 多数被服务端预渲染了卡片，但**部分分类（如 product）
// 是纯客户端渲染——初始 HTML 里 0 张卡片**，静态抓取必然 0 条（product 因此一直漏采）。
//
// 故本采集器不再依赖分类页列卡片，改为：
//   1) 读 /sitemap.xml 拿到全站全部 /prompt/<slug> 链接（完整、稳定）；
//   2) 逐个抓详情页（详情页是 SSR：<head> 含 og:image / og:title / og:description，
//      正文含面包屑 /category/<key> 权威分类）；
//   3) extractDetail 从详情页取 标题 / 真实提示词 / 配图 / 权威分类。
//      关键：详情页 og:description 只是「简单陈述」(abstract)，不是 prompt！
//      真正的 prompt 在 "Prompt Transcript" 标题下的 <p class="font-mono ..."> 里
//      （可能是 JSON 结构化提示词，也可能是纯文本提示词）。务必取它，不要取 abstract。
// 这样 100% 覆盖所有分类（含 product），不依赖 Firebase、不依赖浏览器。
// 分类「归一映射」交给 util.mjs 的 normalizeItem，本文件不擅自定分类。

import { fetchText } from "../util.mjs";

const BASE = "https://prmpt.it.com";

function pick(re, html, group = 1) {
  const m = html.match(re);
  return m ? m[group].trim() : "";
}

// 清洗文本：去标签、反转义 HTML 实体、去掉尾部 "View all →"（源站有时会挂在 prompt 块里）。
function cleanText(s) {
  return String(s)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/View all\s*→?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 从详情页提取真实提示词 + 配图 + 标题 + 权威分类（面包屑 /category/<key>）。
export function extractDetail(html) {
  const ogImage = pick(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    html
  );

  // 简短描述（abstract）= og:description，源站的一句话「简单陈述」。
  // ⚠ 它不是 prompt！只用在图集卡片上当简介（卡片不能铺完整 prompt，长短不一是灾难）。
  const ogDesc = pick(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    html
  );
  const abstract = ogDesc ? cleanText(ogDesc).slice(0, 400) : null;

  // 标题：优先 h1（干净），回退 <title>（去掉站点后缀 " — AI Photo Prompt · PRMPT"）
  const h1 = pick(/<h1[^>]*>([^<]+)<\/h1>/i, html);
  const rawTitle = h1 || pick(/<title>([^<]+)<\/title>/i, html);
  const title = rawTitle
    ? rawTitle
        .replace(/\s*[—–-]\s*AI Photo Prompt\s*·\s*PRMPT.*$/i, "")
        .replace(/\s*·\s*PRMPT.*$/i, "")
        .trim()
    : null;

  // 真实提示词：详情页 "Prompt Transcript" 区块内的 <p class="font-mono ...">。
  // 这是源站真正的 prompt——可能是 JSON 结构化提示词，也可能是纯文本提示词。
  // 切勿用 og:description / abstract 当 prompt（那是「简单陈述」）。
  let promptText = null;
  let negativePrompt = null;
  const labelIdx = html.indexOf("Prompt Transcript");
  if (labelIdx >= 0) {
    const after = html.slice(labelIdx);
    const m = after.match(/<p class="font-mono[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    if (m) {
      const raw = cleanText(m[1]);
      const s = raw.indexOf("{");
      const e = raw.lastIndexOf("}");
      if (s >= 0 && e > s) {
        // 结构化 JSON prompt：美化存储，并抽取 negative_prompt
        try {
          const obj = JSON.parse(raw.slice(s, e + 1));
          promptText = JSON.stringify(obj, null, 2);
          if (Array.isArray(obj.negative_prompt) && obj.negative_prompt.length) {
            negativePrompt = obj.negative_prompt.join(", ");
          }
        } catch {
          promptText = raw;
        }
      } else if (raw) {
        promptText = raw; // 纯文本 prompt
      }
    }
  }
  // 兜底：极少数详情页没有 Prompt Transcript 区块（结构变更）才回退 abstract
  if (!promptText && ogDesc) promptText = ogDesc.slice(0, 2000);

  // 权威分类：面包屑 /category/<key>（详情页 SSR，最可靠；不扫描卡片全文乱猜）
  const catM = html.match(/href=["'][^"']*\/category\/([a-z0-9-]+)/i);
  const detailCategory = catM ? catM[1].toLowerCase() : null;

  return {
    title: title ? title.slice(0, 120) : null,
    abstract: abstract || null,
    promptText: promptText || null,
    negativePrompt: negativePrompt || null,
    imageUrl: ogImage || null,
    category: detailCategory,
  };
}

// 读 sitemap 拿到全站全部 /prompt/<slug> 链接。
// 兼容单文件 sitemap 与 sitemapindex（子 sitemap）。
async function getSitemapSlugs() {
  const out = [];
  const seen = new Set();
  const pushLoc = (xml) => {
    const locs = [
      ...xml.matchAll(/<loc>\s*(https?:\/\/[^<]*?\/prompt\/([^<]+?))\s*<\/loc>/g),
    ];
    for (const m of locs) {
      const url = m[1];
      const slug = m[2].replace(/[?#].*$/, "");
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push({ sourceUrl: url.startsWith("http") ? url : BASE + url, slug });
    }
  };
  try {
    const xml = await fetchText(`${BASE}/sitemap.xml`, {
      delay: 600,
      accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
    });
    pushLoc(xml);
    // sitemapindex：递归读子 sitemap
    const subs = [
      ...xml.matchAll(/<loc>\s*(https?:\/\/[^<]+?sitemap[^<]*?)\s*<\/loc>/g),
    ].map((m) => m[1]);
    for (const sub of subs) {
      try {
        const sx = await fetchText(sub, { delay: 600 });
        pushLoc(sx);
      } catch (e) {
        console.warn(`[prmpt] 子 sitemap 读取失败 ${sub}: ${e.message}`);
      }
    }
  } catch (e) {
    console.warn(`[prmpt] sitemap 读取失败: ${e.message}`);
  }
  return out;
}

/**
 * 采集 PRMPT 全量提示词。
 *
 * 主路径（sitemap → 详情页）：读 /sitemap.xml 拿全部 /prompt/<slug>，逐个抓详情页
 * 取 标题/提示词/配图/权威分类。覆盖所有分类（含 product 这类 CSR 分类页）。
 *
 * @param {object} opts
 * @param {number} opts.limit       最多采集条数（默认 0 = 全部）
 * @param {number} opts.delay       请求间隔(ms)
 * @param {number} opts.maxPages    保留参数（兼容旧签名，sitemap 模式不分页）
 * @param {string[]|null} opts.categories 只抓这些分类（默认 null = 全部）。
 *                                  分类精确匹配详情页权威分类；指定分类却 0 条 = 采集失败（交由上层 exit 1）。
 */
export async function collectPrmpt({ limit = 0, delay = 1500, maxPages = 30, categories = null } = {}) {
  const raw = [];
  const seen = new Set();

  // 分类筛选：用户指定则只保留该分类（精确匹配详情页权威分类），绝不采回别的分类
  const cats = categories && categories.length
    ? categories.map((c) => String(c).trim().toLowerCase()).filter(Boolean)
    : null;
  if (cats) console.log(`[prmpt] 仅抓指定分类: ${cats.join(", ")}`);

  // 主路径：sitemap 列全部 slug → 逐个抓详情页
  const slugs = await getSitemapSlugs();
  console.log(`[prmpt] sitemap 解析到 ${slugs.length} 个 prompt 链接`);
  if (slugs.length === 0) {
    console.warn(`[prmpt] ⚠ sitemap 无任何 /prompt/ 链接——站点结构可能已变，终止采集`);
    return raw;
  }

  let scanned = 0;
  for (const s of slugs) {
    if (limit > 0 && raw.length >= limit) break;
    if (seen.has(s.slug)) continue;
    seen.add(s.slug);
    try {
      const html = await fetchText(s.sourceUrl, { delay });
      const d = extractDetail(html); // 权威分类来自面包屑 /category/<key>
      const cat = d.category ? d.category.toLowerCase() : null;
      if (cats && (!cat || !cats.includes(cat))) continue; // 指定分类模式：不匹配即跳过
      scanned++;
      raw.push({
        id: `prmpt:${s.slug}`,
        source: "prmpt",
        sourceUrl: s.sourceUrl,
        title: d.title,
        abstract: d.abstract,
        promptText: d.promptText,
        negativePrompt: d.negativePrompt,
        category: cat,
        style: null,
        model: null,
        imageUrl: d.imageUrl,
        tags: [],
        collectedAt: Date.now(),
      });
    } catch (e) {
      console.warn(`[prmpt] 跳过 ${s.sourceUrl}: ${e.message}`);
    }
  }

  console.log(`[prmpt] 合计 ${raw.length} 条（已扫描详情页 ${scanned}）`);
  if (cats && raw.length === 0) {
    console.warn(
      `[prmpt] ⚠ 指定分类 ${cats.join(", ")} 一条都没采到——请检查 https://prmpt.it.com/category/${cats[0]} 与详情页分类标注`
    );
  }
  return raw;
}
