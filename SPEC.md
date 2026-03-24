# 图片素材管理系统 - 需求规格说明书 (SPEC)

## 1. 项目概述

### 1.1 项目名称
图片素材管理系统 (Image Asset Management System)

### 1.2 项目目标
构建一个基于 AI 的图片素材管理 Web 应用，支持批量上传、智能分类、向量化存储和多维度检索，帮助用户高效管理和查找图片素材。

### 1.3 目标用户
- 企业/团队内部使用
- 多管理员协作管理

---

## 2. 技术架构

### 2.1 技术选型

| 层面 | 技术选择 |
|------|----------|
| 前端框架 | Vue 3 |
| UI 组件库 | Ant Design Vue |
| 后端框架 | Node.js + Express |
| 主数据库 | SQLite (sql.js) |
| 向量存储 | 本地 JSON 文件 + 余弦相似度计算 |
| 大模型服务 | DashScope Qwen3.5-plus |
| 文件存储 | 本地文件系统 |
| 部署方式 | 跨平台（Windows/Linux） |

### 2.2 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Vue 3)                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ 登录模块 │ │ 上传模块 │ │ 浏览模块 │ │ 搜索模块 │ ...      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │ HTTP
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     后端 (Express)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ 用户认证  │ │ 文件处理  │ │ AI 服务  │ │ 搜索服务  │ ...   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐     ┌─────────────────┐    ┌─────────────┐
│   SQLite    │     │   向量存储       │    │ DashScope   │
│  (sql.js)   │     │  (本地JSON)      │    │ (大模型API) │
└─────────────┘     └─────────────────┘    └─────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    本地文件系统                              │
│              (图片存储、向量索引文件)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 功能模块

### 3.1 用户管理模块

#### 3.1.1 登录功能
- 用户名/密码登录
- 登录状态持久化（JWT Token）
- 登录失败提示
- 安全退出

#### 3.1.2 管理员管理
- 初始化默认管理员账号：admin / admin123
- 支持多个管理员账号
- 管理员列表查看
- 添加/删除管理员
- 修改密码

### 3.2 图片上传模块

#### 3.2.1 批量上传
- 支持拖拽上传和点击选择
- 支持格式：JPG、PNG、WebP、GIF、SVG
- 单张图片大小限制：10MB
- 单次批量上传数量限制：20张
- 上传前格式和大小校验
- 实时进度条显示
- 上传成功/失败状态反馈
- **支持中文文件名**：自动处理中文编码，正确保存和显示

#### 3.2.2 图片上传处理流程

```
┌──────────────┐
│  1. 上传文件  │  接收前端上传的图片文件
└──────┬───────┘
       ▼
┌──────────────┐
│ 2. 分配唯一ID │  UUID作为文件名，数据库自增ID作为图片ID
└──────┬───────┘
       ▼
┌──────────────┐
│ 3. 保存文件   │  保存到本地 uploads/YYYY-MM/ 目录
└──────┬───────┘
       ▼
┌──────────────┐
│ 4. 创建缩略图 │  生成300x300缩略图保存到 uploads/thumbnails/
└──────┬───────┘
       ▼
┌──────────────┐
│ 5. AI图像识别 │  调用 DashScope Qwen3.5-plus 识别图片
│              │  获取：图片描述、关键词、分类
└──────┬───────┘
       ▼
┌──────────────┐
│ 6. 保存元数据 │  将图片信息存入 SQLite 数据库
│              │  字段：ID、文件名、描述、分类、关键词等
└──────┬───────┘
       ▼
┌──────────────┐
│ 7. 获取向量   │  调用大模型API将描述文本转换为向量
└──────┬───────┘
       ▼
┌──────────────┐
│ 8. 存储向量   │  将 { imageId: vector } 存入向量数据库
└──────┬───────┘
       ▼
┌──────────────┐
│ 9. 记录日志   │  记录上传操作日志
└──────────────┘
```

#### 3.2.3 技术实现细节

| 步骤 | 技术实现 | 说明 |
|------|----------|------|
| 文件上传 | multer | 支持批量上传，自动处理multipart/form-data |
| 唯一ID | uuidv4() | 文件名使用UUID，数据库使用自增主键 |
| 文件存储 | 本地文件系统 | 按年月分目录：uploads/2024-03/ |
| 缩略图 | sharp | 自动生成缩略图，提升浏览性能 |
| AI识别 | DashScope Qwen3.5-plus | 多模态模型，识别图片内容 |
| 向量化 | DashScope text-embedding-v3 | 文本转向量，1024维 |
| 向量存储 | 本地JSON文件 | { imageId: [vector] } 结构 |
| 元数据存储 | SQLite | 关系型数据，支持复杂查询 |

### 3.3 分类管理模块

#### 3.3.1 分类体系
- 两级分类结构（一级分类 → 二级分类）
- AI 自动分类
- 管理员手动调整分类

#### 3.3.2 分类操作
- 查看分类列表
- 添加自定义分类
- 编辑分类名称
- 删除分类（分类下图片需重新分配或移至默认分类）
- 图片手动调整所属分类

#### 3.3.3 默认分类
系统初始化时创建以下默认分类：
- 风景
- 人物
- 动物
- 建筑
- 美食
- 物品
- 艺术
- 其他

### 3.4 图片浏览模块

#### 3.4.1 浏览方式
- 按分类浏览（树形导航）
- 网格视图/列表视图切换
- 缩略图预览
- 分页加载

#### 3.4.2 图片详情
- 点击查看大图
- 显示图片信息（名称、大小、上传时间、分类、标签、描述）
- 收藏/取消收藏
- 添加/编辑标签
- 调整分类
- 删除操作
- **重新识别**：重新调用 AI 分析图片，更新描述、关键词、分类和向量

#### 3.4.3 重新识别功能
- 在图片详情弹窗中点击"重新识别"按钮
- 重新调用 DashScope Qwen3.5-plus 分析图片内容
- 更新图片描述、关键词、分类
- 更新向量数据库中的向量表示
- 实时刷新界面显示

### 3.5 搜索模块

#### 3.5.1 关键字搜索
- 基于图片名称、描述、标签搜索
- 支持模糊匹配
- 搜索结果高亮显示

#### 3.5.2 自然语言搜索
- 用户输入自然语言描述
- 调用大模型将描述向量化
- 使用向量相似度检索
- 返回语义相关的图片结果

#### 3.5.3 标签筛选
- 按自定义标签筛选图片
- 支持多标签组合筛选

### 3.6 图片操作模块

#### 3.6.1 预览功能
- 图片缩略图
- 全屏预览
- 图片缩放

#### 3.6.2 下载功能
- 单张下载（需要认证，携带 JWT Token）
- 批量下载（打包 ZIP）
- 下载进度显示
- 支持中文文件名

#### 3.6.3 删除功能
- 单张删除
- 批量删除
- 删除确认提示
- 删除后移入回收站

### 3.7 回收站模块

#### 3.7.1 回收站功能
- 查看已删除图片列表
- 恢复单个图片
- 批量恢复
- 彻底删除
- 清空回收站

### 3.8 收藏与标签模块

#### 3.8.1 收藏功能
- 收藏/取消收藏图片
- 收藏列表查看

#### 3.8.2 标签功能
- 查看所有标签
- 为图片添加标签
- 删除图片标签
- 管理标签（重命名、删除）

### 3.9 操作日志模块

#### 3.9.1 日志记录
- 登录/登出记录
- 图片上传记录
- 图片删除/恢复记录
- 分类调整记录
- 标签修改记录
- 管理员操作记录

#### 3.9.2 日志查看
- 日志列表（时间、操作人、操作类型、详情）
- 按时间范围筛选
- 按操作类型筛选
- 按操作人筛选

---

## 4. 数据库设计

### 4.1 SQLite 表结构

#### 4.1.1 用户表 (users)
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.1.2 分类表 (categories)
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  parent_id INTEGER NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);
```

#### 4.1.3 图片表 (images)
```sql
CREATE TABLE images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500),
  file_size INTEGER NOT NULL,
  file_format VARCHAR(20) NOT NULL,
  width INTEGER,
  height INTEGER,
  description TEXT,
  keywords TEXT,
  category_id INTEGER,
  uploaded_by INTEGER NOT NULL,
  is_favorite BOOLEAN DEFAULT 0,
  is_deleted BOOLEAN DEFAULT 0,
  deleted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
```

#### 4.1.4 标签表 (tags)
```sql
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.1.5 图片标签关联表 (image_tags)
```sql
CREATE TABLE image_tags (
  image_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (image_id, tag_id),
  FOREIGN KEY (image_id) REFERENCES images(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);
```

#### 4.1.6 操作日志表 (logs)
```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id INTEGER,
  details TEXT,
  ip_address VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 4.2 向量存储设计

- 使用本地 JSON 文件存储图片描述的向量表示
- 向量维度：1024（DashScope text-embedding-v3 输出维度）
- 存储文件：`data/vectors.json`
- 索引结构：`{ imageId: [vector] }`
- 搜索算法：余弦相似度

---

## 5. API 设计

### 5.1 认证相关 API

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/auth/login | 用户登录 |
| POST | /api/auth/logout | 用户登出 |
| GET | /api/auth/me | 获取当前用户信息 |

### 5.2 用户管理 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/users | 获取用户列表 |
| POST | /api/users | 创建用户 |
| PUT | /api/users/:id | 更新用户信息 |
| DELETE | /api/users/:id | 删除用户 |
| PUT | /api/users/:id/password | 修改密码 |

### 5.3 图片管理 API

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/images/upload | 批量上传图片 |
| GET | /api/images | 获取图片列表 |
| GET | /api/images/:id | 获取图片详情 |
| PUT | /api/images/:id | 更新图片信息 |
| DELETE | /api/images/:id | 删除图片 |
| POST | /api/images/batch-delete | 批量删除 |
| GET | /api/images/download/:id | 下载单张图片（需认证） |
| POST | /api/images/batch-download | 批量下载（需认证） |
| PUT | /api/images/:id/favorite | 收藏/取消收藏 |
| PUT | /api/images/:id/category | 调整分类 |
| POST | /api/images/:id/tags | 为图片添加标签 |
| DELETE | /api/images/:id/tags/:tagId | 移除图片标签 |
| POST | /api/images/:id/reanalyze | 重新识别图片（AI重新分析） |

### 5.4 分类管理 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/categories | 获取分类树 |
| POST | /api/categories | 创建分类 |
| PUT | /api/categories/:id | 更新分类 |
| DELETE | /api/categories/:id | 删除分类 |

### 5.5 标签管理 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/tags | 获取所有标签 |
| POST | /api/tags | 创建标签 |
| PUT | /api/tags/:id | 更新标签 |
| DELETE | /api/tags/:id | 删除标签 |

### 5.6 搜索 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/search/keyword | 关键字搜索 |
| POST | /api/search/semantic | 自然语言搜索 |
| GET | /api/search/by-tag | 按标签筛选 |

### 5.7 回收站 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/trash | 获取回收站列表 |
| POST | /api/trash/restore | 恢复图片 |
| DELETE | /api/trash/:id | 彻底删除 |
| DELETE | /api/trash | 清空回收站 |

### 5.8 日志 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/logs | 获取操作日志列表 |

---

## 6. 非功能性需求

### 6.1 界面要求
- 现代美观的 UI 设计
- 响应式布局，适配不同屏幕尺寸
- 清晰的视觉层次和配色方案
- 流畅的动画过渡效果

### 6.2 性能要求
- 图片缩略图快速加载
- 大批量上传时保持响应流畅
- 搜索响应时间 < 2秒
- 支持分页，避免一次加载过多数据

### 6.3 安全要求
- 密码加密存储（bcrypt）
- JWT Token 认证
- 所有 API 请求需携带 Token（包括下载请求）
- 文件上传格式校验
- 防止目录遍历攻击
- 中文文件名编码处理，防止乱码

### 6.4 兼容性要求
- 支持 Windows 10/11
- 支持 Linux (Ubuntu 20.04+)
- 浏览器支持：Chrome、Firefox、Edge 最新版本

---

## 7. 项目目录结构

```
image-asset-management/
├── client/                     # 前端项目
│   ├── public/                # 静态资源
│   ├── src/
│   │   ├── api/               # API 请求封装
│   │   ├── components/        # 公共组件
│   │   ├── views/             # 页面组件
│   │   ├── stores/            # Pinia 状态管理
│   │   ├── router/            # 路由配置
│   │   ├── styles/            # 全局样式
│   │   └── main.js            # 入口文件
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/                     # 后端项目
│   ├── src/
│   │   ├── routes/            # 路由处理
│   │   ├── services/          # 业务逻辑
│   │   ├── models/            # 数据模型
│   │   ├── middlewares/       # 中间件
│   │   └── app.js             # 入口文件
│   ├── uploads/               # 上传文件存储
│   ├── data/                  # SQLite 数据库和向量索引
│   ├── .env                   # 环境变量配置
│   └── package.json
├── SPEC.md                     # 需求规格说明书
├── README.md                   # 项目说明
└── package.json                # 根目录脚本
```

---

## 8. 环境配置

### 8.1 环境变量

```bash
# 服务器配置
PORT=3000
NODE_ENV=development

# JWT 密钥
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# DashScope API 配置
DASHSCOPE_API_KEY=your-dashscope-api-key

# 文件上传配置
MAX_FILE_SIZE=10485760        # 10MB
MAX_FILES=20
UPLOAD_DIR=./uploads

# 允许的图片格式
ALLOWED_FORMATS=jpg,jpeg,png,webp,gif,svg
```

### 8.2 默认账号

- 用户名: `admin`
- 密码: `admin123`

---

## 9. 开发阶段规划

### 第一阶段：基础框架搭建 ✅
- 项目初始化（前后端脚手架）
- 数据库设计与初始化
- 用户认证模块
- 基础 UI 框架

### 第二阶段：核心功能开发 ✅
- 图片上传功能
- AI 识别与分类
- 向量化存储
- 分类管理

### 第三阶段：浏览与搜索 ✅
- 图片浏览功能
- 关键字搜索
- 自然语言搜索
- 标签功能

### 第四阶段：完善功能 ✅
- 收藏功能
- 回收站功能
- 操作日志
- 批量下载

### 第五阶段：优化与部署
- UI 美化
- 性能优化
- 部署脚本
- 测试与文档

---

## 10. 更新记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-03-23 | v1.0.0 | 初始版本，完成核心功能开发 |
| 2026-03-24 | v1.1.0 | 功能增强：<br>- 新增图片重新识别功能，支持重新调用AI分析并更新描述、关键词、分类和向量<br>- 修复中文文件名乱码问题，支持中文文件名上传和下载<br>- 改进下载功能，所有下载请求需携带JWT Token认证<br>- 优化导航栏布局样式<br>- 修复AI描述生成解析问题（支持数组格式响应） |