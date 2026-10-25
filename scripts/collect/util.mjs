// 采集器共享工具：安全抓取、规范化、SQL 生成。
// 安全间隔原则：每次请求前 sleep；设置合理 UA；限制单轮页数与总量。

export const USER_AGENT =
  "Mozilla/5.0 (compatible; AIPhotographyPromptBot/1.0; +https://github.com/ai-photography-prompt)";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 带延迟的 GET（文本）。延迟用于尊重目标站点的安全抓取间隔。
 */
export async function fetchText(url, { delay = 1500, accept = "text/html,application/json" } = {}) {
  await sleep(delay);
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: accept },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return res.text();
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

/** 从文本启发式推断摄影语言分类。 */
export function inferStyle(text = "") {
  const t = text.toLowerCase();
  for (const [style, keys] of STYLE_KEYWORDS) {
    if (keys.some((k) => t.includes(k))) return style;
  }
  return "other";
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
