// 采集编排器
// 1) 运行各来源采集器
// 2) 合并 + 按 id 去重
// 3) 生成 D1 的 INSERT OR REPLACE SQL
// 4) 若设置了 CLOUDFLARE_API_TOKEN（GitHub Actions 注入），自动 wrangler d1 execute --remote 写入
//    本地无 token 时仅在 .collect/collect.sql 落盘，供人工检查。
//
// 用法： node scripts/collect.mjs
// 环境变量：
//   CLOUDFLARE_API_TOKEN    Cloudflare API Token（含 D1 编辑权限）→ 触发远程写入
//   CLOUDFLARE_ACCOUNT_ID   Cloudflare 账户 ID（wrangler 需要）
//   WRITE_D1=false          即使有 token 也只生成 SQL、不写入

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { collectPrmpt } from "./collect/sources/prmpt.mjs";
import { collectLexica } from "./collect/sources/lexica.mjs";
import { promptsToSql, sourcesMetaToSql } from "./collect/util.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const LIMIT = Number(process.env.PRMPT_LIMIT ?? 12);
const PER_QUERY = Number(process.env.LEXICA_PER_QUERY ?? 8);
const DELAY = Number(process.env.FETCH_DELAY ?? 1500);

async function main() {
  console.log("▶ 开始采集（安全间隔 %dms）", DELAY);
  const t0 = Date.now();

  const [prmpt, lexica] = await Promise.all([
    collectPrmpt({ limit: LIMIT, delay: DELAY }),
    collectLexica({ perQuery: PER_QUERY, delay: DELAY }),
  ]);

  // 按 id 去重（PRMPT 优先，因更早抓取）
  const byId = new Map();
  for (const p of [...prmpt, ...lexica]) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }
  const all = [...byId.values()];

  // 按 image_url 去重，避免同一张图被多个检索词采集后归属多个分类 / 语言而重复入库。
  // 同图保留最早采集（合并顺序 [...prmpt, ...lexica]，prmpt 优先）的一条作为主记录。
  const byImg = new Map();
  const noImg = [];
  for (const p of all) {
    if (p.imageUrl) {
      if (!byImg.has(p.imageUrl)) byImg.set(p.imageUrl, p);
    } else {
      noImg.push(p);
    }
  }
  const deduped = [...byImg.values(), ...noImg];

  console.log(
    `✦ 采集完成：prmpt=${prmpt.length} lexica=${lexica.length} 去重(按id)=${all.length} 去图=${deduped.length} （${((Date.now() - t0) / 1000).toFixed(1)}s）`
  );

  const sql =
    `-- 自动生成 @ ${new Date().toISOString()}\n` +
    promptsToSql(deduped) +
    "\n" +
    sourcesMetaToSql([
      { key: "prmpt", label: "PRMPT", status: prmpt.length ? "ok" : "partial", count: prmpt.length },
      { key: "lexica", label: "Lexica", status: lexica.length ? "ok" : "partial", count: lexica.length },
    ]) +
    "\n";

  const outDir = join(ROOT, ".collect");
  mkdirSync(outDir, { recursive: true });
  const sqlPath = join(outDir, "collect.sql");
  writeFileSync(sqlPath, sql, "utf8");
  console.log(`✎ SQL 已写入 ${sqlPath}`);

  const writeD1 = process.env.CLOUDFLARE_API_TOKEN && process.env.WRITE_D1 !== "false";
  if (writeD1) {
    console.log("⬆ 写入 Cloudflare D1（--remote）…");
    try {
      execFileSync(
        "npx",
        ["wrangler", "d1", "execute", "ai-photography-prompt", "--remote", `--file=${sqlPath}`],
        { cwd: ROOT, stdio: "inherit", env: process.env }
      );
      console.log("✔ D1 写入成功");
    } catch (e) {
      console.error("✘ D1 写入失败：", e.message);
      process.exitCode = 1;
    }
  } else {
    console.log("ℹ 未检测到 CLOUDFLARE_API_TOKEN，仅生成 SQL（不写入 D1）。");
  }
}

main().catch((e) => {
  console.error("✘ 采集器异常退出：", e);
  process.exit(1);
});
