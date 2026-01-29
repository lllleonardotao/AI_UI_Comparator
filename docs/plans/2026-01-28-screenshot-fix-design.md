# 截图功能修复设计

## 目标
修复"复制长图"功能，使用 `modern-screenshot` 替换 `html2canvas`。

## 方案
1. **恢复** - `git checkout HEAD -- index.html`
2. **修改** - 重写 `copyLongImageToClipboard` 函数
3. **技术** - 使用数组拼接避免 script 标签解析问题

## 实现要点
```javascript
const captureClientCode = [
    '<scr' + 'ipt src="...modern-screenshot..."></scr' + 'ipt>',
    '<scr' + 'ipt>',
    // ... capture logic ...
    '</scr' + 'ipt>'
].join('\n');
```

## 验证
- 页面无 JS 错误
- 点击"复制长图"按钮成功生成图片
- 图片复制到剪贴板
