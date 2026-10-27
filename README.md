# AI 摄影提示词图鉴 · THE PROMPT PHOTOGRAPH

奖项级视觉的 AI 摄影提示词画廊。Next.js（App Router）+ Cloudflare D1 + Cloudflare Pages，支持账号登录与云端同步。

## 功能

- **图鉴首页**：六帧摄影语言精选 + 提示词配方拆解。
- **图集（Gallery）**：按摄影语言 / 标签筛选、检索、收藏。
- **提示词详情**：完整提示词、一键复制、收藏、重新打开。
- **构建器（Builder）**：可视化拼装提示词，内置 **AI 精炼（Refine）** 把草稿打磨成可用提示词。
- **收藏（Saved）**：本机 `localStorage` 与登录后的 **D1 云端** 双写，跨设备同步。
- **历史（History）**：提示词「剪贴板」——精炼、构建器复制、图集复制产生的提示文本都会留存；未登录本机存最近 20 条，登录后云端存最近 500 条（超出自动淘汰最早），可在任意设备找回、复制、重新打开。
- **登录**：Google / GitHub OAuth（弹窗授权 + HMAC 签名 HttpOnly Cookie），按用户隔离 `saved` 与 `history`。

## 技术栈

- **框架**：Next.js 15（App Router, TypeScript）
- **样式**：Tailwind CSS + 设计令牌（暗色编辑杂志风）
- **数据库**：Cloudflare D1（SQLite）
- **部署**：Cloudflare Pages（via `@cloudflare/next-on-pages`）
- **登录**：OAuth 2.0（GitHub / Google），移植自 `hello-ai` 的 HMAC Cookie 会话方案

## 本地开发

```bash
npm install
npm run dev          # http://localhost:3000
```

> 本地 `next dev` 没有 D1 绑定，图集会自动回退到 `src/data/seed.ts` 的种子数据；站点功能完整可用。登录相关接口依赖 Cloudflare Pages 环境变量（见下文）。

## 目录结构

```
src/
  app/
    layout.tsx                根布局（字体/导航/页脚/颗粒层 + AuthProvider）
    page.tsx                  首页（六帧图鉴 + 配方拆解）
    gallery/page.tsx          图集（筛选 / 检索 / 收藏）
    builder/page.tsx          构建器（含 AI 精炼）
    prompt/[slug]/page.tsx    提示词详情（复制 / 收藏 / 重新打开）
    saved/page.tsx            收藏（本地 + 云端合并）
    history/page.tsx          历史 / 提示词剪贴板
    about/page.tsx            关于
    faq/page.tsx              问答（手风琴）
    api/
      auth/[...path]/route.ts 登录（me/config/login/callback/logout/avatar）
      saved/route.ts          收藏增删查（按登录用户）
      history/route.ts        历史记录写 / 查（本地+云端）
      refine/                 提示词精炼（route/config/verify）
  components/                 Grain / Nav / UserMenu / Footer / Plate / PlateImage
                             PromptCard / PromptModal / CopyButton / CopyWithHistory
                             SaveButton / SavedClient / HistoryClient / BuilderClient
                             Reveal / FaqList / Toast / RefineModelPicker
  lib/                       db(D1 绑定) / prompts(读写+兜底) / types / toast
                             auth(登录核心) / auth-client(前端状态) / session(服务端读取)
                             history-store(本地存储) / history-client(useHistory)
                             saved / builder / refine-models
  data/                      home-plates.ts（首页精排）/ seed.ts（图集种子）
scripts/collect/             内容更新脚本（自动化维护，无需手动介入）
migrations/                  0001_init / 0002_add_abstract / 0003_users
                             0004_history / 0005_saved
wrangler.toml                D1 绑定 + Pages 构建输出
.github/workflows/           collect.yml（内容更新）/ sync-d1.yml（同步 D1）
```

## 环境变量（Cloudflare Pages）

登录与会话需要以下变量（控制台 `Settings → Environment variables`，或本地 `.dev.vars`）：

| 变量 | 说明 |
| --- | --- |
| `SESSION_SECRET` | 会话 Cookie 的 HMAC 签名密钥，自行生成（`openssl rand -base64 48`），切勿轮换过频 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth App 凭据 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 客户端凭据 |

OAuth 后台的回调地址需填：

```
https://你的域名/api/auth/callback/github
https://你的域名/api/auth/callback/google
```

变量缺失时，对应登录按钮自动置灰，其余功能不受影响。

## 模型配置（AI 精炼）

「用 AI 精炼」把草稿交给大模型润色成更适合图像模型的提示词，走 OpenAI 兼容的 `/chat/completions` 协议。服务端默认模型由以下环境变量控制（控制台 `Settings → Environment variables` 或本地 `.dev.vars`）：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `REFINE_API_KEY` / `CUSTOM_API_KEY` | 是 | 大模型服务商的 API Key |
| `REFINE_BASE_URL` / `CUSTOM_BASE_URL` | 否 | OpenAI 兼容接口地址，默认 `https://openrouter.ai/api/v1` |
| `REFINE_MODEL` / `CUSTOM_MODEL` | 第三方必填 | 模型 ID（如 `agnes-3.0-flash`）；用 OpenRouter 时可省略，默认 `openai/gpt-4o-mini` |

- 修改变量后必须**重新部署**才生效；`/api/refine/config` 可查看服务端是否已配置（不回显密钥本身）。
- 用户也能在构建器里临时添加自己的模型（Base URL + 模型 ID + 可选密钥），添加前先发真实请求验证连通性。
- **用户填写的密钥只存在其本人浏览器 `localStorage`，不进仓库、不上传服务器**；留空则复用服务端密钥。

## Cloudflare D1 初始化

```bash
# 1) 创建 D1 数据库，把返回的 id 填到 wrangler.toml 的 database_id
npx wrangler d1 create ai-photography-prompt

# 2) 执行迁移（本地 / 远程）
npx wrangler d1 execute ai-photography-prompt --local --file=./migrations/0001_init.sql
npx wrangler d1 execute ai-photography-prompt --local --file=./migrations/0002_add_abstract.sql
npx wrangler d1 execute ai-photography-prompt --local --file=./migrations/0003_users.sql
npx wrangler d1 execute ai-photography-prompt --local --file=./migrations/0004_history.sql
npx wrangler d1 execute ai-photography-prompt --local --file=./migrations/0005_saved.sql
# 远程环境把 --local 换成 --remote 逐一执行
```

表结构：

- `prompts`：提示词主表（含 `abstract` 列）
- `users`：登录用户（`id` / `provider` / `provider_id` / `name` / `email` / `avatar`）
- `saved`：收藏（`user_id` + `prompt_id` 联合主键）
- `history`：历史剪贴板（`user_id` / `prompt_text` / `source` / `created_at`，本地 20 / 云端 500 滚动淘汰）

> 迁移均为 `CREATE TABLE IF NOT EXISTS`，重复执行安全。

## 部署到 Cloudflare Pages

```bash
npm run build
npm run cf:build        # 产出 .vercel/output/static
npx wrangler pages deploy .vercel/output/static --project-name=ai-photography-prompt
```

在 Cloudflare 控制台把 D1 数据库 `ai-photography-prompt` 绑定到 Pages 项目的 **DB** 变量（与 wrangler.toml 一致），并配置上述环境变量。内容更新由 `.github/workflows/` 中的自动化工作流维护，无需手动操作。
