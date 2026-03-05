/**
 * 本地开发服务器
 * 用于在本地运行时的 API 代理
 * 
 * 使用方法：
 * 1. 确保已安装 Node.js
 * 2. 创建 .env 文件，添加：OPENROUTER_API_KEY=你的API密钥
 * 3. 运行：node server.js
 * 4. 访问：http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const puppeteer = require('puppeteer');

// 从环境变量或 .env 文件读取 API Key
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const API_KEY = process.env.OPENROUTER_API_KEY || '';

// 引入 stats 模块（用于本地处理 /api/stats 请求）
const statsHandler = require('./api/stats');

// 调试：检查 API Key 是否加载（不显示完整内容）
if (API_KEY) {
  console.log(`✅ API Key 已加载: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`);
} else {
  console.log('❌ API Key 未找到');
}

// MIME 类型映射
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// 从环境变量读取端口，Zeabur 等平台会动态分配端口
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);

  // 处理 /api/stats 请求（统计数据存取）
  // api/stats.js 使用 Vercel serverless 风格（res.status().json()），需要适配原生 Node.js res
  if (pathname === '/api/stats') {
    const vercelRes = {
      _headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      setHeader(key, value) { this._headers[key] = value; return this; },
      status(code) { this._statusCode = code; return this; },
      json(data) {
        res.writeHead(this._statusCode || 200, this._headers);
        res.end(JSON.stringify(data));
      },
      end() {
        res.writeHead(this._statusCode || 200, this._headers);
        res.end();
      }
    };
    return statsHandler(req, vercelRes);
  }

  // 处理 API 代理请求
  if (pathname === '/api/openrouter' && req.method === 'POST') {
    if (!API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        error: 'Server configuration error',
        message: 'OPENROUTER_API_KEY not found. Please create a .env file with OPENROUTER_API_KEY=your_key'
      }));
      return;
    }

    // 读取请求体
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const requestBody = JSON.parse(body);
        const targetUrl = 'https://openrouter.ai/api/v1/chat/completions';

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'HTTP-Referer': req.headers.referer || req.headers.origin || 'http://localhost:3000',
          'X-Title': 'AI UI Design Comparator'
        };

        console.log('📤 转发请求到 OpenRouter:', targetUrl);
        console.log('🔑 Authorization:', `Bearer ${API_KEY.substring(0, 20)}...`);

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        // 调试：记录响应状态
        if (!response.ok) {
          console.error(`❌ OpenRouter API 错误 (${response.status}):`, JSON.stringify(data).substring(0, 500));
        } else {
          console.log('✅ OpenRouter API 响应成功');
        }

        res.writeHead(response.status, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify(data));
      } catch (error) {
        console.error('Proxy error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          error: 'Proxy request failed',
          message: error.message
        }));
      }
    });
    return;
  }

  // 处理 OPTIONS 预检请求 - openrouter
  if (pathname === '/api/openrouter' && req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // 处理 OPTIONS 预检请求 - screenshot
  if (pathname === '/api/screenshot' && req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Puppeteer 截图 API
  if (pathname === '/api/screenshot' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      let browser = null;
      try {
        const { html, width = 375, scale = 2 } = JSON.parse(body);

        if (!html) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Missing html parameter' }));
          return;
        }

        console.log(`📸 开始截图: width=${width}, scale=${scale}`);
        const startTime = Date.now();

        // 启动 Puppeteer
        browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();

        // 设置视口
        await page.setViewport({
          width: width,
          height: 800, // 初始高度，后续会自动调整
          deviceScaleFactor: scale
        });

        // 加载 HTML 内容
        await page.setContent(html, {
          waitUntil: ['networkidle0', 'domcontentloaded']
        });

        // 等待额外渲染时间（动画等）
        await new Promise(r => setTimeout(r, 500));

        // 获取实际内容高度
        const bodyHeight = await page.evaluate(() => {
          const body = document.body;
          let maxBottom = 0;
          const allElements = body.querySelectorAll('*');
          allElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const bottom = rect.top + rect.height;
            if (bottom > maxBottom && rect.height > 0) {
              maxBottom = bottom;
            }
          });
          return Math.max(maxBottom, body.scrollHeight);
        });

        const safeHeight = Math.min(Math.max(Math.ceil(bodyHeight) + 50, 200), 8000);

        // 调整视口高度
        await page.setViewport({
          width: width,
          height: safeHeight,
          deviceScaleFactor: scale
        });

        // 等待重新渲染
        await new Promise(r => setTimeout(r, 200));

        // 截图
        const screenshotBuffer = await page.screenshot({
          type: 'png',
          fullPage: true
        });

        await browser.close();
        browser = null;

        // 转换为 base64
        const dataUrl = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

        const elapsed = Date.now() - startTime;
        console.log(`✅ 截图完成: ${safeHeight}px, 耗时 ${elapsed}ms`);

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ success: true, dataUrl, height: safeHeight }));

      } catch (error) {
        console.error('❌ 截图失败:', error);
        if (browser) {
          await browser.close();
        }
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: 'Screenshot failed', message: error.message }));
      }
    });
    return;
  }

  // 处理静态文件
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.join(__dirname, pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 本地服务器已启动！`);
  console.log(`📡 访问地址: http://localhost:${PORT}`);
  console.log(`📡 监听地址: ${HOST}:${PORT}`);
  if (!API_KEY) {
    console.log(`\n⚠️  警告: 未找到 OPENROUTER_API_KEY`);
    console.log(`   请创建 .env 文件并添加: OPENROUTER_API_KEY=你的API密钥`);
  } else {
    console.log(`✅ API Key 已配置\n`);
  }
});

