# PROJECT MAP — AI UI Comparator

## 文件结构

```
AI_UI_Comparator-1/
│
├── index.html                    ← 主应用（全部前端逻辑，约 5000 行）
│   ├── MODEL_CONFIGS             ← 8 个模型配置（名称/类型/成本/模型ID）
│   ├── startGeneration()         ← 并发生成入口
│   ├── generateWithModel()       ← 单模型生成调度
│   ├── generateCode()            ← 代码生成（HTML/CSS/JS）
│   ├── generateImage()           ← 图片生成（Gemini 系列）
│   ├── optimizePrompt()          ← AI 提示词扩写（DeepSeek）
│   ├── updateResultCard()        ← 结果卡片渲染
│   ├── saveGenerationHistory()   ← 历史记录存储（localStorage）
│   └── showImageModal()          ← 图片预览模态框
│
├── server.js                     ← Node.js 服务器
│   ├── GET  /                    ← 提供 index.html
│   ├── POST /api/screenshot      ← Puppeteer 截图（代码→图片）
│   └── POST /api/stats           ← 全站成本统计写入
│
├── admin.html                    ← 模型中台管理页（已从导航隐藏）
│
├── api/                          ← 服务端 API 模块
│
├── docs/                         ← 文档目录
│
├── .env                          ← OPENROUTER_API_KEY（不入 git）
├── .gitignore
├── package.json
└── node_modules/
```

## 核心数据流

```
用户输入 prompt
    ↓
[可选] optimizePrompt() → DeepSeek 扩写 → 替换 textarea
    ↓
startGeneration()
    ↓ 并发（MAX_CONCURRENT = 3，批次间延迟）
generateWithModel(modelKey)
    ├── type:'code'  → generateCode()  → POST /api/screenshot → 展示 iframe + 生成截图
    └── type:'image' → generateImage() → Gemini API → 展示 base64 图片
    ↓
updateResultCard() → 渲染卡片（排队→生成中→结果）
    ↓
saveGenerationHistory() → 生成缩略图 → 写入 localStorage（只存缩略图，防溢出）
```

## 模型列表（当前 8 个）

| 模型名 | 类型 | 参考成本 |
|--------|------|---------|
| DeepSeek V3.1 | 代码 | $0.01 |
| Qwen3 Coder | 代码 | $0.01 |
| Grok 4.1 Fast | 代码 | $0.01 |
| Claude Haiku 4.5 | 代码 | $0.03 |
| Claude Sonnet 4.6 | 代码 | $0.08 |
| Gemini 3.1 Flash Image | 图片 | $0.04 |
| Gemini 2.5 Flash Image | 图片 | $0.07 |
| Gemini 3 Pro Image | 图片 | $0.13 |
