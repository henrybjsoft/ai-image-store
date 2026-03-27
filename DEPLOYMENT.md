# 图片素材管理系统 - 生产环境部署说明

## 1. 系统要求

- **操作系统**: Windows 10/11 或 Linux (Ubuntu 20.04+)
- **Node.js**: v18.0.0 或更高版本
- **内存**: 建议 2GB 以上
- **磁盘空间**: 根据图片存储需求规划

## 2. 部署步骤

### 2.1 安装 Node.js

**Windows:**
1. 访问 https://nodejs.org/
2. 下载 LTS 版本安装包
3. 运行安装程序，按提示完成安装

**Linux (Ubuntu):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2.2 部署应用

1. 将发布包 `image-asset-management.zip` 解压到目标目录

2. 进入解压目录，配置环境变量:
   ```bash
   cd server
   # 复制环境变量模板（如果存在）
   cp .env.example .env
   # 编辑配置文件
   notepad .env   # Windows
   nano .env      # Linux
   ```

3. 配置必要的环境变量:
   ```env
   # 服务监听配置
   HOST=0.0.0.0        # 0.0.0.0 监听所有网卡(局域网可访问)，127.0.0.1 仅本机访问
   PORT=3000

   # JWT 密钥（请修改为随机字符串）
   JWT_SECRET=your-random-secret-key-here

   # DashScope API Key（必填）
   DASHSCOPE_API_KEY=sk-your-api-key

   # 其他配置项（可选，有默认值）
   UPLOAD_CONCURRENCY=5
   JWT_EXPIRES_IN=7d
   THUMBNAIL_SIZE=400
   THUMBNAIL_QUALITY=80
   AI_VISION_MODEL=qwen-vl-plus
   AI_EMBEDDING_MODEL=text-embedding-v3
   ```

### 2.3 启动服务

**Windows:**
```bash
# 双击运行 start.bat
# 或在命令行执行:
start.bat
```

**Linux:**
```bash
cd server
NODE_ENV=production node src/app.js
```

### 2.4 访问系统

- 访问地址: http://localhost:3000
- 默认管理员账号: `admin`
- 默认密码: `admin123`

**重要:** 首次登录后请立即修改默认密码！

## 3. 生产环境配置建议

### 3.1 使用 PM2 管理进程 (推荐)

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
cd server
pm2 start src/app.js --name "image-asset" -- --production

# 设置开机自启
pm2 startup
pm2 save
```

常用 PM2 命令:
```bash
pm2 status          # 查看状态
pm2 logs image-asset # 查看日志
pm2 restart image-asset # 重启服务
pm2 stop image-asset    # 停止服务
```

### 3.2 配置反向代理 (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3.3 配置 HTTPS (推荐)

使用 Let's Encrypt 免费证书:
```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 4. 目录结构

```
image-asset-management/
├── server/
│   ├── src/              # 后端源代码
│   ├── public/           # 前端静态文件
│   ├── uploads/          # 上传的图片文件
│   ├── data/             # 数据库文件
│   ├── node_modules/     # 依赖包
│   └── .env              # 环境配置
├── start.bat             # Windows 启动脚本
└── DEPLOYMENT.md         # 本说明文档
```

## 5. 数据备份

### 5.1 数据库备份

数据库文件位于 `server/data/database.db`，定期备份此文件即可。

**Windows 备份脚本 (backup.bat):**
```batch
@echo off
set BACKUP_DIR=backups
set DATE=%date:~0,4%%date:~5,2%%date:~8,2%
if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%
copy server\data\database.db %BACKUP_DIR%\database_%DATE%.db
echo 备份完成: database_%DATE%.db
```

**Linux 备份脚本:**
```bash
#!/bin/bash
BACKUP_DIR="backups"
DATE=$(date +%Y%m%d)
mkdir -p $BACKUP_DIR
cp server/data/database.db $BACKUP_DIR/database_$DATE.db
echo "备份完成: database_$DATE.db"
```

### 5.2 图片文件备份

图片文件存储在 `server/uploads/` 目录，建议定期同步备份。

## 6. 常见问题

### Q: 无法访问系统
1. 检查服务是否启动: `pm2 status` 或查看控制台
2. 检查端口是否被占用: `netstat -ano | findstr :3000` (Windows)
3. 检查防火墙设置

### Q: 上传图片失败
1. 检查 `server/uploads` 目录权限
2. 检查磁盘空间
3. 检查图片大小是否超过限制 (默认 10MB)

### Q: AI 识别失败
1. 检查 `.env` 中的 `DASHSCOPE_API_KEY` 是否正确
2. 检查网络连接
3. 查看 API 调用日志

### Q: 数据丢失
1. 检查 `server/data` 目录是否存在
2. 确保正常关闭服务，避免强制终止
3. 定期备份数据库文件

## 7. 技术支持

如遇问题，请提供以下信息:
- 操作系统版本
- Node.js 版本 (`node -v`)
- 错误日志或截图
- 复现步骤