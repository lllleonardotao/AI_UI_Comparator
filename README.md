# AI UI Comparator

> 多模型 UI 设计对比生成器 — 输入一段需求描述，同时调用多个 AI 模型生成界面，横向对比效果。

## 功能简介

- **多模型并发生成**：同时调用 8 个 AI 模型（代码生成 + 图片生成）
- **代码生成**：DeepSeek V3.1、Qwen3 Coder、Grok 4.1 Fast、Claude Haiku 4.5、Claude Sonnet 4.6
- **图片生成**：Gemini 3.1 Flash Image、Gemini 2.5 Flash Image、Gemini 3 Pro Image
- **提示词优化**：一键 AI 扩写，单页聚焦，风格精准
- **参考图上传**：支持上传参考图片辅助生成
- **历史记录**：本地保存每次生成结果（缩略图 + 成本统计）

## 快速启动（本地）

```bash
# 1. 安装依赖
npm install

# 2. 配置 API Key
echo "OPENROUTER_API_KEY=sk-or-v1-xxx" > .env

# 3. 启动服务
node server.js
# → 访问 http://localhost:3000
```

## 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 在 Vercel 项目设置 → Environment Variables 中添加：
   ```
   OPENROUTER_API_KEY=sk-or-v1-your-actual-api-key-here
   ```
4. 部署即可 — API Key 保存在服务器端，不会暴露给前端

## 统计数据（可选）

每次生成后，花费数据会通过 `/api/stats` 上报到服务器端做全站统计（不含 prompt 等敏感信息）。

如需持久化存储，可接入 Supabase：
- 在 Vercel 添加 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
- 不配置则使用内存存储（重启后丢失），不影响本地功能

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 纯 HTML + Tailwind CSS + Vanilla JS |
| 后端 | Node.js + Express |
| AI 接入 | OpenRouter API |
| 截图 | Puppeteer（代码转图片）|
| 图片占位 | loremflickr.com（按场景关键词）|

## 项目文档

| 文件 | 说明 |
|------|------|
| [PROJECT_MAP.md](./PROJECT_MAP.md) | 文件结构 + 核心数据流 + 模型列表 |
| [TODO.md](./TODO.md) | 待办 + 已完成任务 |
| [SESSION.md](./SESSION.md) | 当前进度 + 已知问题 |
| [PRD.md](./PRD.md) | 完整产品需求文档 |
