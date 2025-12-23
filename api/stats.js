/**
 * Vercel Serverless Function - 全站统计数据 API
 * 存储和获取所有用户（不分用户）的生成记录和统计数据
 * 
 * 使用方法：
 * 1. POST /api/stats - 保存生成记录
 * 2. GET /api/stats - 获取统计数据
 * 
 * 存储：使用 Supabase PostgreSQL（需要配置环境变量）
 */

// 如果没有 Supabase，可以使用简单的内存存储（仅用于开发，不持久化）
let memoryStorage = {
  records: [],
  lastCleanup: Date.now()
};

// 清理内存存储（保留最近30天的数据）
function cleanupMemoryStorage() {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  memoryStorage.records = memoryStorage.records.filter(
    record => new Date(record.timestamp).getTime() > thirtyDaysAgo
  );
  memoryStorage.lastCleanup = Date.now();
}

module.exports = async (req, res) => {
  // 处理 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET: 获取统计数据
    if (req.method === 'GET') {
      const stats = await getStatistics();
      return res.status(200).json(stats);
    }

    // POST: 保存生成记录
    if (req.method === 'POST') {
      const { results, totalCost } = req.body;
      
      if (!results || !Array.isArray(results)) {
        return res.status(400).json({ error: 'Invalid request: results array is required' });
      }

      const record = {
        timestamp: new Date().toISOString(),
        results: results.map(r => ({
          modelName: r.modelName,
          cost: r.cost || 0,
          isError: r.isError || false
        })),
        totalCost: totalCost || 0
      };

      await saveRecord(record);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Stats API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

// 保存记录
async function saveRecord(record) {
  try {
    // 尝试使用 Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      // 使用 Supabase 存储
      // 将结果数组转换为 JSON 字符串存储
      const response = await fetch(`${supabaseUrl}/rest/v1/generation_records`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          results: JSON.stringify(record.results),
          total_cost: record.totalCost,
          created_at: record.timestamp || new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Supabase save error:', errorText);
        throw new Error(`Failed to save to Supabase: ${response.status}`);
      }

      return;
    }

    // 如果没有配置 Supabase，使用内存存储（仅开发用）
    memoryStorage.records.push(record);
    
    // 定期清理旧数据（每1000次请求清理一次）
    if (memoryStorage.records.length % 1000 === 0) {
      cleanupMemoryStorage();
    }
  } catch (error) {
    console.error('Error saving record:', error);
    // 如果 Supabase 失败，回退到内存存储
    memoryStorage.records.push(record);
  }
}

// 获取统计数据
async function getStatistics() {
  try {
    let records = [];

    // 尝试从 Supabase 获取
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      // 从 Supabase 获取记录（最多1000条，按时间倒序）
      const response = await fetch(
        `${supabaseUrl}/rest/v1/generation_records?select=*&order=created_at.desc&limit=1000`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // 将 Supabase 数据转换为内部格式
        records = data.map(row => ({
          timestamp: row.created_at,
          results: typeof row.results === 'string' ? JSON.parse(row.results) : row.results,
          totalCost: row.total_cost || 0
        }));
      } else {
        console.error('Supabase fetch error:', await response.text());
      }
    }

    // 如果没有配置 Supabase 或获取失败，使用内存存储
    if (records.length === 0) {
      records = memoryStorage.records;
    }

    // 计算统计
    const modelStats = {};
    let grandTotal = 0;
    let totalGenerations = 0;

    records.forEach(record => {
      if (!record.results || !Array.isArray(record.results)) return;
      
      record.results.forEach(result => {
        if (!result.modelName) return;
        const cost = result.cost || 0;
        
        if (!modelStats[result.modelName]) {
          modelStats[result.modelName] = {
            totalCost: 0,
            count: 0
          };
        }
        
        modelStats[result.modelName].totalCost += cost;
        modelStats[result.modelName].count += 1;
        grandTotal += cost;
        totalGenerations += 1;
      });
    });

    // 转换为数组并计算平均值
    const sortedStats = Object.entries(modelStats)
      .map(([modelName, stats]) => ({
        modelName,
        totalCost: stats.totalCost,
        count: stats.count,
        averageCost: stats.count > 0 ? stats.totalCost / stats.count : 0
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    const grandAverage = totalGenerations > 0 ? grandTotal / totalGenerations : 0;

    return {
      grandTotal,
      totalGenerations,
      grandAverage,
      modelStats: sortedStats,
      totalRecords: records.length
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    // 如果获取失败，返回空统计
    return {
      grandTotal: 0,
      totalGenerations: 0,
      grandAverage: 0,
      modelStats: [],
      totalRecords: 0
    };
  }
}

