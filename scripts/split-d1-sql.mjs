// 把 data/prompts.sql 拆成多个小批次文件（.d1-batches/NNN.sql）。
// 原因：wrangler d1 execute --file 对「单次调用的语句数/大小」有平台限制，
// 一次塞 158 条 INSERT 会被静默截断（DELETE 清空后只写进前面一部分 → D1 缺数据）。
// 拆成每批 ≤ BATCH 条后，sync 工作流用 shell 循环逐批执行，避开单次限制。
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const input = process.argv[2] || join(ROOT, "data", "prompts.sql");
const OUT = join(ROOT, ".d1-batches");
const BATCH = Number(process.env.D1_BATCH || 20); // 每批 INSERT 条数（远小于任何单次限制）

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const raw = readFileSync(input, "utf8");
const lines = raw.split("\n").filter((l) => l.trim() && !l.trim().startsWith("--"));
const deletes = lines.filter((l) => /^\s*DELETE\b/i.test(l));
const prompts = lines.filter((l) => /INSERT OR REPLACE INTO prompts\b/i.test(l));
const sources = lines.filter((l) => /INSERT OR REPLACE INTO sources\b/i.test(l));

let idx = 0;
const write = (stmts) => {
  writeFileSync(join(OUT, `${String(idx).padStart(3, "0")}.sql`), stmts.join("\n") + "\n");
  idx++;
};

// batch 0：所有 DELETE（全量刷新前清空）
if (deletes.length) write(deletes);
// 后续：prompts 每 BATCH 条一批
for (let i = 0; i < prompts.length; i += BATCH) write(prompts.slice(i, i + BATCH));
// 末尾：sources 元信息
if (sources.length) write(sources);

console.log(
  `✔ 拆分完成：${idx} 个批次（DELETE ${deletes.length} 条 / prompts ${prompts.length} 条 / sources ${sources.length} 条，每批 ≤ ${BATCH} 条）`
);
