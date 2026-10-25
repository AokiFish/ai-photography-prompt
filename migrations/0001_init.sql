-- AI 摄影提示词图鉴 · D1 初始化
-- 分类维度：source（来源: prmpt / lexica）+ category（自由标签）+ style（摄影语言）
-- 来源与语言分别建索引，便于按维度检索，互不混装。

CREATE TABLE IF NOT EXISTS prompts (
  id             TEXT PRIMARY KEY,
  source         TEXT NOT NULL,            -- 'prmpt' | 'lexica'
  source_url     TEXT,
  title          TEXT,
  prompt_text    TEXT NOT NULL,
  negative_prompt TEXT,
  category       TEXT,                     -- 自由分类标签（中文）
  style          TEXT NOT NULL,            -- 摄影语言：cinematic/minimalist/film/monochrome/macro/noir/portrait/landscape/other
  model          TEXT,
  image_url      TEXT,
  width          INTEGER,
  height         INTEGER,
  tags           TEXT,                     -- JSON 数组
  collected_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompts_source   ON prompts(source);
CREATE INDEX IF NOT EXISTS idx_prompts_style    ON prompts(style);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
CREATE INDEX IF NOT EXISTS idx_prompts_collected ON prompts(collected_at DESC);

-- 采集源元信息（记录上次运行时间/状态/条数，便于审计）
CREATE TABLE IF NOT EXISTS sources (
  key        TEXT PRIMARY KEY,             -- 'prmpt' | 'lexica'
  label      TEXT,
  last_run   INTEGER,
  status     TEXT,                         -- 'ok' | 'partial' | 'failed'
  count      INTEGER
);
