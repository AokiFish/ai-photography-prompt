// 采集构建器的「效果参考图」到 public/thumbs/。
//
// 用法：
//   node scripts/fetch-builder-thumbs.mjs          # 只下载缺失的
//   node scripts/fetch-builder-thumbs.mjs --force   # 全部重新下载
//
// 数据来源：data/builder.json 里每个选项的 thumb 字段（如 style-photo.webp），
// 对应源站 https://kadar.studio/thumbs/<name>-480.webp。
//
// ⚠ 只下载到 public/thumbs/，绝不改动 data/prompts.json / D1 的 prompts 表
// （构建器数据与 PRMPT 采集数据是两套，不要混）。
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_PATH = join(ROOT, "data", "builder.json");
const OUT_DIR = join(ROOT, "public", "thumbs");

const BASE = "https://kadar.studio/thumbs";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DELAY = Number(process.env.THUMB_DELAY || 150);
const FORCE = process.argv.includes("--force");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
mkdirSync(OUT_DIR, { recursive: true });

const jobs = [];
for (const c of data.categories) {
  for (const o of c.options) {
    if (!o.thumb) continue;
    jobs.push({ file: o.thumb, url: `${BASE}/${o.thumb.replace(/\.webp$/, "")}-480.webp`, cat: c.id, opt: o.id });
  }
}

console.log(`▶ 需要参考图 ${jobs.length} 张（--force=${FORCE}）`);

let done = 0;
let skipped = 0;
let failed = 0;
const failures = [];

for (const j of jobs) {
  const out = join(OUT_DIR, j.file);
  if (!FORCE && existsSync(out) && statSync(out).size > 0) {
    skipped++;
    continue;
  }
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    try {
      await sleep(DELAY);
      const res = await fetch(j.url, { headers: { "User-Agent": UA, Referer: "https://kadar.studio/" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) throw new Error(`响应过小 ${buf.length}B`);
      writeFileSync(out, buf);
      done++;
      ok = true;
    } catch (e) {
      if (attempt === 2) {
        failed++;
        failures.push(`${j.cat}/${j.opt} -> ${j.url} : ${e.message}`);
      } else {
        await sleep(800 * (attempt + 1));
      }
    }
  }
}

let bytes = 0;
let count = 0;
for (const f of jobs) {
  const p = join(OUT_DIR, f.file);
  if (existsSync(p)) {
    bytes += statSync(p).size;
    count++;
  }
}

console.log(`\n✔ 完成：新增下载 ${done}，跳过（已存在）${skipped}，失败 ${failed}`);
console.log(`  public/thumbs/ 现有 ${count}/${jobs.length} 张，共 ${(bytes / 1024 / 1024).toFixed(2)} MB`);
if (failures.length) {
  console.log("\n失败明细：");
  for (const f of failures.slice(0, 20)) console.log("  ·", f);
  process.exit(1);
}
