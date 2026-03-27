# 图片素材管理系统

一个基于 AI 的图片素材管理 Web 应用，支持批量上传、智能分类、向量化存储和多维度检索。使用 PostgreSQL + pgvector 实现高效的向量语义搜索，支持 DashScope 和 Ollama 两种 AI 提供商。

## 主要特性

- **批量上传**：支持拖拽上传、实时进度显示、步骤级跟踪、失败隔离
- **AI 智能识别**：自动分析图片内容，生成描述、关键词、分类
- **语义搜索**：基于 pgvector 的向量相似度搜索，支持自然语言查询
- **多 AI 提供商**：支持 DashScope（阿里云）和 Ollama（本地部署）
- **多存储后端**：支持本地存储和 MinIO 对象存储
- **用户权限管理**：支持多用户、角色权限、上传配额、有效期控制
- **生成绘图提示词**：分析图片生成可用于 Stable Diffusion、Midjourney 的中文提示词

## 技术栈

| 层面 | 技术 |
|------|------|
| 前端 | Vue 3 + Ant Design Vue + Vite |
| 后端 | Node.js + Express |
| 数据库 | PostgreSQL |
| 向量存储 | pgvector 扩展 |
| 大模型 | DashScope Qwen / Ollama |

## 环境要求

- Node.js 18+
- PostgreSQL 14+（需安装 pgvector 扩展）
- npm 或 yarn

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/image-asset-management.git
cd image-asset-management
```

### 2. 安装依赖

```bash
npm run install:all
```

### 3. 配置环境变量

```bash
# 复制后端配置模板
cp server/.env.example server/.env
```

编辑 `server/.env`，至少配置以下项：

```bash
# PostgreSQL 数据库配置
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=image_asset
PG_USER=postgres
PG_PASSWORD=your_password

# AI 提供商（二选一）
AI_PROVIDER=dashscope
DASHSCOPE_API_KEY=your-api-key
# 或者使用 Ollama
# AI_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
```

### 4. 初始化数据库

确保 PostgreSQL 已安装 pgvector 扩展：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

创建数据库：

```sql
CREATE DATABASE image_asset;
```

首次启动时，系统会自动创建所需表结构。

### 5. 启动服务

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm run build
cd server && npm start
```

### 6. 访问系统

- 开发环境：http://localhost:5173
- 生产环境：http://localhost:3000
- 默认账号：admin / admin123

## 配置说明

### 后端环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| HOST | 监听地址 | 0.0.0.0 |
| PORT | 服务端口 | 3000 |
| TZ | 时区 | Asia/Shanghai |
| BASE_URL | API 路径前缀（nginx 部署时使用） | 空 |
| JWT_SECRET | JWT 密钥 | - |
| PG_* | PostgreSQL 连接配置 | - |
| AI_PROVIDER | AI 提供商 (dashscope/ollama) | dashscope |
| EMBEDDING_DIMENSION | 向量维度 | 1024 |
| STORAGE_TYPE | 存储类型 (local/minio) | local |

### 前端环境变量

在 `client/.env.production` 中配置：

| 变量 | 说明 |
|------|------|
| VITE_BASE_URL | 前端基础路径（nginx 部署时使用，如 /bj-images） |

## AI 提供商配置

### DashScope（阿里云灵积）

```bash
AI_PROVIDER=dashscope
DASHSCOPE_API_KEY=your-api-key
DASHSCOPE_VISION_MODEL=qwen-vl-plus
DASHSCOPE_EMBEDDING_MODEL=text-embedding-v3
```

特点：需要 API Key，产生费用；向量维度 1024。

### Ollama（本地部署）

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_VISION_MODEL=llava
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

特点：完全本地运行，免费；需先安装 Ollama 并下载模型。

安装模型：

```bash
ollama pull llava
ollama pull nomic-embed-text
```

## 生产部署

### Nginx 反向代理配置

如果需要将系统部署在子路径（如 `/bj-images`），配置如下：

**1. 后端配置 (server/.env)**

```bash
BASE_URL=/bj-images
```

**2. 前端配置 (client/.env.production)**

```bash
VITE_BASE_URL=/bj-images
```

**3. 构建前端**

```bash
cd client && npm run build
```

**4. Nginx 配置**

```nginx
location /bj-images {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    client_max_body_size 50M;
}
```

访问地址：https://your-domain.com/bj-images/

## 项目结构

```
├── client/                 # 前端项目
│   ├── src/
│   │   ├── api/           # API 请求
│   │   ├── components/    # 公共组件
│   │   ├── router/        # 路由配置
│   │   ├── stores/        # Pinia 状态管理
│   │   ├── utils/         # 工具函数
│   │   └── views/         # 页面组件
│   └── vite.config.js
├── server/                 # 后端项目
│   ├── src/
│   │   ├── routes/        # API 路由
│   │   ├── services/      # 业务逻辑
│   │   │   ├── ai/        # AI 提供商
│   │   │   └── storage/   # 存储提供商
│   │   ├── repository/    # 数据访问层
│   │   └── models/        # 数据库连接
│   ├── uploads/           # 上传文件
│   └── public/            # 前端构建产物
├── SPEC.md                # 需求规格说明书
└── README.md
```

## 功能模块

| 模块 | 功能 |
|------|------|
| 用户管理 | 登录认证、多用户、角色权限、上传配额、有效期控制 |
| 图片上传 | 批量上传、实时进度、文件验证、失败隔离 |
| 图片浏览 | 分类浏览、网格/列表视图、图片详情、收藏 |
| 图片搜索 | 关键字搜索、自然语言语义搜索、标签筛选 |
| 图片操作 | 下载、批量下载、删除、恢复、重新识别 |
| 提示词生成 | 分析图片生成 AI 绘图提示词 |
| 分类管理 | 两级分类、AI 自动分类、手动调整 |
| 标签管理 | 自定义标签、多标签筛选 |
| 操作日志 | 登录、上传、删除等操作记录 |

## API 文档

详细 API 文档请参阅 [SPEC.md](./SPEC.md) 第 5 节。

主要接口：

- `POST /api/auth/login` - 登录
- `POST /api/images/upload-progress` - 批量上传（SSE 实时进度）
- `GET /api/images` - 获取图片列表
- `POST /api/search/semantic` - 语义搜索
- `POST /api/images/:id/generate-prompt` - 生成绘图提示词

## 开发命令

```bash
# 安装所有依赖
npm run install:all

# 开发模式（前后端同时启动）
npm run dev

# 仅启动后端
npm run dev:server

# 仅启动前端
npm run dev:client

# 生产构建
npm run build

# 发布打包
npm run release
```

## License

MIT