-- Supabase 数据库表结构
-- 在 Supabase Dashboard -> SQL Editor 中执行此 SQL

-- 创建生成记录表
CREATE TABLE IF NOT EXISTS generation_records (
  id BIGSERIAL PRIMARY KEY,
  results JSONB NOT NULL,
  total_cost DECIMAL(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_generation_records_created_at ON generation_records(created_at DESC);

-- 启用 Row Level Security (RLS)
ALTER TABLE generation_records ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许匿名插入（用于统计）
CREATE POLICY "Allow anonymous insert" ON generation_records
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 创建策略：允许匿名读取（用于统计）
CREATE POLICY "Allow anonymous select" ON generation_records
  FOR SELECT
  TO anon
  USING (true);

-- 如果需要定期清理旧数据，可以设置一个函数（可选）
-- 此函数可以手动执行或在 Supabase 中设置为定时任务
CREATE OR REPLACE FUNCTION cleanup_old_records(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM generation_records
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

