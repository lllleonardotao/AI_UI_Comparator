# 全站统计数据功能说明

## 功能概述

现在系统支持全站统计数据（不分用户），可以统计所有使用网站的用户的花费数据。

## 工作流程

1. **数据保存**：每次生成完成后，数据会自动保存到：
   - 本地：`localStorage`（用户自己的历史记录）
   - 服务器：通过 `/api/stats` API 保存（全站统计数据）

2. **数据展示**：
   - 历史记录弹窗中的"花费明细统计"会优先显示**全站统计数据**
   - 如果服务器数据不可用，则显示本地统计数据

## 配置存储（可选）

### 方案一：使用 Supabase（推荐）

1. 注册 [Supabase](https://supabase.com/)（免费层足够使用）
2. 创建一个新项目
3. 在 Supabase Dashboard -> SQL Editor 中执行 `supabase-setup.sql` 文件中的 SQL 语句创建表
4. 在 Vercel 项目设置中添加环境变量：
   - `SUPABASE_URL`：你的 Supabase 项目 URL（在 Settings -> API 中可以找到）
   - `SUPABASE_ANON_KEY`：你的 Supabase Anon Key（在 Settings -> API 中可以找到）

### 方案二：不配置（开发/测试用）

如果不配置 Supabase，系统会使用内存存储（仅限当前实例，重启后数据会丢失）。这对于开发测试足够，但不适合生产环境。

## API 端点

- `POST /api/stats`：保存生成记录
  ```json
  {
    "results": [
      {
        "modelName": "Gemini 3 Pro Image",
        "cost": 0.05,
        "isError": false
      }
    ],
    "totalCost": 0.05
  }
  ```

- `GET /api/stats`：获取全站统计数据
  ```json
  {
    "grandTotal": 10.5,
    "totalGenerations": 150,
    "grandAverage": 0.07,
    "modelStats": [
      {
        "modelName": "Gemini 3 Pro Image",
        "totalCost": 5.0,
        "count": 100,
        "averageCost": 0.05
      }
    ],
    "totalRecords": 50
  }
  ```

## 注意事项

1. **隐私**：统计数据不包含用户的 prompt、图片等敏感信息，只包含模型名称和花费
2. **性能**：系统最多统计最近 1000 条记录，超出部分不会影响统计
3. **回退机制**：如果服务器保存失败，不会影响本地功能，只会在控制台输出警告

