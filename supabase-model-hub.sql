-- =====================================================
-- 模型中台数据库设置脚本
-- 在 Supabase Dashboard -> SQL Editor 中执行
--
-- 版本: v1.0
-- 创建日期: 2026-01-10
-- 用途: 为AI UI Comparator项目创建模型管理相关表
-- =====================================================

-- ┌─────────────────────────────────────────────────────┐
-- │  1. 创建 models 表 (模型信息表)                     │
-- └─────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS models (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基础信息
  model_id VARCHAR(255) UNIQUE NOT NULL,     -- OpenRouter模型ID，如 'google/gemini-2.5-flash-image'
  name VARCHAR(255) NOT NULL,                -- 显示名称，如 'Gemini 2.5 Flash Image'
  provider VARCHAR(100),                     -- 提供商：google, anthropic, openai, x-ai 等

  -- 成本信息
  estimated_cost DECIMAL(10, 6) DEFAULT 0,   -- 预估成本（来自OpenRouter）
  actual_cost DECIMAL(10, 6),                -- 实际测试成本

  -- 模型类型
  detected_type VARCHAR(50),                 -- 检测到的类型：'image', 'code', 'text', 'unknown'

  -- 验证状态（核心字段）
  verification_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'verified', 'partial', 'failed'
  verification_score INTEGER DEFAULT 0,      -- 验证得分 0-4

  -- 4个验证点详情 (JSONB格式)
  validation_details JSONB DEFAULT '{
    "api_call": {"pass": false, "status_code": null},
    "data_extraction": {"pass": false, "type": null},
    "response_time": {"pass": false, "time_ms": null},
    "cost_accuracy": {"pass": false, "actual_cost": null}
  }'::jsonb,

  -- 性能指标
  avg_response_time INTEGER,                 -- 平均响应时间（毫秒）
  success_rate DECIMAL(5, 2),                -- 成功率（百分比）
  test_count INTEGER DEFAULT 0,              -- 测试次数

  -- 启用状态
  is_enabled BOOLEAN DEFAULT false,          -- 是否在首页显示

  -- OpenRouter元数据
  context_length INTEGER,                    -- 上下文长度
  supports_image BOOLEAN DEFAULT false,      -- 是否支持图片输入
  pricing_info JSONB,                        -- 完整定价信息

  -- 时间戳
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),   -- 首次发现时间
  last_tested_at TIMESTAMPTZ,                -- 最后测试时间
  last_synced_at TIMESTAMPTZ,                -- 最后同步时间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ┌─────────────────────────────────────────────────────┐
-- │  2. 创建 models 表的索引                             │
-- └─────────────────────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
CREATE INDEX IF NOT EXISTS idx_models_status ON models(verification_status);
CREATE INDEX IF NOT EXISTS idx_models_enabled ON models(is_enabled);
CREATE INDEX IF NOT EXISTS idx_models_type ON models(detected_type);
CREATE INDEX IF NOT EXISTS idx_models_score ON models(verification_score DESC);
CREATE INDEX IF NOT EXISTS idx_models_synced ON models(last_synced_at DESC);

-- ┌─────────────────────────────────────────────────────┐
-- │  3. 为 models 表添加注释                             │
-- └─────────────────────────────────────────────────────┘

COMMENT ON TABLE models IS '存储所有AI模型的信息、验证状态和测试结果';
COMMENT ON COLUMN models.model_id IS 'OpenRouter模型ID，全局唯一';
COMMENT ON COLUMN models.verification_status IS 'verified=4/4通过, partial=2-3/4通过, failed=0-1/4通过, pending=未测试';
COMMENT ON COLUMN models.verification_score IS '验证得分，范围0-4，代表通过的验证点数量';
COMMENT ON COLUMN models.validation_details IS '存储4个验证点的详细结果：api_call, data_extraction, response_time, cost_accuracy';

-- ┌─────────────────────────────────────────────────────┐
-- │  4. 创建 test_logs 表 (测试日志表)                   │
-- └─────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS test_logs (
  -- 主键
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联信息
  model_id VARCHAR(255) NOT NULL,            -- 关联到 models.model_id

  -- 测试输入
  test_prompt TEXT NOT NULL,                 -- 测试提示词
  test_type VARCHAR(50) DEFAULT 'manual',    -- 'manual', 'batch', 'auto'

  -- 测试结果
  success BOOLEAN NOT NULL,                  -- 总体是否成功
  verification_score INTEGER DEFAULT 0,      -- 本次测试得分 0-4

  -- 4个验证点结果 (JSONB格式)
  validations JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 提取的数据
  detected_type VARCHAR(50),                 -- 'image', 'code', 'text'
  extracted_data_preview TEXT,               -- 数据预览（前200字符）
  extracted_data_size INTEGER,               -- 数据大小（字节）

  -- 性能指标
  response_time_ms INTEGER,                  -- 响应时间（毫秒）
  actual_cost DECIMAL(10, 6),                -- 实际成本

  -- 原始数据（调试用）
  raw_response JSONB,                        -- API原始响应（可选）
  error_message TEXT,                        -- 错误信息
  error_stack TEXT,                          -- 错误堆栈

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ┌─────────────────────────────────────────────────────┐
-- │  5. 创建 test_logs 表的索引                          │
-- └─────────────────────────────────────────────────────┘

CREATE INDEX IF NOT EXISTS idx_test_logs_model ON test_logs(model_id);
CREATE INDEX IF NOT EXISTS idx_test_logs_created ON test_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_logs_success ON test_logs(success);
CREATE INDEX IF NOT EXISTS idx_test_logs_type ON test_logs(test_type);

-- ┌─────────────────────────────────────────────────────┐
-- │  6. 为 test_logs 表添加注释                          │
-- └─────────────────────────────────────────────────────┘

COMMENT ON TABLE test_logs IS '存储所有模型测试的详细日志';
COMMENT ON COLUMN test_logs.validations IS '存储4个验证点的详细结果：api_call, data_extraction, response_time, cost_accuracy';
COMMENT ON COLUMN test_logs.test_type IS 'manual=手动测试, batch=批量测试, auto=自动测试';

-- ┌─────────────────────────────────────────────────────┐
-- │  7. 启用 Row Level Security (RLS)                   │
-- └─────────────────────────────────────────────────────┘

ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_logs ENABLE ROW LEVEL SECURITY;

-- ┌─────────────────────────────────────────────────────┐
-- │  8. 创建 RLS 策略 - models 表                        │
-- └─────────────────────────────────────────────────────┘

-- 允许匿名用户读取模型列表
CREATE POLICY "Allow anonymous read models" ON models
  FOR SELECT
  TO anon
  USING (true);

-- 允许匿名用户插入新模型
CREATE POLICY "Allow anonymous insert models" ON models
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 允许匿名用户更新模型信息
CREATE POLICY "Allow anonymous update models" ON models
  FOR UPDATE
  TO anon
  USING (true);

-- 允许匿名用户删除模型（可选，谨慎使用）
-- CREATE POLICY "Allow anonymous delete models" ON models
--   FOR DELETE
--   TO anon
--   USING (true);

-- ┌─────────────────────────────────────────────────────┐
-- │  9. 创建 RLS 策略 - test_logs 表                     │
-- └─────────────────────────────────────────────────────┘

-- 允许匿名用户读取测试日志
CREATE POLICY "Allow anonymous read test_logs" ON test_logs
  FOR SELECT
  TO anon
  USING (true);

-- 允许匿名用户插入测试日志
CREATE POLICY "Allow anonymous insert test_logs" ON test_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ┌─────────────────────────────────────────────────────┐
-- │  10. 实用函数 - 更新模型验证状态                     │
-- └─────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION update_model_verification(
  p_model_id VARCHAR(255),
  p_test_result JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE models SET
    verification_score = (p_test_result->>'score')::INTEGER,
    verification_status = p_test_result->>'overall_status',
    validation_details = p_test_result->'validations',
    detected_type = p_test_result->>'detected_type',
    actual_cost = (p_test_result->>'actual_cost')::DECIMAL,
    last_tested_at = NOW(),
    test_count = test_count + 1,
    updated_at = NOW()
  WHERE model_id = p_model_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_model_verification IS '根据测试结果更新模型的验证状态';

-- ┌─────────────────────────────────────────────────────┐
-- │  11. 实用函数 - 获取验证统计                         │
-- └─────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION get_verification_stats()
RETURNS TABLE (
  status VARCHAR(20),
  count BIGINT,
  avg_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    verification_status,
    COUNT(*) as count,
    AVG(verification_score) as avg_score
  FROM models
  GROUP BY verification_status
  ORDER BY verification_status;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_verification_stats IS '获取各验证状态的统计信息';

-- ┌─────────────────────────────────────────────────────┐
-- │  12. 实用函数 - 清理旧的测试日志                     │
-- └─────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION cleanup_old_test_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM test_logs
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_test_logs IS '清理指定天数之前的测试日志，默认保留30天';

-- ┌─────────────────────────────────────────────────────┐
-- │  13. 实用函数 - 获取模型详细统计                     │
-- └─────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION get_model_stats(p_model_id VARCHAR(255))
RETURNS TABLE (
  total_tests BIGINT,
  success_tests BIGINT,
  failed_tests BIGINT,
  avg_response_time NUMERIC,
  avg_cost NUMERIC,
  last_test_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_tests,
    COUNT(*) FILTER (WHERE success = true) as success_tests,
    COUNT(*) FILTER (WHERE success = false) as failed_tests,
    AVG(response_time_ms) as avg_response_time,
    AVG(actual_cost) as avg_cost,
    MAX(created_at) as last_test_date
  FROM test_logs
  WHERE model_id = p_model_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_model_stats IS '获取指定模型的测试统计信息';

-- ┌─────────────────────────────────────────────────────┐
-- │  14. 导入现有模型（可选）                            │
-- └─────────────────────────────────────────────────────┘

INSERT INTO models (model_id, name, provider, estimated_cost, detected_type, is_enabled)
VALUES
  ('google/gemini-2.5-flash-image', 'Gemini 2.5 Flash Image', 'google', 0.05, 'image', true),
  ('google/gemini-3-pro-image-preview', 'Gemini 3 Pro Image', 'google', 0.05, 'image', true),
  ('anthropic/claude-3.5-sonnet', 'Claude 3.5 (描述)', 'anthropic', 0.06, 'text', true),
  ('x-ai/grok-4.1-fast', 'Grok 4.1 Fast (代码)', 'x-ai', 0.01, 'code', true),
  ('anthropic/claude-haiku-4.5', 'Claude Haiku 4.5 (代码)', 'anthropic', 0.02, 'code', true),
  ('deepseek/deepseek-chat', 'DeepSeek Coder (代码)', 'deepseek', 0.01, 'code', true),
  ('qwen/qwen-2.5-72b-instruct', 'Qwen 2.5 (代码)', 'qwen', 0.01, 'code', true),
  ('deepseek/deepseek-chat-v3.1', 'DeepSeek V3 (代码)', 'deepseek', 0.01, 'code', true)
ON CONFLICT (model_id) DO NOTHING;

-- ┌─────────────────────────────────────────────────────┐
-- │  15. 验证安装                                        │
-- └─────────────────────────────────────────────────────┘

DO $$
DECLARE
  models_count INTEGER;
  test_logs_count INTEGER;
  functions_count INTEGER;
BEGIN
  -- 检查表
  SELECT COUNT(*) INTO models_count FROM models;
  SELECT COUNT(*) INTO test_logs_count FROM test_logs;

  -- 检查函数
  SELECT COUNT(*) INTO functions_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_name IN ('update_model_verification', 'get_verification_stats', 'cleanup_old_test_logs', 'get_model_stats');

  -- 输出结果
  RAISE NOTICE '✅ 模型中台数据库设置完成！';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 统计信息:';
  RAISE NOTICE '   - models 表: % 条记录', models_count;
  RAISE NOTICE '   - test_logs 表: % 条记录', test_logs_count;
  RAISE NOTICE '   - 实用函数: % 个', functions_count;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  IF functions_count = 4 THEN
    RAISE NOTICE '✅ 所有功能安装成功！';
  ELSE
    RAISE WARNING '⚠️  部分函数可能未安装，请检查';
  END IF;
END $$;

-- =====================================================
-- 安装完成！
--
-- 下一步:
-- 1. 在 admin.html 中配置 Supabase URL 和 API Key
-- 2. 测试连接: 在浏览器控制台运行 supabase.from('models').select('*')
-- 3. 开始使用模型中台功能
-- =====================================================
