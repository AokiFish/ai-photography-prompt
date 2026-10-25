# AI 摄影提示词图鉴 · THE PROMPT PHOTOGRAPH

奖项级视觉的 AI 摄影提示词画廊。Next.js（App Router）+ Cloudflare D1 + Cloudflare Pages，每日自动采集 PRMPT 与 Lexica 并更新数据。

## 技术栈

- **框架**：Next.js 15（App Router, TypeScript）
- **样式**：Tailwind CSS + 设计令牌（暗色编辑杂志风）
- **数据库**：Cloudflare D1（SQLite）
- **部署**：Cloudflare Pages（via `@cloudflare/next-on-pages`）
- **采集**：Node 脚本 + GitHub Actions（每日 08:00 北京时间）

## 本地开发

```bash
npm install
npm run dev          # http://localhost:3000
```

> 本地 `next dev` 没有 D1 绑定，图集会自动回退到 `src/data/seed.ts` 的种子数据；站点功能完整可用。

## 目录结构

```
src/
  app/
    layout.tsx          根布局（字体/导航/页脚/颗粒层）
    page.tsx            首页（六帧图鉴 + 配方拆解）
    gallery/page.tsx    图集（按来源/语言/标签筛选）
    about/page.tsx      关于
    faq/page.tsx        问答（手风琴）
    saved/page.tsx      收藏（localStorage）
    api/prompts/route.ts 全量提示词 JSON（saved 页使用）
  components/            Grain / Nav / Footer / Plate / PromptCard / CopyButton / SaveButton / Reveal / FaqList
  lib/                   db(D1 绑定) / prompts(读写+兜底) / types / toast / saved
  data/                  home-plates.ts（首页精排）/ seed.ts（图集种子）
scripts/collect/        采集器（util + sources/prmpt + sources/lexica + 编排器）
migrations/0001_init.sql  D1 表结构（来源/语言/标签 分类索引）
wrangler.toml           D1 绑定 + Pages 构建输出
.github/workflows/collect.yml  每日采集工作流
```

## Cloudflare D1 初始化

```bash
# 1) 创建 D1 数据库，把返回的 id 填到 wrangler.toml 的 database_id
npx wrangler d1 create ai-photography-prompt

# 2) 执行迁移（本地 / 远程）
npm run db:migrate:local
npm run db:migrate:remote
```

## 部署到 Cloudflare Pages

```bash
npm run build
npm run cf:build        # 产出 .vercel/output/static
npx wrangler pages deploy .vercel/output/static --project-name=ai-photography-prompt
```

在 Cloudflare 控制台把 D1 数据库 `ai-photography-prompt` 绑定到 Pages 项目的 **DB** 变量（与 wrangler.toml 一致）。

## 每日数据采集

工作流 `.github/workflows/collect.yml` 每天 08:00（北京时间）运行：

1. `node scripts/collect.mjs` 抓取 PRMPT 与 Lexica，生成 `.collect/collect.sql`；
2. `wrangler d1 execute DB --remote` 写入 D1（去重，`INSERT OR REPLACE`）。

需要的仓库 Secrets：

- `CLOUDFLARE_API_TOKEN`：具有 D1 编辑权限的 API Token
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID

采集器内置 `FETCH_DELAY`（默认 1500ms）请求间隔，遵守目标站点的安全抓取节奏；单轮页数/条数有上限，不会过于频繁。

### ⚠️ 采集选择器需按真实响应核对

编写时无法实地抓取确认两个源的最新 DOM / API 结构，采集器采用**通用提取 + 防御式解析**：

- **Lexica**：按已知 `https://lexica.art/api/v1/search?q=&cursor=` 结构解析 `images[]`；若端点/字段变动，解析失败会被吞掉并跳过该查询（不中断工作流）。
- **PRMPT**：通用提取首页/详情页的 `og:description`、`<pre>`/`<code>` 长文本与 `og:image`；若真实结构与假设不同，请在 `scripts/collect/sources/prmpt.mjs` 的 `TODO` 处微调选择器。

上线后建议手动跑一次 `node scripts/collect.mjs` 观察输出，按需校准。

## 数据分类策略

每条提示词带三个分类维度，互不混装：

- `source`：来源（`prmpt` / `lexica`）—— 出处可追溯
- `style`：摄影语言（`cinematic` / `minimalist` / `film` / `monochrome` / `macro` / `noir` / `portrait` / `landscape` / `other`）
- `category`：自由标签（中文，如「人像」「夜景」）

图集页可按来源 / 语言 / 标签三维筛选。
