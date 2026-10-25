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

// ── 采集 → 入库 之间的「整理 / 转换映射」层 ────────────────────────────
// prmpt.it.com/gallery 每张卡片首行即分类标签，且多为英文、与 PRO_CATEGORIES
// 键同名。此处集中把站点原始标签归一为我们的专业分类键，杜绝各自猜测乱分。

// 专业分类键集合（与 src/lib/types.ts 的 PRO_CATEGORIES 键保持一致）。
export const KNOWN_CATEGORIES = new Set([
  "architectural", "artistic", "automotive", "beauty", "cinematic",
  "fashion", "landscape", "lifestyle", "lingerie", "portrait", "product", "romantic",
]);

// 同义词 → 专业分类键
const CATEGORY_ALIASES = {
  editorial: "fashion", streetwear: "fashion", street: "lifestyle",
  nude: "lingerie", wedding: "romantic", travel: "lifestyle",
  car: "automotive", building: "architectural", "fine-art": "artistic",
  "fine art": "artistic",
};

// 中文标签 → 专业分类键（防御：采集器本应只产出英文标签，此处兜底历史/异常中文）
const CATEGORY_CN = {
  人像: "portrait", 建筑: "architectural", 纪实: "lifestyle", 自然: "landscape",
  夜景: "noir", 时尚: "fashion", 风光: "landscape", 艺术: "artistic",
  汽车: "automotive", 内衣: "lingerie", 浪漫: "romantic", 生活方式: "lifestyle",
  产品: "product", 电影: "cinematic", 肖像: "portrait",
};

// 专业分类键 → 核心风格键（CORE_STYLES 子集 + portrait/landscape）。
// 显式映射、集中维护，不在各采集器里散落判断。
export const CATEGORY_TO_STYLE = {
  fashion: "portrait", beauty: "portrait", lingerie: "portrait",
  portrait: "portrait", lifestyle: "portrait",
  landscape: "landscape", cinematic: "cinematic", artistic: "cinematic",
  romantic: "cinematic", architectural: "minimalist", automotive: "cinematic",
  product: "other",
};

/** 站点原始分类标签 → 我们的专业分类键（英文）。未知则原样保留（并在 types.ts 补 PRO_CATEGORIES）。*/
export function normalizeCategory(raw) {
  if (!raw) return null;
  const k = String(raw).trim().toLowerCase();
  if (CATEGORY_CN[k]) return CATEGORY_CN[k];
  if (CATEGORY_ALIASES[k]) return CATEGORY_ALIASES[k];
  if (KNOWN_CATEGORIES.has(k)) return k;
  return k; // 未知分类保留，交由 types.ts 增补筛选行
}

/** 中间映射层：把采集到的原始条目规范为入库字段（category 键 + style 键）。*/
export function normalizeItem(raw) {
  const category = normalizeCategory(raw.category);
  const style =
    (category && CATEGORY_TO_STYLE[category]) ||
    raw.style ||
    inferStyle(raw.promptText || "") ||
    "other";
  return { ...raw, category, style };
}

const SQL_NULL = "__NULL__";

function sqlVal(v) {
  if (v === null || v === undefined || v === "") return SQL_NULL;
  return String(v).replace(/'/g, "''");
}

/** 生成 INSERT OR REPLACE 语句（prompts 表）。 */
export function promptsToSql(rows) {
  const cols = [
    "id", "source", "source_url", "title", "prompt_text",
    "negative_prompt", "category", "style", "model", "image_url",
    "width", "height", "tags", "collected_at",
  ];
  const lines = rows.map((r) => {
    const vals = [
      sqlVal(r.id),
      sqlVal(r.source),
      sqlVal(r.sourceUrl),
      sqlVal(r.title),
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
 * 完整数据集 SQL（INSERT OR REPLACE，不含 DELETE）。
 * 用于把仓库内的数据集同步进 Cloudflare D1：主键冲突时覆盖、不主动删除，
 * 避免误清 D1 中已有的数据（部署同步是「刷新/追加」，不是「整表重建」）。
 */
export function datasetSql(rows, metas = []) {
  return (
    `-- 数据集快照 @ ${new Date().toISOString()}\n` +
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
