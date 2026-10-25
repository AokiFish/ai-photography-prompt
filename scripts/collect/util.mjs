// 采集器共享工具：安全抓取、规范化、SQL 生成。
// 安全间隔原则：每次请求前 sleep；设置合理 UA；限制单轮页数与总量。

export const USER_AGENT =
  "Mozilla/5.0 (compatible; AIPhotographyPromptBot/1.0; +https://github.com/ai-photography-prompt)";

// 模拟真实浏览器的 UA，绕过部分站点对 bot UA 的 WAF/限流（返回 500/429）。
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 带延迟的 GET（文本）。延迟用于尊重目标站点的安全抓取间隔。
 * headers 可覆盖/追加默认请求头（如 lexica 需浏览器 UA + Referer）。
 */
export async function fetchText(
  url,
  { delay = 1500, accept = "text/html,application/json", headers = {}, retries = 3, backoff = 1500 } = {}
) {
  await sleep(delay);
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: accept, ...headers },
      });
      if (res.ok) return res.text();
      // 明确无资源：不再重试，立即放弃（避免无谓等待）
      if (res.status === 404 || res.status === 403 || res.status === 401) {
        const err = new Error(`HTTP ${res.status} @ ${url}`);
        err.noRetry = true;
        throw err;
      }
      lastErr = new Error(`HTTP ${res.status} @ ${url}`);
      // 429 限流：尊重 Retry-After 头，否则按指数退避
      if (res.status === 429) {
        const ra = res.headers.get("retry-after");
        const wait = ra ? Number(ra) * 1000 : backoff * (attempt + 1);
        console.warn(`[fetch] 429 限流，退避 ${Math.round(wait)}ms 后重试 (${attempt + 1}/${retries})`);
        await sleep(wait);
        continue;
      }
      // 5xx / 其他可重试错误：指数退避
      console.warn(`[fetch] HTTP ${res.status}，退避 ${backoff * (attempt + 1)}ms 后重试 (${attempt + 1}/${retries})`);
      await sleep(backoff * (attempt + 1));
      continue;
    } catch (e) {
      lastErr = e;
      if (e.noRetry || attempt >= retries) break;
      await sleep(backoff * (attempt + 1));
    }
  }
  throw lastErr ?? new Error(`HTTP 失败 @ ${url}`);
}

export async function fetchJson(url, opts) {
  const text = await fetchText(url, opts);
  return JSON.parse(text);
}

const STYLE_KEYWORDS = [
  ["cinematic", "cinematic", "movie", "film still", "anamorphic"],
  ["film", "35mm", "kodak", "film grain", "vintage film"],
  ["noir", "noir", "neon", "cyberpunk", "rain"],
  ["minimalist", "minimalist", "minimal", "negative space"],
  ["macro", "macro", "dew", "close-up", "extreme macro"],
  ["monochrome", "monochrome", "black and white", "b&w", "chiaroscuro"],
  ["portrait", "portrait", "face", "fashion", "editorial"],
  ["landscape", "landscape", "mountain", "desert", "dawn", "scenery"],
];

/** 从文本启发式推断摄影语言分类（兜底用，不用于主分类）。 */
export function inferStyle(text = "") {
  const t = text.toLowerCase();
  for (const [style, ...keys] of STYLE_KEYWORDS) {
    if (keys.some((k) => t.includes(k))) return style;
  }
  return "other";
}

// ── 采集 → 入库 之间的「中间映射层」（多源统一）─────────────────────
// 设计：每个数据源（prmpt / lexica / 未来新源）在 SOURCE_CATEGORY_MAPS
// 里**独立声明**自己的「原始分类标签 → 统一分类键」映射；统一标准 =
// prmpt.it.com 官方 12 类（用户确认权威，与 src/lib/types.ts PRO_CATEGORIES 一致）。
// 加新源 = 在 SOURCE_CATEGORY_MAPS 加一个块，核心逻辑不动。
// 原则：映射层只做「归一化」，绝不删除数据、绝不凭空猜测分类
// （没有权威标注就不填，交由详情页 / 前端处理）。

// 统一内部分类标准（基线）= prmpt.it.com 官方 12 类。
export const KNOWN_CATEGORIES = new Set([
  "architectural", "artistic", "automotive", "beauty", "cinematic",
  "fashion", "landscape", "lifestyle", "lingerie", "portrait", "product", "romantic",
]);

// 每源独立的「原始分类标签 → 统一分类键」映射。
// 每个块含：
//   aliases  — 该源可能出现的「变体/同义词标签 → 统一键」（兜底页面上的非标准标签）
//   cnLabels — 该源可能出现的「中文标签 → 统一键」（防御历史/异常中文）
// 若该源有官方分类页（如 prmpt 的 /category/<key>），采集时直接产出官方 key，
// 这里 aliases 仅兜底页面上的变体标签，不覆盖官方标注。
export const SOURCE_CATEGORY_MAPS = {
  prmpt: {
    aliases: {
      editorial: "fashion", streetwear: "fashion", street: "lifestyle",
      nude: "lingerie", wedding: "romantic", travel: "lifestyle",
      car: "automotive", building: "architectural", "fine-art": "artistic",
      "fine art": "artistic",
    },
    cnLabels: {
      建筑: "architectural", 艺术: "artistic", 汽车: "automotive", 美: "beauty",
      电影: "cinematic", 时尚: "fashion", 地貌: "landscape", 生活方式: "lifestyle",
      内衣: "lingerie", 肖像: "portrait", 产品: "product", 浪漫主义: "romantic",
      // 历史脏数据兼容（早期错误映射写入的中文）
      人像: "portrait", 风光: "landscape", 浪漫: "romantic", 纪实: "lifestyle",
      自然: "landscape", 夜景: "cinematic",
    },
  },
  lexica: {
    // lexica 无官方分类；其 category 来自搜索 query 写死的 12 类之一，
    // 已是统一标准，无需额外映射。若 lexica 改版出现新标签，在此补 aliases。
    aliases: {},
    cnLabels: {},
  },
  // 未来新源：在此加一个块，声明自己的原始标签 → 统一键映射即可。
};

// 官方分类 → 核心摄影语言（style）。仅作 promptText 无关键词时的兜底；
// 主路径是 inferStyle(promptText)——按图片本身的摄影语言判定，
// 避免「时尚题材硬映射成人像/电影感」这类自作主张。
export const CATEGORY_TO_STYLE = {
  architectural: "minimalist", artistic: "cinematic", automotive: "cinematic",
  beauty: "portrait", cinematic: "cinematic", fashion: "cinematic",
  landscape: "landscape", lifestyle: "film", lingerie: "noir",
  portrait: "portrait", product: "minimalist", romantic: "cinematic",
};

/**
 * 站点原始分类标签 → 我们的统一分类键（按数据源选对应映射块）。
 * - 先查该源的 cnLabels（中文兜底）→ aliases（同义词兜底）→ 已是统一标准则直接采用；
 * - 都不中：原样保留原始标签（交由 types.ts 增补筛选行），**绝不猜、绝不删**。
 * @param {string} source  数据源键（"prmpt" / "lexica" / 新源）
 * @param {string} raw     原始分类标签
 */
export function normalizeCategory(source, raw) {
  if (!raw) return null;
  const k = String(raw).trim().toLowerCase();
  const map = (source && SOURCE_CATEGORY_MAPS[source]) || { aliases: {}, cnLabels: {} };
  if (map.cnLabels[k]) return map.cnLabels[k];
  if (map.aliases[k]) return map.aliases[k];
  if (KNOWN_CATEGORIES.has(k)) return k;
  return k; // 未知分类保留，交由 types.ts 增补筛选行
}

/**
 * 中间映射层：把采集到的原始条目规范为入库字段。
 * - category：100% 官方标注（按 /category/<key> 采集时即页面 key），不猜测；
 * - style（核心摄影语言）：**从提示词内容推断优先**（inferStyle），
 *   分类映射仅作无关键词时的兜底。杜绝「时尚题材硬是人像/电影感」。
 */
export function normalizeItem(raw) {
  const category = normalizeCategory(raw.source, raw.category);
  const style =
    raw.style ||
    inferStyle(raw.promptText || "") ||
    (category && CATEGORY_TO_STYLE[category]) ||
    "other";
  return { ...raw, category, style };
}

const SQL_NULL = "__NULL__";

function sqlVal(v) {
  if (v === null || v === undefined) return SQL_NULL;
  // 空串不再写成 NULL：D1 表 prompt_text/style/collected_at 等是 NOT NULL，
  // 写 NULL 会直接让该条 INSERT 失败（且非事务执行会留下残缺数据）。空串留空串字面量更安全。
  if (v === "") return "''";
  return String(v).replace(/'/g, "''");
}

/** 生成 INSERT OR REPLACE 语句（prompts 表）。 */
export function promptsToSql(rows) {
  const cols = [
    "id", "source", "source_url", "title", "abstract", "prompt_text",
    "negative_prompt", "category", "style", "model", "image_url",
    "width", "height", "tags", "collected_at",
  ];
  const lines = rows.map((r) => {
    const vals = [
      sqlVal(r.id),
      sqlVal(r.source),
      sqlVal(r.sourceUrl),
      sqlVal(r.title),
      sqlVal(r.abstract),
      sqlVal(r.promptText),
      sqlVal(r.negativePrompt),
      sqlVal(r.category),
      sqlVal(r.style || inferStyle(r.promptText)),
      sqlVal(r.model),
      sqlVal(r.imageUrl),
      r.width ?? SQL_NULL,
      r.height ?? SQL_NULL,
      sqlVal(JSON.stringify(r.tags ?? [])),
      r.collectedAt ?? Date.now(),
    ].map((v) => (v === SQL_NULL ? "NULL" : `'${v}'`)).join(", ");
    return `INSERT OR REPLACE INTO prompts (${cols.join(", ")}) VALUES (${vals});`;
  });
  return lines.join("\n");
}

/**
 * 完整数据集 SQL（纯 INSERT OR REPLACE，绝不 DELETE / TRUNCATE）。
 * 同步策略 = 仅 upsert：按主键 id 追加新数据 + 覆盖同 id（天然去重）。
 * 绝不清空 / 删全量 D1——D1 行是用户资产，已存在但不在此次数据集中的数据一律保留。
 * ⚠ 生产红线：任何"先删后插"式的整表重建都禁止；要移除某条只能按明确 id 精确 DELETE。
 */
export function datasetSql(rows, metas = []) {
  return (
    `-- 数据集快照 @ ${new Date().toISOString()}\n` +
    `-- 纯 upsert（INSERT OR REPLACE），无 DELETE。\n` +
    promptsToSql(rows) +
    "\n" +
    sourcesMetaToSql(metas) +
    "\n"
  );
}

export function sourcesMetaToSql(metas) {
  const cols = ["key", "label", "last_run", "status", "count"];
  return metas
    .map((m) => {
      const vals = [
        sqlVal(m.key),
        sqlVal(m.label),
        m.lastRun ?? Date.now(),
        sqlVal(m.status),
        m.count ?? 0,
      ].map((v) => (v === SQL_NULL ? "NULL" : `'${v}'`)).join(", ");
      return `INSERT OR REPLACE INTO sources (${cols.join(", ")}) VALUES (${vals});`;
    })
    .join("\n");
}
