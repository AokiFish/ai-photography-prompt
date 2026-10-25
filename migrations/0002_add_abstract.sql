-- 给 prompts 表补「简短描述」列（图集卡片只显示它，不再铺完整 prompt）。
-- 纯加列（additive），不动任何已有数据行；SQLite 不支持 ADD COLUMN IF NOT EXISTS，
-- 重复执行会报 duplicate column name —— 幂等由调用方处理（sync-d1.yml 里已容错跳过）。
ALTER TABLE prompts ADD COLUMN abstract TEXT;
