// 数据集校验闸：采集器产出后、提交/同步前，先过这一关。
// 任一红线不达标 → 进程退出码非 0（GitHub Actions 该步变红、整条采集链中止），
// 绝不把退化/脏数据提交进仓库、更不同步进 D1。
//
// 红线：
//   1) 采集条数 = 0            → 站点结构可能已变 / 被拦，整轮作废
//   2) 采集条数 < MIN_COUNT     → 疑似抓取大面积失败（默认 30，正常应有 150+）
//   3) 条数较上次提交骤降 >50%  → 疑似抓取退化（正常只会增/持平，不会腰斩）
//   4) 脏数据比例 > 10%        → 缺 /prompt/ 内页链接或缺失分类的记录过多
//
// 用法： node scripts/validate-dataset.mjs
// 退出： 0 = 通过；1 = 未通过（详见 stderr 说明）

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const MIN_COUNT = 30;
const MAX_BAD_RATIO = 0.1;
const DROP_RATIO = 0.5;

function readJsonFromRef(ref) {
  try {
    return JSON.parse(execSync(`git show ${ref}:data/prompts.json`).toString("utf8"));
  } catch {
    return null;
  }
}

const oldArr = readJsonFromRef("HEAD");
const oldCount = oldArr ? oldArr.length : -1;

let arr;
try {
  arr = JSON.parse(readFileSync("data/prompts.json", "utf8"));
} catch (e) {
  console.error("✘ 无法读取 data/prompts.json：", e.message);
  process.exit(1);
}
if (!Array.isArray(arr)) {
  console.error("✘ data/prompts.json 不是数组");
  process.exit(1);
}

const n = arr.length;
let bad = 0;
for (const r of arr) {
  const urlOk = r.sourceUrl && /\/prompt\//.test(r.sourceUrl);
  const catOk = r.category && String(r.category).trim().length > 0;
  if (!urlOk || !catOk) bad++;
}
const badRatio = n > 0 ? bad / n : 1;

const reasons = [];
if (n === 0) reasons.push("采集到 0 条（站点结构可能已变 / 被拦截）");
if (n < MIN_COUNT) reasons.push(`仅 ${n} 条，低于阈值 ${MIN_COUNT}，疑似抓取大面积失败`);
if (oldCount > 0 && n < oldCount * DROP_RATIO)
  reasons.push(`条数从 ${oldCount} 骤降到 ${n}（>50%），疑似采集退化`);
if (badRatio > MAX_BAD_RATIO)
  reasons.push(`${bad}/${n} 条缺 /prompt/ 内页链接或分类（占比 ${(badRatio * 100).toFixed(0)}% > ${MAX_BAD_RATIO * 100}%）`);

console.log(`采集条数=${n} 上次提交=${oldCount < 0 ? "?" : oldCount} 脏数据=${bad}`);
if (reasons.length) {
  console.error("✘ 数据集校验未通过，中止提交与同步：");
  reasons.forEach((r) => console.error("   - " + r));
  process.exit(1);
}
console.log("✔ 数据集校验通过，可提交并同步 D1");
