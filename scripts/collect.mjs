// 采集编排器
// 数据集以仓库文件为「真相来源」：
//   data/prompts.json  完整数据集（合并 / 去重用的 canonical 存储）
//   data/prompts.sql   由 JSON 生成，供部署时同步进 Cloudflare D1（INSERT OR REPLACE）
// 每日 action 跑本脚本 → 更新仓库数据集 → 推送 → sync-d1.yml 把 SQL 同步进 D1。
// 本地也可跑（需能访问源站）： node scripts/collect.mjs
//
// 环境变量：
//   PRMPT_LIMIT        PRMPT 最多条数（默认 0 = 抓全部 gallery 分页）
//   LEXICA_PER_QUERY   Lexica 每个检索词最多条数（默认 8；action 内已装 playwright 过 Cloudflare）
//   FETCH_DELAY        请求间隔(ms)（默认 1500）

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { collectPrmpt } from "./collect/sources/prmpt.mjs";
import { collectLexica } from "./collect/sources/lexica.mjs";
import { closeBrowser } from "./collect/browser.mjs";
import { datasetSql, normalizeItem } from "./collect/util.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const JSON_PATH = join(DATA_DIR, "prompts.json");
const SQL_PATH = join(DATA_DIR, "prompts.sql");

const LIMIT = Number(process.env.PRMPT_LIMIT ?? 0); // 0 = 抓全部（不限条数）
const PER_QUERY = Number(process.env.LEXICA_PER_QUERY ?? 8);
const DELAY = Number(process.env.FETCH_DELAY ?? 1500);

function loadDataset() {
  if (!existsSync(JSON_PATH)) return [];
  try {
    const arr = JSON.parse(readFileSync(JSON_PATH, "utf8"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveDataset(rows, metas) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(JSON_PATH, JSON.stringify(rows, null, 2), "utf8");
  writeFileSync(SQL_PATH, datasetSql(rows, metas), "utf8");
}

async function main() {
  console.log("▶ 开始采集（安全间隔 %dms）", DELAY);
  const t0 = Date.now();

  const [prmpt, lexica] = await Promise.all([
    collectPrmpt({ limit: LIMIT, delay: DELAY }),
    // action 内 LEXICA_PER_QUERY=0 时完全跳过 lexica（被 Cloudflare 拦），
    // 不触碰 playwright / fetch，省时且不刷迷惑日志。
    PER_QUERY > 0
      ? collectLexica({ perQuery: PER_QUERY, delay: DELAY })
      : Promise.resolve([]),
  ]);

  // 仓库现有数据集作为去重基底（按 id / image_url）。
  const existing = loadDataset();
  const byId = new Map(existing.map((r) => [r.id, r]));
  const byImg = new Map();
  for (const r of existing) if (r.imageUrl) byImg.set(r.imageUrl, r);

  const normalized = [...prmpt, ...lexica].map(normalizeItem);
  let added = 0;
  for (const n of normalized) {
    if (byId.has(n.id)) continue;
    if (n.imageUrl && byImg.has(n.imageUrl)) continue; // 同图只保留一条主记录
    byId.set(n.id, n);
    if (n.imageUrl) byImg.set(n.imageUrl, n);
    added++;
  }
  const all = [...byId.values()];

  console.log(
    `✦ 采集完成：本轮 prmpt=${prmpt.length} lexica=${lexica.length} 新增=${added} 数据集总计=${all.length} （${((Date.now() - t0) / 1000).toFixed(1)}s）`
  );

  const metas = [
    { key: "prmpt", label: "PRMPT", status: prmpt.length ? "ok" : "partial", count: prmpt.length },
    { key: "lexica", label: "Lexica", status: lexica.length ? "ok" : "partial", count: lexica.length },
  ];
  saveDataset(all, metas);
  console.log(`✎ 数据集已写入 ${JSON_PATH} 与 ${SQL_PATH}`);
}

main()
  .catch((e) => {
    console.error("✘ 采集器异常退出：", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeBrowser().catch(() => {});
  });
