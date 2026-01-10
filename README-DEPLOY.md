# 部署说明 - API Key 安全配置

## 🔒 安全说明

本项目的 API Key 已安全地移至服务器端，前端代码中不再包含任何 API Key。

## 📋 部署步骤

### 1. 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. **重要**：在 Vercel 项目设置中添加环境变量：
   - 变量名：`OPENROUTER_API_KEY`
   - 变量值：你的 OpenRouter API Key（以 `sk-or-v1-` 开头）
4. 部署项目

### 2. 环境变量配置

在 Vercel 项目设置 > Environment Variables 中添加：

```
OPENROUTER_API_KEY=sk-or-v1-your-actual-api-key-here
```

### 3. 本地开发（可选）

如果需要本地测试，可以：

1. 安装 Vercel CLI：
   ```bash
   npm i -g vercel
   ```

2. 链接项目并设置环境变量：
   ```bash
   vercel link
   vercel env pull .env.local
   ```

3. 运行开发服务器：
   ```bash
   vercel dev
   ```

## ✅ 验证部署

部署后，访问你的网站：
- 前端应该可以直接使用，无需输入 API Key
- 所有 API 请求会通过 `/api/openrouter` 代理到服务器端
- API Key 安全地保存在服务器端，不会被暴露

## 🛡️ 安全优势

- ✅ API Key 不会暴露在前端代码中
- ✅ 团队成员无需配置 API Key 即可使用
- ✅ 可以在服务器端统一管理和更新 API Key
- ✅ 可以通过 Vercel 的环境变量轻松更换 Key

