/**
 * Vercel Serverless Function - OpenRouter API 代理
 * 处理所有到 OpenRouter API 的请求，隐藏 API Key
 * 
 * 使用方法：
 * 1. 在 Vercel 项目设置中添加环境变量 OPENROUTER_API_KEY
 * 2. 前端调用 /api/openrouter 即可（固定转发到 /chat/completions）
 */
module.exports = async (req, res) => {
  // 处理 OPTIONS 请求（CORS 预检）
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 从环境变量获取 API Key（需要在 Vercel 项目设置中配置）
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY environment variable is not set');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'API key not configured on server. Please contact administrator.'
    });
  }

  try {
    // 固定转发到 chat/completions 端点
    const targetUrl = 'https://openrouter.ai/api/v1/chat/completions';

    // 准备请求头
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': req.headers.referer || req.headers.origin || '',
      'X-Title': 'AI UI Design Comparator'
    };

    // 转发请求到 OpenRouter API
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(req.body)
    });

    // 获取响应数据
    const data = await response.json();

    // 设置 CORS 头（允许跨域）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 返回响应（保持原始状态码）
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Proxy request failed',
      message: error.message 
    });
  }
};
