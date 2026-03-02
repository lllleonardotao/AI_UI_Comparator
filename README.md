# AI UI Comparator

> 多模型 UI 设计对比生成器 — 输入一段需求描述，同时调用多个 AI 模型生成界面，横向对比效果。

## 功能简介

- **多模型并发生成**：同时调用 8 个 AI 模型（代码生成 + 图片生成）
- **代码生成**：DeepSeek V3.1、Qwen3 Coder、Grok 4.1 Fast、Claude Haiku 4.5、Claude Sonnet 4.6
- **图片生成**：Gemini 3.1 Flash Image、Gemini 2.5 Flash Image、Gemini 3 Pro Image
- **提示词优化**：一键 AI 扩写，单页聚焦，风格精准
- **参考图上传**：支持上传参考图片辅助生成
- **历史记录**：本地保存每次生成结果（缩略图 + 成本统计）
- **图片操作**：复制图片 / 下载图片，所有卡片和模态框统一

## 快速启动

```bash
# 安装依赖
npm install

# 配置 API Key（复制 .env.example 并填入 OpenRouter API Key）
cp .env.example .env

# 启动本地服务
node server.js
# → 访问 http://localhost:3000
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 纯 HTML + Tailwind CSS + Vanilla JS |
| 后端 | Node.js + Express |
| AI 接入 | OpenRouter API |
| 截图 | Puppeteer（代码转图片） |
| 图片占位 | loremflickr.com（按场景关键词） |

## 目录结构

详见 → [PROJECT_MAP.md](./PROJECT_MAP.md)

## 当前任务

详见 → [TODO.md](./TODO.md)

## 本次会话进度

详见 → [SESSION.md](./SESSION.md)
