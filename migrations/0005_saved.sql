-- 收藏：登录用户的收藏同步进 D1（本地 localStorage 仍保留，二者取并集）。
-- 按 (user_id, prompt_id) 去重；取消收藏走 DELETE。
CREATE TABLE IF NOT EXISTS saved (
  user_id    TEXT NOT NULL,
  prompt_id  TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  PRIMARY KEY (user_id, prompt_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_user ON saved(user_id);
