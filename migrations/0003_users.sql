-- 用户表：登录后落一份，主键 = provider:providerId（github:123 / google:abc）
-- 会话 Cookie 自带用户信息，所以不绑 D1 也能登录；绑了 DB 才有这份持久记录。
-- 移植自 hello-ai（D:\Mydata\hone\bun\hello-ai\migrations\0002_users.sql + 0003_avatar_source.sql），
-- 合并为一张表，含 auth.ts 的 upsert / updateAvatar 所需的 avatar_source 列。
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,        -- github:12345 | google:...
  provider      TEXT NOT NULL,
  provider_id   TEXT NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT,
  avatar        TEXT,
  avatar_source TEXT NOT NULL DEFAULT 'provider',
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_provider ON users(provider, provider_id);
