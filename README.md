# 图片素材管理系统

一个基于 AI 的图片素材管理 Web 应用，支持批量上传、智能分类、向量化存储和多维度检索。

## 技术栈

| 层面 | 技术 |
|------|------|
| 前端 | Vue 3 + Ant Design Vue |
| 后端 | Node.js + Express |
| 数据库 | SQLite |
| 向量数据库 | hnswlib-node |
| 大模型 | DashScope Qwen3.5-plus |

## 功能特性

- 用户登录认证
- 批量图片上传（支持拖拽）
- AI 智能识别与自动分类
- 两级分类管理
- 自定义标签
- 关键字搜索
- 自然语言语义搜索
- 图片收藏
- 回收站
- 操作日志
- 批量下载

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
# 安装所有依赖
npm run install:all

# 或者分别安装
cd server && npm install
cd ../client && npm install
```

### 配置

1. 复制配置文件
```bash
cp server/.env.example server/.env
```

2. 编辑 `server/.env`，填入你的 DashScope API Key
```
DASHSCOPE_API_KEY=your-api-key
```

### 开发模式

```bash
# 同时启动前后端
npm run dev

# 或者分别启动
npm run dev:server  # 后端 :3000
npm run dev:client  # 前端 :5173
```

### 生产构建

```bash
npm run build
cd server && npm start
```

## 默认账号

- 用户名: `admin`
- 密码: `admin123`

## 项目结构

```
├── client/                 # 前端项目
│   ├── src/
│   │   ├── api/           # API 请求
│   │   ├── components/    # 公共组件
│   │   ├── router/        # 路由配置
│   │   ├── stores/        # 状态管理
│   │   ├── styles/        # 样式
│   │   └── views/         # 页面组件
│   └── package.json
├── server/                 # 后端项目
│   ├── src/
│   │   ├── middlewares/   # 中间件
│   │   ├── models/        # 数据模型
│   │   ├── routes/        # 路由
│   │   └── services/      # 业务逻辑
│   ├── uploads/           # 上传文件
│   ├── data/              # 数据库
│   └── package.json
└── package.json
```

## API 文档

### 认证
- `POST /api/auth/login` - 登录
- `POST /api/auth/logout` - 登出
- `GET /api/auth/me` - 获取当前用户

### 图片
- `POST /api/images/upload` - 上传图片
- `GET /api/images` - 获取图片列表
- `GET /api/images/:id` - 获取图片详情
- `DELETE /api/images/:id` - 删除图片
- `PUT /api/images/:id/favorite` - 收藏/取消收藏

### 搜索
- `GET /api/search/keyword` - 关键字搜索
- `POST /api/search/semantic` - 语义搜索

### 分类
- `GET /api/categories` - 获取分类树
- `POST /api/categories` - 创建分类
- `PUT /api/categories/:id` - 更新分类
- `DELETE /api/categories/:id` - 删除分类

### 标签
- `GET /api/tags` - 获取标签列表
- `POST /api/tags` - 创建标签
- `PUT /api/tags/:id` - 更新标签
- `DELETE /api/tags/:id` - 删除标签

## License

MIT