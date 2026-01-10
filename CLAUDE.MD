# AI UI设计对比工具 - Claude上下文文件

本文件为AI助手提供项目上下文信息。

---

## 项目概览

**名称：** AI UI Design Comparator
**类型：** 基于Web的AI生成UI设计对比工具
**当前阶段：** Phase 0（MVP开发中）
**技术栈：** 单页面HTML应用 + Node.js开发服务器
**主要用户：** Tao（产品设计师，追求全栈能力）

### 核心目标
同时对比多个AI模型的UI设计输出，以实现：
- 并排评估不同AI图像生成模型
- 降低成本（比单独调用API便宜99%）
- 加速UI设计迭代工作流

---

## 项目架构

### 当前实现（Phase 0）
```
├── index.html          # 单页面应用（主工具）
├── server.js           # 本地开发服务器（API代理）
├── package.json        # Node.js依赖
├── .env               # API密钥（不在仓库中，用户自行配置）
└── PROJECT-STATE-*.md # 详细项目文档
```

### 技术栈
- **前端：** 纯HTML5 + Vanilla JavaScript + Tailwind CSS（CDN）
- **后端：** Node.js + Express（开发代理服务器）
- **API：** OpenRouter.ai（多AI模型统一网关）
- **存储：** localStorage（API密钥、自定义模型、设置）

### 设计系统
- **主题：** Dark Editorial（深色编辑风格）+ 琥珀金色强调
- **配色：**
  - 背景：深墨色（`#0c0a09`）
  - 强调色：琥珀金（`#f59e0b`）
  - 成功色：薄荷绿（`#34d399`）
- **字体：** Plus Jakarta Sans
- **风格：** 精致、宽松间距、微妙温暖感

---

## 核心功能

### 已实现（v1.0）
- ✅ 多模型AI图像生成对比
- ✅ OpenRouter API集成
- ✅ 自定义模型管理（用户可添加自己的模型）
- ✅ 快速模板（登录页、仪表盘、个人中心）
- ✅ 实时成本估算
- ✅ 进度跟踪
- ✅ 失败重试功能
- ✅ localStorage持久化

### 默认模型
```javascript
- Gemini Image（免费）- 主要测试模型
- Flux Pro（$0.05）
- GPT-5 Image（$0.04）
- Claude 3.5（$0.01，用于描述生成）
```

---

## 关键上下文

### 已知问题
1. **图片显示问题（阻塞中）：**
   - API成功返回base64图片数据 ✅
   - 数据解析正常 ✅
   - 浏览器无法渲染图片（403或加载失败）❌
   - v1.0尝试纯DOM操作修复
   - 状态：调查中

2. **GPT-5 Provider错误：** 可能与余额/权限有关

### 重要约束
- ⚠️ **API密钥不在文件中** - 用户必须通过UI配置
- ⚠️ **单文件架构** - 所有UI代码在一个HTML文件中
- ⚠️ **无构建过程** - 直接浏览器执行
- ⚠️ **仅localStorage** - Phase 0无数据库

---

## 开发指南

### 在此项目上工作时

1. **始终先阅读：**
   - 阅读PROJECT-STATE-*.md了解最新状态
   - 检查index.html了解当前实现
   - 查看server.js了解API代理逻辑

2. **尊重约束：**
   - Phase 0保持单文件架构
   - 除非关键否则不添加新依赖
   - 保持与纯HTML/JS/CSS的兼容性

3. **测试清单：**
   - 验证API密钥配置仍正常工作
   - 优先使用免费Gemini模型测试（避免成本）
   - 检查localStorage持久化
   - 确认错误消息用户友好

4. **代码风格：**
   - 使用清晰、描述性的变量名
   - 添加console.log用于调试（稍后可删除）
   - 保持函数专注且小巧
   - 为复杂逻辑添加注释

### 设计偏好
- Dark Editorial美学（琥珀金强调色、深色背景）
- 宽松间距、精致排版
- 避免过度工程化或过早抽象
- 专注于即时用户需求

---

## 成本考虑

### 当前每次生成成本（4个模型）
```
Gemini:  $0.00（免费）
GPT-5:   $0.04
Flux:    $0.05
Claude:  $0.01
────────────────
总计:    $0.10/次生成
```

### 测试策略
- 使用Gemini（免费）进行开发/测试
- 仅使用付费模型进行最终验证
- 在昂贵操作前警告用户

---

## API集成

### OpenRouter配置
- **端点：** `https://openrouter.ai/api/v1/chat/completions`
- **认证：** Bearer token（存储在localStorage）
- **代理：** 本地server.js用于开发（绕过CORS）

### 请求格式
```javascript
{
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk-or-v1-xxxxx',
    'Content-Type': 'application/json',
    'HTTP-Referer': window.location.href,
    'X-Title': 'AI UI Design Comparator'
  },
  body: JSON.stringify({
    model: 'model-id',
    messages: [...],
    // 图像生成的modalities参数
  })
}
```

---

## 文件结构与文档

### 重要文件
- `index.html` - 主应用程序（所有UI代码）
- `server.js` - 开发服务器与API代理
- `PROJECT-STATE-*.md` - 详细项目历史和状态
- `README-DEPLOY.md` - 部署说明
- `README-STATS.md` - 统计和分析

### 版本历史
- v0.1 - 初始部署
- v0.2 - 视觉修复（文字对比度）
- v0.3 - API端点修复
- v0.4 - 模型ID更正
- v0.5 - 自定义模型管理
- v0.6-v0.9 - 图片调试尝试
- v1.0 - 纯JS渲染（当前版本）

---

## 未来计划（Phase 1）

### 计划增强功能
1. **模型适配器层** - 为不同AI模型提供统一接口
2. **后端服务** - Node.js + Express + PostgreSQL
3. **前端重写** - React + Zustand状态管理
4. **功能：**
   - 历史记录跟踪
   - 批量生成
   - 自定义提示词模板
   - 团队协作
   - 版本控制

### 暂未规划
- 移动应用
- 用户认证（Phase 1）
- 数据库存储（Phase 1）
- 高级分析

---

## 常见任务

### 添加新模型
1. 打开设置（UI中的⚙️按钮）
2. 点击"添加自定义模型"
3. 输入模型ID（从OpenRouter文档获取）
4. 输入显示名称和预估成本
5. 保存到localStorage

### 调试图片问题
1. 检查浏览器控制台日志
2. 验证API响应结构
3. 检查base64数据格式
4. 用不同模型测试
5. 检查CORS和内容安全策略

### 本地运行
```bash
# 安装依赖
npm install

# 创建.env文件
echo "OPENROUTER_API_KEY=sk-or-v1-your-key" > .env

# 启动服务器
npm start

# 打开浏览器
http://localhost:3000
```

---

## 用户体验笔记

### 用户反馈模式
- "文字看不清" → 立即调整对比度
- "想添加自己的模型" → 实现自定义模型功能
- "失败结果消失了" → 保留失败状态

### 设计哲学
1. 快速迭代优于完美
2. 用户反馈驱动开发
3. 提前沟通技术决策
4. 保持简单（不过度工程化）

---

## 与用户（Tao）的沟通

### 偏好
- 直接、技术性沟通
- 尽早展示代码/实现选项
- 清晰解释权衡
- 除非被问否则不提供时间估算

### 上下文意识
- Tao使用多台电脑
- API密钥需要在每台机器上重新配置
- 欣赏主动建议
- 重视学习机会

---

## 紧急联系与资源

### 文档链接
- OpenRouter API: https://openrouter.ai/docs
- Tailwind CSS: https://tailwindcss.com/docs
- MDN Web文档: https://developer.mozilla.org

### 项目状态文件
- 查看`PROJECT-STATE-*.md`了解最新状态
- 检查提交历史了解最近更改
- 查看控制台日志了解运行时问题

---

## 快速参考

### 基本命令
```bash
# 启动开发服务器
npm start

# 检查API密钥（遮罩显示）
node -e "require('dotenv').config(); console.log(process.env.OPENROUTER_API_KEY?.substring(0,10))"

# 测试OpenRouter连接
curl -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"google/gemini-2.0-flash-exp:free","messages":[{"role":"user","content":"test"}]}'
```

### 关键localStorage键
- `openrouter_api_key` - 用户的API密钥
- `custom_models` - 用户定义的模型数组
- `selected_models` - 当前选中的模型

---

**最后更新：** 2024-12-11
**状态：** Phase 0 - 图片渲染问题调查中
**下一步优先：** 修复图片显示 或 实现降级方案
