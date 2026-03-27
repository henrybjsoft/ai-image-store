require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./models/database-pg');
const { initStorage, isLocalStorage } = require('./services/storage');

// 导入路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const imageRoutes = require('./routes/images');
const categoryRoutes = require('./routes/categories');
const tagRoutes = require('./routes/tags');
const searchRoutes = require('./routes/search');
const trashRoutes = require('./routes/trash');
const logRoutes = require('./routes/logs');
const systemRoutes = require('./routes/system');
const favoriteRoutes = require('./routes/favorites');

const app = express();

// 判断是否为生产模式
const isProduction = process.env.NODE_ENV === 'production';
// 路径前缀，通过 BASE_URL 环境变量配置，默认为空
const BASE_URL = process.env.BASE_URL || '';

// 中间件
if (!isProduction) {
  app.use(cors());
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API 路由
app.use(`${BASE_URL}/api/auth`, authRoutes);
app.use(`${BASE_URL}/api/users`, userRoutes);
app.use(`${BASE_URL}/api/images`, imageRoutes);
app.use(`${BASE_URL}/api/categories`, categoryRoutes);
app.use(`${BASE_URL}/api/tags`, tagRoutes);
app.use(`${BASE_URL}/api/search`, searchRoutes);
app.use(`${BASE_URL}/api/trash`, trashRoutes);
app.use(`${BASE_URL}/api/logs`, logRoutes);
app.use(`${BASE_URL}/api/system`, systemRoutes);
app.use(`${BASE_URL}/api/favorites`, favoriteRoutes);

// 健康检查
app.get(`${BASE_URL}/api/health`, (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 生产模式：托管前端静态文件
if (isProduction) {
  const publicPath = path.join(__dirname, '../public');

  // 如果有 BASE_URL，需要先处理静态文件的路由
  if (BASE_URL) {
    app.use(BASE_URL, express.static(publicPath));

    // SPA 路由：所有 BASE_URL 下的非 API 路由返回 index.html
    app.get(`${BASE_URL}/*`, (req, res) => {
      // 排除 API 路由
      if (!req.path.startsWith(`${BASE_URL}/api`)) {
        res.sendFile(path.join(publicPath, 'index.html'));
      }
    });
  } else {
    app.use(express.static(publicPath));

    // SPA 路由：所有非 API 路由返回 index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }
}

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || '服务器内部错误'
  });
});

// 初始化数据库并启动服务器
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    // 初始化存储
    initStorage();
    console.log('存储服务初始化完成');

    // 初始化数据库
    await initDatabase();
    console.log('数据库初始化完成');

    // 静态文件服务（仅本地存储时需要）
    if (isLocalStorage()) {
      const storage = require('./services/storage').getStorage();
      app.use(`${BASE_URL}/uploads`, express.static(storage.getUploadDir()));
      console.log('本地文件服务已启动');
    }

    app.listen(PORT, HOST, () => {
      console.log(`服务器运行在 http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
      if (BASE_URL) {
        console.log(`路径前缀: ${BASE_URL}`);
      }
      if (HOST === '0.0.0.0') {
        console.log('监听所有网络接口，局域网可通过本机IP访问');
      }
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;