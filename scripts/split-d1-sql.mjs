// 把 data/prompts.json 拆成多个小批次文件（.d1-batches/NNN.sql）。
// 原因：wrangler d1 execute --file 对「单次调用的语句数/大小」有平台限制，
// 一次塞几百条 INSERT 会被静默截断（DELETE 清空后只写进前面一部分 → D1 缺数据）。
// 拆成每批 ≤ BATCH 条后，sync 工作流用 shell 循环逐批执行，避开单次限制。
//
// ⚠ 关键原则（生产红线）：本脚本**绝不**生成 DELETE / TRUNCATE。
// 同步 = 仅 INSERT OR REPLACE（按主键 upsert）：追加新数据 + 按 id 去重重。
// D1 里已存在但不在此次数据集中的数据保留，绝不删除。
//
// ⚠ 不依赖「按 \n 切分行再正则匹配 INSERT」——JSON 型 prompt 的 SQL 值含换行，
// 那种切法会把一条多行 INSERT 截断成残缺语句（曾导致 `near "prmpt" syntax error`）。
// 这里直接读结构化 JSON、用 promptsToSql 现生成，从源头规避文本重解析。
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promptsToSql, sourcesMetaToSql } from "./collect/util.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const JSON_PATH = join(ROOT, "data", "prompts.json");
const OUT = join(ROOT, ".d1-batches");
const BATCH = Number(process.env.D1_BATCH || 20); // 每批 INSERT 条数（远小于任何单次限制）

const rows = JSON.parse(readFileSync(JSON_PATH, "utf8"));
if (!Array.isArray(rows) || rows.length === 0) {
  console.error("✘ data/prompts.json 为空或格式错误，中止（不生成任何清空类 SQL）");
  process.exit(1);
}

// sources 元信息（仅元数据，非用户内容）：按源统计数量。
const counts = {};
for (const r of rows) counts[r.source] = (counts[r.source] || 0) + 1;
const metas = Object.entries(counts).map(([key, count]) => ({
  key,
  label: key === "prmpt" ? "PRMPT" : key === "lexica" ? "Lexica" : key,
  lastRun: Date.now(),
  status: "ok",
  count,
}));

// 清空上一轮批次：只在目录存在时才清（不存在的目录上 rmSync 在部分环境会抛错）。
// 目的：避免上一轮残留的高序号批次文件被本轮误执行。
if (existsSync(OUT)) {
  try {
    rmSync(OUT, { recursive: true, force: true });
  } catch (e) {
    console.error(`✘ 无法清理旧批次目录 ${OUT}：${e.message}`);
    console.error("  残留的高序号批次会被重复执行（upsert 幂等但可能写回旧值），请先手动删除该目录再跑。");
    process.exit(1);
  }
}
mkdirSync(OUT, { recursive: true });

let idx = 0;
// promptsToSql / sourcesMetaToSql 返回已拼好的 SQL 文本（每条语句以 ; 结尾）。
// 直接整段写入，绝不「按行重解析」——多行 JSON 值会被那种切法截断。
const write = (sqlText) => {
  const text = String(sqlText).trim();
  if (!text) return;
  // 兜底守卫：万一生成器被改回「先删后插」，这里直接中止，绝不落盘 DELETE。
  // 依次剔除：① SQL 字符串字面量（正确处理 '' 转义，JSON 提示词里常见）
  // ② `--` 行注释（否则注释里提到 DELETE 也会误报）
  // 之后再检测危险关键字——避免「提示词正文/注释里出现 delete 一词」被误判为删库语句。
  if (/\b(DELETE|TRUNCATE|DROP)\b/i.test(text.replace(/'(?:''|[^'])*'/g, "''").replace(/--[^\n]*/g, ""))) {
    console.error("✘ 生成的批次含 DELETE/TRUNCATE/DROP，违反生产红线，已中止");
    process.exit(1);
  }
  writeFileSync(join(OUT, `${String(idx).padStart(3, "0")}.sql`), text + "\n");
  idx++;
};

// prompts 分批（每批 ≤ BATCH 条 INSERT OR REPLACE）。
for (let i = 0; i < rows.length; i += BATCH) {
  write(promptsToSql(rows.slice(i, i + BATCH)));
}
// sources 元信息放最后一批。
write(sourcesMetaToSql(metas));

console.log(
  `✔ 拆分完成：${idx} 个批次（prompts ${rows.length} 条，每批 ≤ ${BATCH} 条；sources ${metas.length} 条）。纯 upsert，无 DELETE。`
);
