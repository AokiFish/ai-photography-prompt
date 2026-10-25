// 生产红线守卫：校验一批 SQL 文件里**绝不**出现破坏性语句（DELETE / TRUNCATE / DROP），
// 且每条语句都必须是 INSERT OR REPLACE。
//
// 用法： node scripts/assert-no-destructive-sql.mjs <目录> [...目录]
//
// 背景：同步曾采用「先 DELETE 全表 → 再 INSERT」的整表重建写法，一次 INSERT 语法错误
// 后 D1 被清空且无法回滚。现同步策略改为**仅 upsert**（追加 + 按主键 id 去重重），
// 本脚本是 CI 上的硬防线：任何删库写法都会在写库前被拦下，而不是等数据没了才发现。
//
// 判定方式（避免误报）：
//   ① 先剔除 SQL 字符串字面量（正确处理 '' 转义，JSON 提示词里大量单引号）
//   ② 再剔除 `--` 行注释（否则注释里提到 "无 DELETE" 也会误报）
//   ③ 最后在剩余的「真语句」里检测关键字
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.error("用法： node scripts/assert-no-destructive-sql.mjs <目录> [...目录]");
  process.exit(1);
}

// 剔除字符串字面量与行注释，只留真正的 SQL 骨架。
function stripNonCode(sql) {
  return sql.replace(/'(?:''|[^'])*'/g, "''").replace(/--[^\n]*/g, "");
}

// 按语句起始点切分（值里不会出现该串，多行 JSON 安全；勿按 \n 切行）。
function statements(sql) {
  return stripNonCode(sql)
    // 注意：不要把 REPLACE 列入切分点——否则 "INSERT OR REPLACE" 会被切成两条。
    .split(/(?=(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE)\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

const DESTRUCTIVE = /\b(DELETE|TRUNCATE|DROP)\b/i;

let files = 0;
let checked = 0;
let failed = 0;

for (const dir of dirs) {
  let names = [];
  try {
    names = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  } catch (e) {
    console.error(`✘ 无法读取目录 ${dir}：${e.message}`);
    process.exit(1);
  }
  for (const name of names) {
    const path = join(dir, name);
    if (!statSync(path).isFile()) continue;
    files++;
    const sql = readFileSync(path, "utf8");

    if (DESTRUCTIVE.test(stripNonCode(sql))) {
      const hit = stripNonCode(sql).match(DESTRUCTIVE);
      const at = hit.index ?? 0;
      console.error(`✘ ${path} 含破坏性语句「${hit[0]}」：`);
      console.error(`  上下文：${stripNonCode(sql).slice(Math.max(0, at - 100), at + 100).replace(/\s+/g, " ")}`);
      failed++;
      continue;
    }

    for (const stmt of statements(sql)) {
      checked++;
      if (!/^INSERT\s+OR\s+REPLACE\b/i.test(stmt)) {
        console.error(`✘ ${path} 出现非 upsert 语句：${stmt.slice(0, 120).replace(/\s+/g, " ")}`);
        failed++;
      }
    }
  }
}

if (!files) {
  console.error(`✘ ${dirs.join(", ")} 下没有任何 .sql 批次文件，拒绝继续（数据集可能为空）`);
  process.exit(1);
}

if (failed) {
  console.error(`\n✘ 守卫未通过：${failed} 处问题。同步禁止执行破坏性 SQL。`);
  process.exit(1);
}

console.log(`✔ 守卫通过：${files} 个批次文件 / ${checked} 条语句，全部为 INSERT OR REPLACE，无 DELETE/TRUNCATE/DROP。`);
