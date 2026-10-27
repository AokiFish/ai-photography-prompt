-- 提示词历史（剪贴板）：记录用户「精炼 / 构建器复制 / 图集复制」产生的提示文本本身。
-- 与「浏览记录」不同，这里存的是提示词内容，支持未登录本机 20 / 登录云端 500 的滚动窗口。
-- 2026-10-27 重做：原方案只记浏览过的详情页（prompt_id + viewed_at），现改为存 prompt_text + source。
--   旧的 history 表尚未存过真实提示词（之前是错的浏览记录实现），DROP 安全；若你已在其中手动存了数据，先备份再执行。
DROP TABLE IF EXISTS history;
CREATE TABLE history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  prompt_id   TEXT,                 -- 来自图集的可空（精炼/构建器生成的提示没有对应图集条目）
  prompt_text TEXT NOT NULL,        -- 提示文本（核心字段）
  source      TEXT NOT NULL,        -- 'refine' | 'builder' | 'gallery'
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_user_time ON history(user_id, created_at DESC);
