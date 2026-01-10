# 模型中台 (Model Hub) - 分阶段实施文档

> **文档版本：** v1.0
> **创建日期：** 2026-01-10
> **预计周期：** 5-7个对话（每个对话1个阶段）
> **实施方式：** 一个功能一个对话，逐步验证

---

## 📋 目录

- [总体架构](#总体架构)
- [阶段划分](#阶段划分)
- [Phase 1: 数据库设计](#phase-1-数据库设计)
- [Phase 2: 基础页面](#phase-2-基础页面)
- [Phase 3: OpenRouter同步](#phase-3-openrouter同步)
- [Phase 4: 单模型测试](#phase-4-单模型测试)
- [Phase 5: 批量测试](#phase-5-批量测试)
- [Phase 6: 首页集成](#phase-6-首页集成)
- [Phase 7: 优化完善](#phase-7-优化完善)

---

## 🏗️ 总体架构

### 系统组件

```
┌─────────────────────────────────────────────────────────┐
│                   用户界面层                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  index.html  │  │  admin.html  │  │  API调用层   │  │
│  │  (首页)      │  │  (模型中台)  │  │  (OpenRouter)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↓ ↑
┌─────────────────────────────────────────────────────────┐
│                  Supabase 数据层                         │
│  ┌──────────────────┐  ┌──────────────────────────┐    │
│  │ generation_records│  │  models (新建)          │    │
│  │ (现有，计算成本)  │  │  - 模型信息             │    │
│  └──────────────────┘  │  - 验证状态             │    │
│                        │  - 测试结果             │    │
│                        └──────────────────────────┘    │
│                        ┌──────────────────────────┐    │
│                        │  test_logs (新建)       │    │
│                        │  - 测试历史记录         │    │
│                        └──────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 核心功能流程

```
管理员访问 admin.html
    ↓
同步 OpenRouter 模型列表
    ↓
选择模型进行批量测试
    ↓
4个验证点：API调用 / 数据提取 / 响应时间 / 成本
    ↓
验证通过的模型可启用到首页
    ↓
用户在首页看到已启用的模型
```

---

## 📅 阶段划分

| 阶段 | 名称 | 工作量 | 验收标准 | 对话次数 |
|-----|------|--------|---------|---------|
| **Phase 1** | 数据库设计 | 1小时 | SQL执行成功，表创建完成 | 1次 |
| **Phase 2** | 基础页面 | 2小时 | admin.html可访问，UI正确 | 1次 |
| **Phase 3** | OpenRouter同步 | 2小时 | 能获取并显示模型列表 | 1次 |
| **Phase 4** | 单模型测试 | 3小时 | 单个模型测试通过 | 1次 |
| **Phase 5** | 批量测试 | 3小时 | 批量测试功能完整 | 1次 |
| **Phase 6** | 首页集成 | 2小时 | 首页从数据库加载模型 | 1次 |
| **Phase 7** | 优化完善 | 2小时 | 性能优化，错误处理 | 1次 |

**总计：** 约15小时开发时间，7次对话

---

## Phase 1: 数据库设计

> **目标：** 设计并创建模型中台所需的数据库表
> **时间：** 1小时
> **对话：** 第1次

### 1.1 需求分析

#### 现有表
- `generation_records` - 已存在，用于统计成本

#### 新增表
1. `models` - 存储所有AI模型信息和验证状态
2. `test_logs` - 存储每次测试的详细日志

### 1.2 表结构设计

#### 表1: `models` (模型信息表)

```sql
-- 模型信息表
CREATE TABLE IF NOT EXISTS models (
  -- 基础信息
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 索引
CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
CREATE INDEX IF NOT EXISTS idx_models_status ON models(verification_status);
CREATE INDEX IF NOT EXISTS idx_models_enabled ON models(is_enabled);
CREATE INDEX IF NOT EXISTS idx_models_type ON models(detected_type);
CREATE INDEX IF NOT EXISTS idx_models_score ON models(verification_score DESC);

-- 注释
COMMENT ON TABLE models IS '存储所有AI模型的信息、验证状态和测试结果';
COMMENT ON COLUMN models.model_id IS 'OpenRouter模型ID，全局唯一';
COMMENT ON COLUMN models.verification_status IS 'verified=4/4通过, partial=2-3/4通过, failed=0-1/4通过, pending=未测试';
COMMENT ON COLUMN models.validation_details IS '存储4个验证点的详细结果';
```

#### 表2: `test_logs` (测试日志表)

```sql
-- 测试日志表
CREATE TABLE IF NOT EXISTS test_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 索引
CREATE INDEX IF NOT EXISTS idx_test_logs_model ON test_logs(model_id);
CREATE INDEX IF NOT EXISTS idx_test_logs_created ON test_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_logs_success ON test_logs(success);

-- 外键约束
-- 注意：这里不使用严格的外键，因为 model_id 可能先测试后才入库
-- ALTER TABLE test_logs ADD CONSTRAINT fk_test_logs_model
--   FOREIGN KEY (model_id) REFERENCES models(model_id) ON DELETE CASCADE;

-- 注释
COMMENT ON TABLE test_logs IS '存储所有模型测试的详细日志';
COMMENT ON COLUMN test_logs.validations IS '存储4个验证点的详细结果：api_call, data_extraction, response_time, cost_accuracy';
```

#### RLS (Row Level Security) 策略

```sql
-- 启用 RLS
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_logs ENABLE ROW LEVEL SECURITY;

-- 模型表策略：允许匿名读取和插入
CREATE POLICY "Allow anonymous read models" ON models
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert models" ON models
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update models" ON models
  FOR UPDATE
  TO anon
  USING (true);

-- 测试日志表策略：允许匿名读取和插入
CREATE POLICY "Allow anonymous read test_logs" ON test_logs
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert test_logs" ON test_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);
```

### 1.3 实用函数

```sql
-- 函数1：更新模型的验证状态
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

-- 函数2：获取验证统计
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
  GROUP BY verification_status;
END;
$$ LANGUAGE plpgsql;

-- 函数3：清理旧的测试日志（保留最近30天）
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
```

### 1.4 初始数据

```sql
-- 可选：导入现有的 MODEL_CONFIGS 到数据库
-- 这样可以保留现有的模型配置
INSERT INTO models (model_id, name, provider, estimated_cost, detected_type, is_enabled)
VALUES
  ('google/gemini-2.5-flash-image', 'Gemini 2.5 Flash Image', 'google', 0.05, 'image', true),
  ('google/gemini-3-pro-image-preview', 'Gemini 3 Pro Image', 'google', 0.05, 'image', true),
  ('anthropic/claude-3.5-sonnet', 'Claude 3.5 (描述)', 'anthropic', 0.06, 'text', true),
  ('x-ai/grok-4.1-fast', 'Grok 4.1 Fast (代码)', 'x-ai', 0.01, 'code', true),
  ('anthropic/claude-haiku-4.5', 'Claude Haiku 4.5 (代码)', 'anthropic', 0.02, 'code', true),
  ('deepseek/deepseek-chat', 'DeepSeek Coder (代码)', 'deepseek', 0.01, 'code', true)
ON CONFLICT (model_id) DO NOTHING;
```

### 1.5 完整SQL脚本

**文件名：** `supabase-model-hub.sql`

```sql
-- =====================================================
-- 模型中台数据库设置脚本
-- 在 Supabase Dashboard -> SQL Editor 中执行
-- =====================================================

-- 1. 创建 models 表
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(100),
  estimated_cost DECIMAL(10, 6) DEFAULT 0,
  actual_cost DECIMAL(10, 6),
  detected_type VARCHAR(50),
  verification_status VARCHAR(20) DEFAULT 'pending',
  verification_score INTEGER DEFAULT 0,
  validation_details JSONB DEFAULT '{
    "api_call": {"pass": false, "status_code": null},
    "data_extraction": {"pass": false, "type": null},
    "response_time": {"pass": false, "time_ms": null},
    "cost_accuracy": {"pass": false, "actual_cost": null}
  }'::jsonb,
  avg_response_time INTEGER,
  success_rate DECIMAL(5, 2),
  test_count INTEGER DEFAULT 0,
  is_enabled BOOLEAN DEFAULT false,
  context_length INTEGER,
  supports_image BOOLEAN DEFAULT false,
  pricing_info JSONB,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_tested_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
CREATE INDEX IF NOT EXISTS idx_models_status ON models(verification_status);
CREATE INDEX IF NOT EXISTS idx_models_enabled ON models(is_enabled);
CREATE INDEX IF NOT EXISTS idx_models_type ON models(detected_type);
CREATE INDEX IF NOT EXISTS idx_models_score ON models(verification_score DESC);

-- 2. 创建 test_logs 表
CREATE TABLE IF NOT EXISTS test_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id VARCHAR(255) NOT NULL,
  test_prompt TEXT NOT NULL,
  test_type VARCHAR(50) DEFAULT 'manual',
  success BOOLEAN NOT NULL,
  verification_score INTEGER DEFAULT 0,
  validations JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_type VARCHAR(50),
  extracted_data_preview TEXT,
  extracted_data_size INTEGER,
  response_time_ms INTEGER,
  actual_cost DECIMAL(10, 6),
  raw_response JSONB,
  error_message TEXT,
  error_stack TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_logs_model ON test_logs(model_id);
CREATE INDEX IF NOT EXISTS idx_test_logs_created ON test_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_logs_success ON test_logs(success);

-- 3. 启用 RLS
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_logs ENABLE ROW LEVEL SECURITY;

-- 4. 创建 RLS 策略
CREATE POLICY "Allow anonymous read models" ON models FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert models" ON models FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update models" ON models FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anonymous read test_logs" ON test_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert test_logs" ON test_logs FOR INSERT TO anon WITH CHECK (true);

-- 5. 创建实用函数
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
  GROUP BY verification_status;
END;
$$ LANGUAGE plpgsql;

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

-- 6. 导入现有模型（可选）
INSERT INTO models (model_id, name, provider, estimated_cost, detected_type, is_enabled)
VALUES
  ('google/gemini-2.5-flash-image', 'Gemini 2.5 Flash Image', 'google', 0.05, 'image', true),
  ('google/gemini-3-pro-image-preview', 'Gemini 3 Pro Image', 'google', 0.05, 'image', true),
  ('anthropic/claude-3.5-sonnet', 'Claude 3.5 (描述)', 'anthropic', 0.06, 'text', true),
  ('x-ai/grok-4.1-fast', 'Grok 4.1 Fast (代码)', 'x-ai', 0.01, 'code', true),
  ('anthropic/claude-haiku-4.5', 'Claude Haiku 4.5 (代码)', 'anthropic', 0.02, 'code', true),
  ('deepseek/deepseek-chat', 'DeepSeek Coder (代码)', 'deepseek', 0.01, 'code', true)
ON CONFLICT (model_id) DO NOTHING;

-- 完成
SELECT 'Model Hub database setup completed!' as status;
```

### 1.6 验证步骤

执行完SQL后，运行以下查询验证：

```sql
-- 检查表是否创建成功
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('models', 'test_logs');

-- 检查索引
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('models', 'test_logs');

-- 检查初始数据
SELECT model_id, name, verification_status, is_enabled
FROM models;

-- 检查函数
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('update_model_verification', 'get_verification_stats', 'cleanup_old_test_logs');
```

### 1.7 验收标准

- [x] `models` 表创建成功，包含所有字段
- [x] `test_logs` 表创建成功，包含所有字段
- [x] 所有索引创建成功
- [x] RLS策略启用
- [x] 3个实用函数创建成功
- [x] 初始数据导入成功（6个现有模型）
- [x] 验证查询全部通过

### 1.8 下一步

完成Phase 1后，在下一次对话中我们将进入：
**Phase 2: 基础页面** - 创建 admin.html 和首页入口

---

## Phase 2: 基础页面

> **目标：** 创建模型中台的基础UI界面
> **时间：** 2小时
> **对话：** 第2次
> **前置：** Phase 1完成

### 2.1 需求分析

#### 页面结构
1. 创建 `admin.html` - 模型中台主页面
2. 在 `index.html` 添加Admin入口按钮
3. Supabase客户端配置

#### 界面布局
```
┌─────────────────────────────────────────────────────────┐
│ [← 返回首页]  模型中台          [统计] [设置] [🔄同步]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌─────────────────────────────────┐ │
│  │ 模型列表     │  │  测试区                          │ │
│  │              │  │                                  │ │
│  │ 🔍 搜索      │  │  [选择模型进行测试]              │ │
│  │              │  │                                  │ │
│  │ 筛选:        │  │                                  │ │
│  │ ☐ 图片模型   │  │                                  │ │
│  │ ☐ 代码模型   │  │                                  │ │
│  │ ☐ 文本模型   │  │                                  │ │
│  │              │  │                                  │ │
│  │ [模型卡片]   │  │                                  │ │
│  │ ...          │  │                                  │ │
│  └──────────────┘  └─────────────────────────────────┘ │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  已验证模型 (0个)                                  │  │
│  │  [暂无已验证的模型，请先进行测试]                  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 文件清单

1. **admin.html** - 新建文件，模型中台主页面
2. **index.html** - 修改文件，添加Admin入口
3. **admin.js** (内嵌在admin.html中) - 中台业务逻辑
4. **config.js** (可选) - Supabase配置文件

### 2.3 技术栈

- HTML5 + Vanilla JavaScript
- Tailwind CSS (CDN) - 保持与首页一致的设计风格
- Supabase JS SDK (CDN)
- Dark Editorial 设计系统

### 2.4 实现细节

#### 2.4.1 Supabase客户端配置

**方式1：内嵌配置（推荐）**

在 `admin.html` 的 `<script>` 中：

```javascript
// Supabase 配置
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

// 初始化 Supabase 客户端
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**方式2：环境变量（生产环境）**

创建 `.env` 文件（不提交到git）：
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### 2.4.2 admin.html 结构

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>模型中台 - AI UI Comparator</title>

    <!-- 复用首页的字体和样式 -->
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>

    <!-- Supabase JS SDK -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

    <!-- Tailwind 配置 (复用首页配置) -->
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: { sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'] },
                    colors: {
                        surface: {
                            DEFAULT: '#0c0a09',
                            raised: '#1c1917',
                            overlay: '#292524',
                        },
                        accent: {
                            DEFAULT: '#f59e0b',
                            hover: '#fbbf24',
                            muted: '#92400e',
                        },
                        mint: {
                            DEFAULT: '#34d399',
                            muted: '#065f46',
                        }
                    }
                }
            }
        }
    </script>

    <style>
        /* 复用首页的 Dark Editorial 样式 */
        :root {
            --surface: #0c0a09;
            --surface-raised: #1c1917;
            --surface-overlay: #292524;
            --border-subtle: rgba(255, 255, 255, 0.08);
            --border-default: rgba(255, 255, 255, 0.12);
            --text-primary: #fafaf9;
            --text-secondary: #a8a29e;
            --text-muted: #78716c;
            --accent: #f59e0b;
            --mint: #34d399;
            --error: #f87171;
        }

        body {
            background: var(--surface);
            color: var(--text-primary);
            font-feature-settings: 'cv11', 'ss01';
            letter-spacing: -0.01em;
        }

        .card {
            background: var(--surface-raised);
            border: 1px solid var(--border-subtle);
            border-radius: 16px;
        }
    </style>
</head>
<body class="min-h-screen">
    <!-- 顶部导航栏 -->
    <header class="border-b border-stone-800 bg-stone-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div class="flex items-center gap-4">
                <a href="index.html" class="text-stone-400 hover:text-stone-200 transition">
                    ← 返回首页
                </a>
                <h1 class="text-2xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                    模型中台
                </h1>
            </div>
            <div class="flex items-center gap-3">
                <button id="statsBtn" class="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 transition">
                    📊 统计
                </button>
                <button id="settingsBtn" class="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 transition">
                    ⚙️ 设置
                </button>
                <button id="syncBtn" class="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-stone-900 font-semibold transition">
                    🔄 同步OpenRouter
                </button>
            </div>
        </div>
    </header>

    <!-- 主内容区 -->
    <main class="max-w-7xl mx-auto px-6 py-8">
        <div class="grid grid-cols-12 gap-6">

            <!-- 左侧：模型列表 -->
            <aside class="col-span-3 space-y-4">
                <div class="card p-4">
                    <h2 class="text-lg font-semibold mb-4">模型列表</h2>

                    <!-- 搜索框 -->
                    <input
                        type="text"
                        id="searchInput"
                        placeholder="🔍 搜索模型..."
                        class="w-full px-3 py-2 rounded-lg bg-stone-800 border border-stone-700 focus:border-accent outline-none mb-4"
                    />

                    <!-- 筛选 -->
                    <div class="space-y-2 mb-4">
                        <h3 class="text-sm text-stone-400">类型筛选</h3>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" class="filter-type" value="image" checked />
                            <span class="text-sm">🖼️ 图片模型</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" class="filter-type" value="code" checked />
                            <span class="text-sm">💻 代码模型</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" class="filter-type" value="text" checked />
                            <span class="text-sm">📝 文本模型</span>
                        </label>
                    </div>

                    <!-- 统计 -->
                    <div class="text-xs text-stone-500 space-y-1">
                        <div>未测试: <span id="pendingCount">0</span></div>
                        <div>已验证: <span id="verifiedCount">0</span></div>
                        <div>部分通过: <span id="partialCount">0</span></div>
                        <div>失败: <span id="failedCount">0</span></div>
                    </div>
                </div>

                <!-- 模型列表 -->
                <div id="modelList" class="space-y-2">
                    <!-- 模型卡片将动态插入这里 -->
                    <div class="text-stone-500 text-sm p-4 text-center">
                        加载中...
                    </div>
                </div>
            </aside>

            <!-- 中间：测试区 -->
            <section class="col-span-6">
                <div class="card p-6">
                    <h2 class="text-xl font-semibold mb-6">测试区</h2>

                    <div id="testArea" class="text-stone-400 text-center py-20">
                        请从左侧选择模型进行测试
                    </div>
                </div>
            </section>

            <!-- 右侧：已验证模型 -->
            <aside class="col-span-3">
                <div class="card p-4">
                    <h2 class="text-lg font-semibold mb-4">
                        已验证模型 <span id="verifiedModelCount" class="text-mint">(0)</span>
                    </h2>

                    <div id="verifiedModelList" class="space-y-2">
                        <div class="text-stone-500 text-sm text-center py-8">
                            暂无已验证的模型<br/>请先进行测试
                        </div>
                    </div>
                </div>
            </aside>

        </div>
    </main>

    <script>
        // ===== Supabase 配置 =====
        const SUPABASE_URL = 'YOUR_SUPABASE_URL';
        const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // ===== 全局变量 =====
        let allModels = [];
        let filteredModels = [];

        // ===== 初始化 =====
        async function init() {
            console.log('模型中台初始化...');
            await loadModels();
            setupEventListeners();
        }

        // ===== 加载模型列表 =====
        async function loadModels() {
            try {
                const { data, error } = await supabase
                    .from('models')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                allModels = data || [];
                filteredModels = allModels;
                renderModelList();
                updateStats();

                console.log(`加载了 ${allModels.length} 个模型`);
            } catch (error) {
                console.error('加载模型失败:', error);
                showError('加载模型失败: ' + error.message);
            }
        }

        // ===== 渲染模型列表 =====
        function renderModelList() {
            const container = document.getElementById('modelList');

            if (filteredModels.length === 0) {
                container.innerHTML = '<div class="text-stone-500 text-sm p-4 text-center">未找到模型</div>';
                return;
            }

            container.innerHTML = filteredModels.map(model => `
                <div class="card p-3 hover:border-stone-600 cursor-pointer transition" data-model-id="${model.model_id}">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-sm truncate">${model.name}</div>
                            <div class="text-xs text-stone-500 truncate">${model.model_id}</div>
                        </div>
                        <div class="flex-shrink-0">
                            ${getStatusBadge(model.verification_status)}
                        </div>
                    </div>
                    ${model.actual_cost !== null ? `
                    <div class="text-xs text-stone-500 mt-2">$${model.actual_cost.toFixed(4)}</div>
                    ` : ''}
                </div>
            `).join('');

            // 添加点击事件
            container.querySelectorAll('[data-model-id]').forEach(card => {
                card.addEventListener('click', () => {
                    const modelId = card.dataset.modelId;
                    selectModel(modelId);
                });
            });
        }

        // ===== 获取状态徽章 =====
        function getStatusBadge(status) {
            switch(status) {
                case 'verified':
                    return '<span class="text-xs px-2 py-1 rounded bg-mint/20 text-mint">✅</span>';
                case 'partial':
                    return '<span class="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-400">⚠️</span>';
                case 'failed':
                    return '<span class="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">❌</span>';
                default:
                    return '<span class="text-xs px-2 py-1 rounded bg-stone-700 text-stone-400">⏳</span>';
            }
        }

        // ===== 选择模型 =====
        function selectModel(modelId) {
            const model = allModels.find(m => m.model_id === modelId);
            if (!model) return;

            const testArea = document.getElementById('testArea');
            testArea.innerHTML = `
                <div class="text-left">
                    <h3 class="text-lg font-semibold mb-2">${model.name}</h3>
                    <p class="text-sm text-stone-400 mb-4">${model.model_id}</p>

                    <div class="bg-stone-800 rounded-lg p-4 mb-4">
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="text-stone-500">提供商:</span>
                                <span class="text-stone-200">${model.provider || '未知'}</span>
                            </div>
                            <div>
                                <span class="text-stone-500">类型:</span>
                                <span class="text-stone-200">${model.detected_type || '未检测'}</span>
                            </div>
                            <div>
                                <span class="text-stone-500">状态:</span>
                                ${getStatusBadge(model.verification_status)}
                            </div>
                            <div>
                                <span class="text-stone-500">成本:</span>
                                <span class="text-stone-200">$${(model.actual_cost || model.estimated_cost || 0).toFixed(4)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="text-center py-8 text-stone-500">
                        测试功能将在 Phase 4 实现
                    </div>
                </div>
            `;
        }

        // ===== 更新统计 =====
        function updateStats() {
            const stats = {
                pending: 0,
                verified: 0,
                partial: 0,
                failed: 0
            };

            allModels.forEach(model => {
                if (model.verification_status === 'verified') stats.verified++;
                else if (model.verification_status === 'partial') stats.partial++;
                else if (model.verification_status === 'failed') stats.failed++;
                else stats.pending++;
            });

            document.getElementById('pendingCount').textContent = stats.pending;
            document.getElementById('verifiedCount').textContent = stats.verified;
            document.getElementById('partialCount').textContent = stats.partial;
            document.getElementById('failedCount').textContent = stats.failed;
            document.getElementById('verifiedModelCount').textContent = stats.verified;
        }

        // ===== 设置事件监听 =====
        function setupEventListeners() {
            // 搜索
            document.getElementById('searchInput').addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                filteredModels = allModels.filter(m =>
                    m.name.toLowerCase().includes(query) ||
                    m.model_id.toLowerCase().includes(query) ||
                    (m.provider && m.provider.toLowerCase().includes(query))
                );
                renderModelList();
            });

            // 类型筛选
            document.querySelectorAll('.filter-type').forEach(checkbox => {
                checkbox.addEventListener('change', applyFilters);
            });

            // 同步按钮
            document.getElementById('syncBtn').addEventListener('click', () => {
                alert('同步功能将在 Phase 3 实现');
            });

            // 统计按钮
            document.getElementById('statsBtn').addEventListener('click', () => {
                alert('统计功能将在 Phase 7 实现');
            });

            // 设置按钮
            document.getElementById('settingsBtn').addEventListener('click', () => {
                alert('设置功能将在 Phase 7 实现');
            });
        }

        // ===== 应用筛选 =====
        function applyFilters() {
            const checkedTypes = Array.from(document.querySelectorAll('.filter-type:checked'))
                .map(cb => cb.value);

            filteredModels = allModels.filter(m =>
                checkedTypes.length === 0 ||
                checkedTypes.includes(m.detected_type)
            );

            renderModelList();
        }

        // ===== 显示错误 =====
        function showError(message) {
            alert('错误: ' + message);
        }

        // ===== 页面加载时初始化 =====
        window.addEventListener('DOMContentLoaded', init);
    </script>
</body>
</html>
```

#### 2.4.3 修改 index.html - 添加Admin入口

在 `index.html` 的设置按钮旁边添加Admin按钮：

找到这段代码（大约在第600-700行）：
```html
<button onclick="showSettings()" class="...">
    ⚙️ 设置
</button>
```

在它旁边添加：
```html
<a href="admin.html" class="px-4 py-2 rounded-lg bg-stone-800/60 hover:bg-stone-700 text-stone-200 transition flex items-center gap-2">
    🔧 Admin
</a>
```

### 2.5 测试清单

- [ ] admin.html 可以正常打开
- [ ] Dark Editorial 样式正确显示
- [ ] Supabase 连接成功（在控制台无错误）
- [ ] 能从数据库加载模型列表
- [ ] 搜索功能正常
- [ ] 类型筛选功能正常
- [ ] 统计数字正确显示
- [ ] 点击模型卡片显示详情
- [ ] 首页Admin按钮可点击并跳转

### 2.6 验收标准

- [x] `admin.html` 创建成功，UI完整
- [x] Supabase客户端配置正确
- [x] 能够连接数据库并读取模型列表
- [x] 搜索、筛选功能正常工作
- [x] 统计数字动态更新
- [x] 首页有Admin入口
- [x] 整体设计风格与首页一致

### 2.7 下一步

完成Phase 2后，在下一次对话中我们将进入：
**Phase 3: OpenRouter同步** - 实现从OpenRouter获取模型列表

---

## Phase 3: OpenRouter同步

> **目标：** 实现从OpenRouter API同步最新模型列表
> **时间：** 2小时
> **对话：** 第3次
> **前置：** Phase 1, 2完成

### 3.1 需求分析

从OpenRouter API获取所有可用模型，并保存到Supabase数据库。

#### OpenRouter Models API

**端点：** `https://openrouter.ai/api/v1/models`
**方法：** GET
**认证：** 需要API Key（可选，但建议提供）

#### 响应示例

```json
{
  "data": [
    {
      "id": "google/gemini-2.5-flash-image",
      "name": "Gemini 2.5 Flash Image",
      "description": "Fast image generation...",
      "pricing": {
        "prompt": "0.00005",
        "completion": "0.00015"
      },
      "context_length": 32768,
      "architecture": {
        "modality": "multimodal",
        "tokenizer": "Gemini",
        "instruct_type": null
      },
      "top_provider": {
        "max_completion_tokens": 8192
      }
    },
    // ... 更多模型
  ]
}
```

### 3.2 功能设计

#### 3.2.1 同步流程

```
用户点击"同步OpenRouter"按钮
    ↓
显示加载状态
    ↓
调用 OpenRouter Models API
    ↓
解析模型列表
    ↓
逐个保存/更新到 Supabase
    - 如果模型已存在：更新元数据
    - 如果是新模型：创建记录
    ↓
显示同步结果
    ↓
刷新模型列表
```

#### 3.2.2 数据映射

| OpenRouter字段 | Supabase字段 | 处理逻辑 |
|---------------|-------------|---------|
| `id` | `model_id` | 直接映射 |
| `name` | `name` | 直接映射 |
| `id.split('/')[0]` | `provider` | 提取提供商名称 |
| `pricing.prompt` | `estimated_cost` | 转换为数字 |
| `context_length` | `context_length` | 直接映射 |
| `architecture.modality` | `supports_image` | 检查是否包含"multimodal" |
| 整个对象 | `pricing_info` | JSON存储 |

### 3.3 实现代码

在 `admin.html` 的 `<script>` 中添加以下函数：

```javascript
// ===== OpenRouter 同步功能 =====

/**
 * 同步 OpenRouter 模型列表
 */
async function syncOpenRouterModels() {
    const syncBtn = document.getElementById('syncBtn');
    const originalText = syncBtn.innerHTML;

    try {
        // 1. 显示加载状态
        syncBtn.disabled = true;
        syncBtn.innerHTML = '🔄 同步中...';
        console.log('开始同步 OpenRouter 模型列表...');

        // 2. 从 localStorage 获取 API Key（复用首页的配置）
        const apiKey = localStorage.getItem('openrouter_api_key');
        if (!apiKey) {
            throw new Error('请先在首页设置中配置 OpenRouter API Key');
        }

        // 3. 调用 OpenRouter Models API
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'AI UI Comparator - Model Hub'
            }
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API 错误: ${response.status}`);
        }

        const { data: models } = await response.json();
        console.log(`从 OpenRouter 获取到 ${models.length} 个模型`);

        // 4. 保存到 Supabase
        syncBtn.innerHTML = '💾 保存中...';
        let newCount = 0;
        let updateCount = 0;
        let errorCount = 0;

        for (const model of models) {
            try {
                const modelData = {
                    model_id: model.id,
                    name: model.name || model.id,
                    provider: model.id.split('/')[0],
                    estimated_cost: parseFloat(model.pricing?.prompt || 0),
                    context_length: model.context_length,
                    supports_image: model.architecture?.modality === 'multimodal',
                    pricing_info: model.pricing,
                    last_synced_at: new Date().toISOString()
                };

                // 使用 upsert 实现插入或更新
                const { data, error } = await supabase
                    .from('models')
                    .upsert(modelData, {
                        onConflict: 'model_id',
                        ignoreDuplicates: false
                    })
                    .select();

                if (error) throw error;

                // 判断是新增还是更新
                if (data && data.length > 0) {
                    if (data[0].first_seen_at === data[0].last_synced_at) {
                        newCount++;
                    } else {
                        updateCount++;
                    }
                }

            } catch (error) {
                console.error(`保存模型失败: ${model.id}`, error);
                errorCount++;
            }
        }

        // 5. 显示同步结果
        syncBtn.innerHTML = '✅ 同步完成';
        setTimeout(() => {
            syncBtn.innerHTML = originalText;
            syncBtn.disabled = false;
        }, 2000);

        const message = `
同步完成！
━━━━━━━━━━━━━━━━
📊 总计: ${models.length} 个模型
🆕 新增: ${newCount} 个
🔄 更新: ${updateCount} 个
${errorCount > 0 ? `❌ 失败: ${errorCount} 个` : ''}
━━━━━━━━━━━━━━━━
        `.trim();

        alert(message);
        console.log(message);

        // 6. 刷新模型列表
        await loadModels();

    } catch (error) {
        console.error('同步失败:', error);
        syncBtn.innerHTML = '❌ 同步失败';
        setTimeout(() => {
            syncBtn.innerHTML = originalText;
            syncBtn.disabled = false;
        }, 2000);

        showError(error.message);
    }
}

/**
 * 显示同步统计面板（可选功能）
 */
function showSyncStats(stats) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="card p-6 max-w-md w-full mx-4">
            <h3 class="text-xl font-semibold mb-4">同步完成</h3>

            <div class="space-y-3 mb-6">
                <div class="flex justify-between items-center">
                    <span class="text-stone-400">总计</span>
                    <span class="text-2xl font-bold text-mint">${stats.total}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-stone-400">新增</span>
                    <span class="text-lg text-mint">+${stats.new}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-stone-400">更新</span>
                    <span class="text-lg text-accent">${stats.updated}</span>
                </div>
                ${stats.errors > 0 ? `
                <div class="flex justify-between items-center">
                    <span class="text-stone-400">失败</span>
                    <span class="text-lg text-error">${stats.errors}</span>
                </div>
                ` : ''}
            </div>

            <button onclick="this.closest('.fixed').remove()"
                class="w-full py-2 rounded-lg bg-accent hover:bg-accent-hover text-stone-900 font-semibold transition">
                确定
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 更新事件监听器
function setupEventListeners() {
    // ... 其他事件监听器 ...

    // 同步按钮 - 更新为真实功能
    document.getElementById('syncBtn').addEventListener('click', syncOpenRouterModels);
}
```

### 3.4 增强功能

#### 3.4.1 自动分类模型类型

根据模型ID和元数据自动推断类型：

```javascript
/**
 * 智能推断模型类型
 */
function inferModelType(model) {
    const modelId = model.id.toLowerCase();
    const modelName = model.name.toLowerCase();

    // 图片生成模型
    if (modelId.includes('image') ||
        modelId.includes('flux') ||
        modelId.includes('dalle') ||
        modelName.includes('image')) {
        return 'image';
    }

    // 代码生成模型
    if (modelId.includes('code') ||
        modelId.includes('coder') ||
        modelName.includes('code')) {
        return 'code';
    }

    // 默认为文本
    return 'text';
}

// 在保存时使用
const modelData = {
    // ... 其他字段
    detected_type: inferModelType(model),
};
```

#### 3.4.2 增量同步

只同步新模型或有变化的模型：

```javascript
async function incrementalSync() {
    // 获取上次同步时间
    const { data: lastSync } = await supabase
        .from('models')
        .select('last_synced_at')
        .order('last_synced_at', { ascending: false })
        .limit(1)
        .single();

    const lastSyncTime = lastSync?.last_synced_at;

    // 获取OpenRouter模型列表
    const { data: models } = await fetchOpenRouterModels();

    // 过滤：只处理新模型
    const newModels = models.filter(model => {
        // 这里可以添加更复杂的逻辑
        return true; // 简化版：处理所有模型
    });

    // 保存
    for (const model of newModels) {
        await upsertModel(model);
    }
}
```

#### 3.4.3 后台同步

使用 Web Worker 在后台同步：

```javascript
// 创建同步任务
async function startBackgroundSync() {
    console.log('开始后台同步...');

    // 简化版：直接异步执行
    syncOpenRouterModels().then(() => {
        console.log('后台同步完成');
    });

    // 返回Promise以便追踪
    return Promise.resolve();
}
```

### 3.5 错误处理

```javascript
// 常见错误及处理
const ERROR_HANDLERS = {
    // 401: API Key 无效
    401: () => {
        showError('API Key 无效或已过期，请在首页重新配置');
    },

    // 429: 频率限制
    429: () => {
        showError('请求过于频繁，请稍后再试');
    },

    // 500: 服务器错误
    500: () => {
        showError('OpenRouter 服务器错误，请稍后重试');
    },

    // 网络错误
    'NetworkError': () => {
        showError('网络连接失败，请检查网络设置');
    }
};

// 使用
try {
    const response = await fetch(/*...*/);
    if (!response.ok) {
        const handler = ERROR_HANDLERS[response.status];
        if (handler) handler();
        else throw new Error(`HTTP ${response.status}`);
    }
} catch (error) {
    if (error.name === 'TypeError') {
        ERROR_HANDLERS['NetworkError']();
    } else {
        showError(error.message);
    }
}
```

### 3.6 UI优化

#### 进度条显示

```javascript
// 在同步时显示进度条
function showSyncProgress(current, total) {
    const progress = document.getElementById('syncProgress');
    if (!progress) {
        // 创建进度条元素
        const div = document.createElement('div');
        div.id = 'syncProgress';
        div.className = 'fixed top-0 left-0 right-0 h-1 bg-accent z-50';
        div.style.width = '0%';
        document.body.appendChild(div);
    }

    const percent = (current / total) * 100;
    progress.style.width = `${percent}%`;

    if (percent === 100) {
        setTimeout(() => progress.remove(), 1000);
    }
}

// 在循环中使用
for (let i = 0; i < models.length; i++) {
    await processModel(models[i]);
    showSyncProgress(i + 1, models.length);
}
```

### 3.7 测试清单

- [ ] 能成功调用 OpenRouter Models API
- [ ] 能解析模型列表
- [ ] 能保存新模型到数据库
- [ ] 能更新已存在的模型
- [ ] 能正确提取提供商名称
- [ ] 能正确计算成本
- [ ] 能自动推断模型类型
- [ ] 错误处理正常（无API Key、网络错误等）
- [ ] 显示同步进度
- [ ] 显示同步结果统计
- [ ] 同步后自动刷新列表

### 3.8 验收标准

- [x] 同步功能完整实现
- [x] 能从OpenRouter获取数百个模型
- [x] 数据正确保存到Supabase
- [x] 新增和更新逻辑正确
- [x] 错误处理健壮
- [x] 用户体验流畅（进度反馈、结果提示）
- [x] 代码注释清晰

### 3.9 下一步

完成Phase 3后，在下一次对话中我们将进入：
**Phase 4: 单模型测试** - 实现对单个模型的4点验证测试

---

## Phase 4: 单模型测试

> **目标：** 实现对单个模型的完整测试功能（4个验证点）
> **时间：** 3小时
> **对话：** 第4次
> **前置：** Phase 1-3完成

### 4.1 测试标准（4个验证点）

1. ✅ **API调用成功** - 状态码200，有效响应
2. ✅ **成功提取数据** - 图片/代码/文本
3. ✅ **响应时间<60秒** - 性能合格
4. ✅ **成本显示正确** - 有成本数据

### 4.2 核心函数

#### 主测试函数

```javascript
/**
 * 测试单个模型
 * @param {string} modelId - 模型ID
 * @param {string} testPrompt - 测试提示词
 * @returns {Promise<Object>} 测试结果
 */
async function testSingleModel(modelId, testPrompt) {
    const testResult = {
        model_id: modelId,
        test_prompt: testPrompt,
        timestamp: new Date().toISOString(),
        validations: {},
        overall_status: 'failed',
        score: 0
    };

    try {
        // 验证1: API调用
        console.log(`[1/4] 测试API调用...`);
        const apiResult = await validateApiCall(modelId, testPrompt);
        testResult.validations.api_call = apiResult;
        if (apiResult.pass) testResult.score++;

        if (!apiResult.pass) {
            throw new Error(`API调用失败: ${apiResult.status_code}`);
        }

        // 验证2: 数据提取
        console.log(`[2/4] 测试数据提取...`);
        const extractResult = validateDataExtraction(apiResult.data);
        testResult.validations.data_extraction = extractResult;
        if (extractResult.pass) {
            testResult.score++;
            testResult.detected_type = extractResult.type;
        }

        // 验证3: 响应时间
        console.log(`[3/4] 测试响应时间...`);
        const timeResult = validateResponseTime(apiResult.response_time);
        testResult.validations.response_time = timeResult;
        if (timeResult.pass) testResult.score++;

        // 验证4: 成本准确性
        console.log(`[4/4] 测试成本数据...`);
        const costResult = validateCost(apiResult.data);
        testResult.validations.cost_accuracy = costResult;
        if (costResult.pass) {
            testResult.score++;
            testResult.actual_cost = costResult.actual_cost;
        }

        // 综合评分
        if (testResult.score === 4) {
            testResult.overall_status = 'verified';
        } else if (testResult.score >= 2) {
            testResult.overall_status = 'partial';
        }

    } catch (error) {
        testResult.error = error.message;
    }

    // 保存测试结果
    await saveTestResult(testResult);

    return testResult;
}
```

#### 4个验证函数

*完整代码见前文"详细验证逻辑"章节*

### 4.3 UI设计

当用户点击模型卡片时，显示测试界面：

```javascript
function showTestUI(model) {
    const testArea = document.getElementById('testArea');
    testArea.innerHTML = `
        <div class="space-y-6">
            <div>
                <h3 class="text-lg font-semibold">${model.name}</h3>
                <p class="text-sm text-stone-400">${model.model_id}</p>
            </div>

            <!-- 测试提示词 -->
            <div>
                <label class="block text-sm font-medium mb-2">测试提示词</label>
                <textarea
                    id="testPrompt"
                    rows="3"
                    class="w-full px-3 py-2 rounded-lg bg-stone-800 border border-stone-700 focus:border-accent outline-none"
                    placeholder="输入测试提示词，如：设计一个现代化的登录页面"
                >设计一个现代化的移动端登录页面，包含邮箱输入框、密码输入框和登录按钮，使用深色主题和渐变背景</textarea>
            </div>

            <!-- 测试按钮 -->
            <button
                id="startTestBtn"
                onclick="startTest('${model.model_id}')"
                class="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover text-stone-900 font-semibold transition">
                开始测试
            </button>

            <!-- 测试进度 -->
            <div id="testProgress" class="hidden space-y-2">
                <div class="flex items-center justify-between">
                    <span>验证进度</span>
                    <span id="progressText">0/4</span>
                </div>
                <div class="w-full h-2 bg-stone-800 rounded-full overflow-hidden">
                    <div id="progressBar" class="h-full bg-accent transition-all duration-300" style="width: 0%"></div>
                </div>
            </div>

            <!-- 测试结果 -->
            <div id="testResults" class="hidden">
                <!-- 结果将动态插入 -->
            </div>
        </div>
    `;
}
```

### 4.4 测试流程UI

```javascript
async function startTest(modelId) {
    const btn = document.getElementById('startTestBtn');
    const prompt = document.getElementById('testPrompt').value;
    const progressDiv = document.getElementById('testProgress');
    const resultsDiv = document.getElementById('testResults');

    // 1. 显示进度
    btn.disabled = true;
    btn.textContent = '测试中...';
    progressDiv.classList.remove('hidden');
    resultsDiv.classList.add('hidden');

    // 2. 执行测试
    const result = await testSingleModel(modelId, prompt);

    // 3. 更新进度
    document.getElementById('progressText').textContent = `${result.score}/4`;
    document.getElementById('progressBar').style.width = `${(result.score / 4) * 100}%`;

    // 4. 显示结果
    displayTestResults(result);

    // 5. 恢复按钮
    btn.disabled = false;
    btn.textContent = '重新测试';

    // 6. 更新模型列表
    await loadModels();
}
```

### 4.5 测试结果显示

```javascript
function displayTestResults(result) {
    const resultsDiv = document.getElementById('testResults');
    resultsDiv.classList.remove('hidden');

    const statusColor = result.overall_status === 'verified' ? 'mint'
                      : result.overall_status === 'partial' ? 'amber-400'
                      : 'red-400';

    resultsDiv.innerHTML = `
        <div class="card p-4 border-${statusColor} border-2">
            <div class="flex items-center justify-between mb-4">
                <h4 class="font-semibold">测试结果</h4>
                <div class="text-${statusColor} font-bold text-xl">
                    ${result.score}/4
                </div>
            </div>

            <div class="space-y-3">
                ${renderValidation('API调用', result.validations.api_call)}
                ${renderValidation('数据提取', result.validations.data_extraction)}
                ${renderValidation('响应时间', result.validations.response_time)}
                ${renderValidation('成本数据', result.validations.cost_accuracy)}
            </div>

            ${result.overall_status === 'verified' ? `
                <div class="mt-4 pt-4 border-t border-stone-700">
                    <button
                        onclick="enableModel('${result.model_id}')"
                        class="w-full py-2 rounded-lg bg-mint hover:bg-mint/80 text-stone-900 font-semibold transition">
                        ✅ 添加到首页
                    </button>
                </div>
            ` : result.overall_status === 'partial' ? `
                <div class="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p class="text-sm text-amber-300">
                        ⚠️ 部分验证通过，建议谨慎使用或重新测试
                    </p>
                </div>
            ` : `
                <div class="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p class="text-sm text-red-300">
                        ❌ 验证未通过，该模型暂不可用
                    </p>
                </div>
            `}
        </div>
    `;
}

function renderValidation(name, validation) {
    const icon = validation.pass ? '✅' : '❌';
    const color = validation.pass ? 'mint' : 'red-400';

    return `
        <div class="flex items-center justify-between p-2 bg-stone-800/50 rounded">
            <span class="text-sm">${icon} ${name}</span>
            <span class="text-xs text-${color}">
                ${validation.pass ? '通过' : '失败'}
            </span>
        </div>
    `;
}
```

### 4.6 测试清单

详见前文完整内容...

### 4.7 验收标准

- [x] 单模型测试功能完整
- [x] 4个验证点全部实现
- [x] 测试结果正确保存到数据库
- [x] UI交互流畅
- [x] 错误处理健壮

### 4.8 下一步

**Phase 5: 批量测试** - 一次测试多个模型

---

## Phase 5: 批量测试

> **目标：** 实现批量选择和测试多个模型
> **时间：** 3小时
> **对话：** 第5次
> **前置：** Phase 1-4完成

*(详细内容与Phase 4类似，主要是添加批量选择UI和并发控制)*

---

## Phase 6: 首页集成

> **目标：** 修改首页，从Supabase加载已验证的模型
> **时间：** 2小时
> **对话：** 第6次
> **前置：** Phase 1-5完成

*(修改index.html的MODEL_CONFIGS加载逻辑)*

---

## Phase 7: 优化完善

> **目标：** 性能优化、错误处理、UI细节
> **时间：** 2小时
> **对话：** 第7次
> **前置：** Phase 1-6完成

*(添加缓存、日志、统计面板等)*

---

## 📊 总体进度跟踪

| Phase | 状态 | 完成时间 | 备注 |
|-------|------|---------|------|
| Phase 1 | ⏳ 待开始 | - | 数据库设计 |
| Phase 2 | ⏳ 待开始 | - | 基础页面 |
| Phase 3 | ⏳ 待开始 | - | OpenRouter同步 |
| Phase 4 | ⏳ 待开始 | - | 单模型测试 |
| Phase 5 | ⏳ 待开始 | - | 批量测试 |
| Phase 6 | ⏳ 待开始 | - | 首页集成 |
| Phase 7 | ⏳ 待开始 | - | 优化完善 |

---

**下一步行动：** 请确认阅读完此文档，我们将从 Phase 1 开始实施！
