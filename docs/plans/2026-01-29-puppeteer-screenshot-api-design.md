# Puppeteer 截图 API 设计方案

> 目标：使用服务端 Puppeteer 替代客户端 html2canvas，实现像素级完美截图

## 背景

当前使用 `html2canvas` 进行客户端截图存在以下问题：
- ❌ `box-shadow` 外发光效果丢失
- ❌ `border-image` 渐变边框不渲染
- ❌ 复杂 CSS 渐变支持不完整
- ❌ `backdrop-filter` 毛玻璃效果无法捕获

Puppeteer 使用真实 Chromium 浏览器渲染，效果与用户手动截图完全一致。

---

## 技术方案

### 架构图

```
┌─────────────────┐     POST /api/screenshot     ┌──────────────────┐
│    前端页面      │  ─────────────────────────>  │   Node.js 服务器  │
│  (index.html)   │      { html, width, height } │   (server.js)    │
└─────────────────┘                              └────────┬─────────┘
        ▲                                                 │
        │                                                 ▼
        │                                        ┌──────────────────┐
        │     返回 PNG base64                    │    Puppeteer     │
        │  <────────────────────────────────     │   (Headless      │
        │                                        │    Chromium)     │
        └────────────────────────────────────────└──────────────────┘
```

---

## 实现细节

### 1. 后端：新增 `/api/screenshot` 端点

**文件**: `server.js`

```javascript
// 在文件顶部添加
const puppeteer = require('puppeteer');

// 新增 API 端点
if (pathname === '/api/screenshot' && req.method === 'POST') {
  // 接收 HTML 内容
  // 启动 Puppeteer 渲染
  // 返回 PNG base64
}
```

**请求参数**:
```json
{
  "html": "<html>...</html>",
  "width": 375,
  "height": 2000,
  "scale": 2
}
```

**响应**:
```json
{
  "success": true,
  "dataUrl": "data:image/png;base64,..."
}
```

---

### 2. 前端：修改 `copyLongImageToClipboard`

**文件**: `index.html`

将现有的 html2canvas 调用替换为：

```javascript
async function copyLongImageToClipboard(codeContent, platform, modelName) {
  const response = await fetch('/api/screenshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html: codeContent,
      width: platform === 'mobile' ? 375 : 1920,
      scale: 2
    })
  });
  
  const { dataUrl } = await response.json();
  // 复制到剪贴板...
}
```

---

## 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| **[MODIFY]** | [server.js](file:///Users/taotao/conductor/workspaces/AI_UI_Comparator/seoul/server.js) | 新增 `/api/screenshot` 端点 (~80行) |
| **[MODIFY]** | [index.html](file:///Users/taotao/conductor/workspaces/AI_UI_Comparator/seoul/index.html) | 修改 `copyLongImageToClipboard` 函数 (~30行) |
| **[MODIFY]** | [package.json](file:///Users/taotao/conductor/workspaces/AI_UI_Comparator/seoul/package.json) | 添加 `puppeteer` 依赖 |

---

## 依赖变更

```bash
npm install puppeteer
```

> ⚠️ Puppeteer 首次安装会下载 Chromium (~300MB)

---

## 验证计划

### 手动测试步骤

1. **重启服务器**
   ```bash
   # 停止当前 npm start
   # Ctrl+C
   npm start
   ```

2. **打开浏览器**
   - 访问 `http://localhost:3000`

3. **测试截图功能**
   - 打开「历史记录」
   - 选择任意记录，点击「查看」
   - 点击「复制图片」按钮
   - 验证：
     - [ ] 边框发光效果保留
     - [ ] 渐变边框正常显示
     - [ ] 内容完整无截断
     - [ ] 图片已复制到剪贴板

4. **对比测试**
   - 粘贴截图与手动截图对比
   - 确认视觉效果一致

---

## 风险与注意事项

| 风险 | 应对措施 |
|------|----------|
| Puppeteer 下载慢 | 可使用国内 npm 镜像 |
| 服务器内存占用 | 每次截图后关闭 browser 实例 |
| 首次启动慢 | 可预热 Puppeteer 实例 |
| 云部署兼容性 | Zeabur/Railway 均支持 Puppeteer |

---

## 预估工作量

| 阶段 | 时间 |
|------|------|
| 后端 API 开发 | 30 分钟 |
| 前端适配 | 15 分钟 |
| 测试验证 | 15 分钟 |
| **总计** | **~1 小时** |

---

## 批准后执行

请确认此方案后，我将按以下顺序执行：

1. 安装 puppeteer 依赖
2. 修改 server.js 添加截图 API
3. 修改 index.html 前端调用
4. 重启服务器测试验证
