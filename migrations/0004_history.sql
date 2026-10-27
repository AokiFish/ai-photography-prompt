-- 浏览历史：记录登录用户「看过的提示词详情页」。
-- 按 (user_id, prompt_id) 去重，重复浏览只更新 viewed_at（最新一次在前）。
-- 展示时联 prompts 表取标题/图片等，这里只存外键 + 时间戳，避免冗余与脏数据。
CREATE TABLE IF NOT EXISTS history (
  user_id    TEXT NOT NULL,
  prompt_id  TEXT NOT NULL,
  viewed_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, prompt_id)
);
CREATE INDEX IF NOT EXISTS idx_history_user_time ON history(user_id, viewed_at DESC);
