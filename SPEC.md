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
| 主数据库 | PostgreSQL |
| 向量存储 | pgvector 扩展 |
| 大模型服务 | DashScope Qwen3.5-plus / Ollama |
| 文件存储 | 本地文件系统 / MinIO 对象存储 |
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
┌─────────────────────────────────────┐    ┌─────────────┐
│          PostgreSQL                 │    │ DashScope   │
│  ┌─────────────┐ ┌───────────────┐  │    │ / Ollama    │
│  │  业务数据表  │ │ pgvector 向量 │  │    │ (大模型API) │
│  └─────────────┘ └───────────────┘  │    └─────────────┘
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   文件存储 (Storage Provider)                │
│  ┌─────────────────────────┐ ┌─────────────────────────┐   │
│  │    本地文件系统          │ │    MinIO 对象存储        │   │
│  │   (LocalStorageProvider) │ │   (MinioStorageProvider) │   │
│  └─────────────────────────┘ └─────────────────────────┘   │
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
- 单次批量上传数量限制：100张
- **智能文件验证**：
  - 选择文件时自动验证格式和大小
  - 不符合条件的文件标记为无效，显示原因（格式不支持/超过大小限制）
  - 超过数量限制时，自动标记超出部分
  - 无效文件单独显示在红色区域，可单独移除
- **本地预览**：上传前点击图片可在弹窗中预览本地文件
- **实时进度显示**：每张图片独立显示处理进度
- **步骤级进度跟踪**：显示当前处理步骤（保存文件、生成缩略图、AI识别、生成向量等）
- **失败隔离**：单个图片处理失败不影响其他图片
- **错误详情**：失败的图片显示具体错误原因
- 上传成功/失败统计
- **支持中文文件名**：自动处理中文编码，正确保存和显示

#### 3.2.2 上传进度实时显示

批量上传时，前端通过 SSE (Server-Sent Events) 接收实时进度更新：

```
┌─────────────────────────────────────────────────────────────┐
│  处理进度                                    3 / 5          │
├─────────────────────────────────────────────────────────────┤
│  📷 风景照片.jpg                                            │
│     ✓ 上传成功                                              │
├─────────────────────────────────────────────────────────────┤
│  📷 人物照片.png                                            │
│     ⏳ AI 识别中... ━━━━━━━━━━━━━━━━━━━━━━━ 60%            │
├─────────────────────────────────────────────────────────────┤
│  📷 美食图片.jpg                                            │
│     ✗ 处理失败: AI识别超时                                   │
└─────────────────────────────────────────────────────────────┘
```

**进度步骤说明**：

| 步骤 | 显示文本 | 进度 |
|------|----------|------|
| saving | 保存文件中... | 0% |
| dimensions | 获取图片信息... | 20% |
| thumbnail | 生成缩略图... | 30% |
| ai | AI 识别中... | 50% |
| database | 保存到数据库... | 80% |
| vector | 生成向量... | 90% |
| complete | 上传成功 | 100% |

#### 3.2.3 图片上传处理流程

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
- **图片统计**：显示当前筛选条件下的总图片数量

#### 3.4.2 图片详情
- 点击查看大图
- 显示图片信息（名称、大小、上传时间、分类、标签、描述）
- 收藏/取消收藏
- 添加/编辑标签
- 调整分类
- 删除操作
- **重新识别**：重新调用 AI 分析图片，更新描述、关键词、分类和向量
- **生成提示词**：调用 AI 分析图片，生成可用于 Stable Diffusion、Midjourney 等 AI 绘图工具的中文提示词

#### 3.4.3 重新识别功能
- 在图片详情弹窗中点击"重新识别"按钮
- 重新调用 DashScope Qwen3.5-plus 分析图片内容
- 更新图片描述、关键词、分类
- 更新向量数据库中的向量表示
- 实时刷新界面显示

#### 3.4.4 生成提示词功能
- 在图片详情弹窗中点击"生成提示词"按钮
- 调用 AI 分析图片，从多个维度生成详细的中文提示词：
  - **主体描述**：人物/动物/物品外观特征、服装配饰等
  - **构图与视角**：镜头角度、景别、构图方式、景深效果
  - **光影效果**：光源类型、光线方向、光影氛围、特殊光效
  - **色彩特征**：主色调、配色方案、色彩氛围
  - **艺术风格**：风格定位、艺术技法
  - **画质与细节**：清晰度、分辨率、质感
- 生成内容包括：
  - **正向提示词**：详细描述希望生成的画面内容、风格、质量
  - **反向提示词**：描述不希望出现的元素
  - **参数建议**：画幅比例、风格类型
- 支持一键复制全部提示词到剪贴板

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
- 彻底删除（同时删除物理文件和向量数据）
- 清空回收站（批量删除所有物理文件和向量数据）

#### 3.7.2 彻底删除流程
1. 获取图片文件路径
2. 删除原图文件（uploads/YYYY-MM/xxx.jpg）
3. 删除缩略图文件（uploads/thumbnails/thumb_xxx.jpg）
4. 删除向量数据（vectors.json 中的记录）
5. 删除数据库记录

### 3.8 收藏与标签模块

#### 3.8.1 收藏功能
- 收藏/取消收藏图片（每个用户独立收藏）
- 收藏列表查看（仅显示当前用户收藏的图片）
- 图片彻底删除时自动删除相关收藏记录

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

### 4.1 PostgreSQL 表结构

#### 4.1.1 用户表 (users)
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  role VARCHAR(50) DEFAULT 'user',
  status INTEGER DEFAULT 1,
  quota INTEGER DEFAULT 100,
  valid_from DATE,
  valid_until DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.1.2 分类表 (categories)
```sql
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id INTEGER NULL REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.1.3 图片表 (images)
```sql
CREATE TABLE images (
  id SERIAL PRIMARY KEY,
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
  extracted_text TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  is_favorite INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**注意**：`is_favorite` 字段已移除，收藏状态改为通过 `favorites` 关联表查询，实现用户级别的收藏功能。

#### 4.1.4 标签表 (tags)
```sql
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.1.5 图片标签关联表 (image_tags)
```sql
CREATE TABLE image_tags (
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (image_id, tag_id)
);
```

#### 4.1.6 操作日志表 (logs)
```sql
CREATE TABLE logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id INTEGER,
  details TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.1.7 收藏表 (favorites)
```sql
CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, image_id)
);
```

**说明**：收藏功能采用用户-图片关联表设计，每个用户的收藏独立存储，支持以下特性：
- 同一图片可被多个用户分别收藏
- 用户删除时自动删除其收藏记录（CASCADE DELETE）
- 图片彻底删除时自动删除相关收藏记录（CASCADE DELETE）

### 4.2 向量存储设计（pgvector）

- 使用 PostgreSQL 的 pgvector 扩展存储向量
- 向量维度：动态配置（默认 1024，兼容不同 Embedding 模型）
- 存储表：`vectors`
- 索引：HNSW 索引，适合高维向量快速检索
- 搜索算法：余弦距离（vector_cosine_ops）

#### 4.2.1 向量表 (vectors)
```sql
CREATE TABLE vectors (
  image_id INTEGER PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
  embedding vector(1024) NOT NULL,
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建向量索引
CREATE INDEX ON vectors USING hnsw (embedding vector_cosine_ops);
```

#### 4.2.2 向量维度管理
- 支持动态配置向量维度（EMBEDDING_DIMENSION 环境变量）
- 不同 Embedding 模型对应不同维度：
  - DashScope text-embedding-v3: 1024
  - Ollama nomic-embed-text: 768
  - Ollama mxbai-embed-large: 1024
- 提供管理接口重建向量表（POST /api/system/rebuild-vectors）

### 4.3 数据访问层设计

系统采用 Repository 模式封装所有数据库操作，位于 `server/src/repository/index.js`。

#### 4.3.1 设计目标
- 解耦业务逻辑与数据访问
- 便于后期切换数据库（如 MySQL、PostgreSQL）
- 统一数据访问接口，降低维护成本

#### 4.3.2 Repository 模块

| 模块 | 职责 |
|------|------|
| UserRepository | 用户增删改查、密码管理 |
| ImageRepository | 图片增删改查、分类、标签关联 |
| CategoryRepository | 分类管理 |
| TagRepository | 标签管理 |
| LogRepository | 操作日志记录与查询 |
| SearchRepository | 搜索功能 |
| VectorRepository | 向量数据存储与检索 |
| FavoriteRepository | 用户收藏管理（用户级别收藏状态） |

#### 4.3.3 使用方式

```javascript
// 业务代码中调用 Repository
const { ImageRepository } = require('../repository');

// 查询图片
const image = ImageRepository.findById(id);

// 创建图片
const imageId = ImageRepository.create(imageData);

// 更新图片
ImageRepository.update(id, updateData);
```

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
| POST | /api/images/upload | 批量上传图片（一次性返回结果） |
| POST | /api/images/upload-progress | 批量上传图片（SSE实时进度） |
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
| POST | /api/images/:id/generate-prompt | 生成绘图提示词 |

#### 5.3.1 SSE 上传进度 API

`POST /api/images/upload-progress` 返回 Server-Sent Events 流：

**请求格式**：`multipart/form-data`，包含 `images` 字段（多文件）

**SSE 事件格式**：

```javascript
// 开始事件
{ type: 'start', total: 5 }

// 进度事件
{ type: 'progress', fileIndex: 0, fileName: 'photo.jpg', step: 'ai', stepText: 'AI 识别中...', progress: 50 }

// 单文件完成
{ type: 'complete', fileIndex: 0, fileName: 'photo.jpg', progress: 100, result: { id: 123, success: true } }

// 单文件失败
{ type: 'error', fileIndex: 1, fileName: 'bad.jpg', error: '文件格式不支持' }

// 全部完成
{ type: 'done', total: 5, success: 4, failed: 1, results: [...] }
```

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

### 5.8 收藏 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/favorites | 获取当前用户收藏列表 |
| GET | /api/favorites/count | 获取当前用户收藏数量 |

### 5.9 日志 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/logs | 获取操作日志列表 |

### 5.10 系统 API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/system/config | 获取系统配置（管理员权限，敏感信息打码） |
| GET | /api/system/stats | 获取系统统计信息（管理员权限） |
| GET | /api/system/user-ranking | 获取用户上传排名（管理员权限） |

---

## 6. 非功能性需求

### 6.1 界面要求
- 现代美观的 UI 设计
- 响应式布局，适配不同屏幕尺寸
- 清晰的视觉层次和配色方案
- 流畅的动画过渡效果
- **分页组件样式**：当前页码使用白色文字配合紫色背景，确保可读性
- **统计信息展示**：列表页显示数据总数，便于用户了解数据量

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
│   │   │   ├── ai/            # AI 提供商模块
│   │   │   │   ├── index.js   # 统一入口
│   │   │   │   ├── base.js    # 抽象基类
│   │   │   │   ├── dashscope.js # DashScope 实现
│   │   │   │   └── ollama.js  # Ollama 实现
│   │   │   ├── storage/       # 存储提供商模块
│   │   │   │   ├── index.js   # 统一入口
│   │   │   │   ├── base.js    # 抽象基类
│   │   │   │   ├── local.js   # 本地存储实现
│   │   │   │   └── minio.js   # MinIO 实现
│   │   │   ├── aiService.js   # AI 服务封装
│   │   │   ├── vectorService.js # 向量服务
│   │   │   └── logService.js  # 日志服务
│   │   ├── repository/        # 数据访问层（Repository 模式）
│   │   ├── models/            # 数据模型
│   │   │   └── database-pg.js # PostgreSQL 连接模块
│   │   ├── middlewares/       # 中间件
│   │   └── app.js             # 入口文件
│   ├── uploads/               # 上传文件存储
│   │   ├── YYYY-MM/           # 按年月分目录存储原图
│   │   └── thumbnails/        # 缩略图目录
│   ├── public/                # 前端构建产物（生产环境）
│   ├── .env                   # 环境变量配置
│   ├── .env.example           # 环境变量模板
│   └── package.json
├── scripts/                    # 脚本文件
│   ├── build-release.js       # 发布脚本
│   ├── start.bat              # Windows 启动脚本
│   └── start.sh               # Linux 启动脚本
├── release/                    # 发布输出目录
│   └── image-asset-management/
├── SPEC.md                     # 需求规格说明书
├── DEPLOYMENT.md               # 部署说明文档
├── README.md                   # 项目说明
└── package.json                # 根目录脚本
```

---

## 8. 环境配置

### 8.1 环境变量

```bash
# 服务器配置
HOST=0.0.0.0                   # 监听地址：0.0.0.0 监听所有网卡，127.0.0.1 仅本机
PORT=3000
NODE_ENV=development
TZ=Asia/Shanghai               # 时区配置，影响数据库时间存储

# 访问路径配置（nginx 反向代理子路径部署时使用）
BASE_URL=                      # 后端 API 路径前缀，如 /bj-images（不带末尾 /）

# JWT 密钥
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# PostgreSQL 数据库配置
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=image_asset
PG_USER=postgres
PG_PASSWORD=your_password

# 向量维度配置（根据 Embedding 模型设置）
# DashScope text-embedding-v3: 1024
# Ollama nomic-embed-text: 768
# Ollama mxbai-embed-large: 1024
EMBEDDING_DIMENSION=1024

# AI 提供商配置
AI_PROVIDER=dashscope          # 可选值: dashscope, ollama

# DashScope API 配置（AI_PROVIDER=dashscope 时使用）
DASHSCOPE_API_KEY=your-dashscope-api-key
DASHSCOPE_VISION_MODEL=qwen-vl-plus
DASHSCOPE_EMBEDDING_MODEL=text-embedding-v3

# Ollama 配置（AI_PROVIDER=ollama 时使用）
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_VISION_MODEL=llava      # 推荐: llava, bakllava, moondream
OLLAMA_EMBEDDING_MODEL=nomic-embed-text  # 推荐: nomic-embed-text, mxbai-embed-large

# 文件上传配置
MAX_FILE_SIZE=10485760        # 10MB
MAX_FILES=100
UPLOAD_DIR=./uploads
UPLOAD_CONCURRENCY=5          # 上传并发数

# 缩略图配置
THUMBNAIL_SIZE=400
THUMBNAIL_QUALITY=80

# 允许的图片格式
ALLOWED_FORMATS=jpg,jpeg,png,webp,gif,svg

# 存储配置
STORAGE_TYPE=local              # 可选值: local, minio

# 本地存储配置
LOCAL_STORAGE_DIR=./uploads
LOCAL_STORAGE_BASE_URL=/uploads

# MinIO 存储配置
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=images
MINIO_PUBLIC_URL=http://localhost:9000/images
```

### 8.2 AI 提供商说明

系统支持两种 AI 提供商：

#### DashScope（阿里云灵积）

| 配置项 | 说明 |
|--------|------|
| DASHSCOPE_API_KEY | DashScope API Key |
| DASHSCOPE_VISION_MODEL | 视觉模型，默认 qwen-vl-plus |
| DASHSCOPE_EMBEDDING_MODEL | 嵌入模型，默认 text-embedding-v3 |

**特点**：
- 需要 API Key，产生费用
- 向量维度：1024
- 网络要求：能访问阿里云 API

#### Ollama（本地部署）

| 配置项 | 说明 |
|--------|------|
| OLLAMA_BASE_URL | Ollama 服务地址，默认 http://localhost:11434 |
| OLLAMA_VISION_MODEL | 视觉模型，推荐 llava |
| OLLAMA_EMBEDDING_MODEL | 嵌入模型，推荐 nomic-embed-text |

**特点**：
- 完全本地运行，无需网络
- 免费使用，无费用
- 需要先安装 Ollama 并下载模型

**推荐模型**：

| 用途 | 模型名称 | 向量维度 | 说明 |
|------|----------|----------|------|
| 视觉 | llava | - | 主流视觉模型，效果好 |
| 视觉 | bakllava | - | 基于 LLaVA 优化 |
| 视觉 | moondream | - | 轻量级，速度快 |
| 嵌入 | nomic-embed-text | 768 | 推荐使用，效果好 |
| 嵌入 | mxbai-embed-large | 1024 | 高维度向量 |

**安装 Ollama 模型**：
```bash
# 安装视觉模型
ollama pull llava

# 安装嵌入模型
ollama pull nomic-embed-text
```

### 8.3 默认账号

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
| 2026-03-24 | v1.2.0 | 架构重构与优化：<br>- **数据访问层重构**：引入 Repository 模式，所有数据库操作封装到统一模块，便于后期切换数据库<br>- **UI优化**：左侧菜单栏固定定位，滚动时保持可见<br>- **UI优化**：顶部导航栏搜索框移至右侧，集成搜索按钮<br>- **UI优化**：图片详情收藏按钮改为图标按钮，固定宽度避免切换时变形<br>- **UI优化**：图片详情新增上传用户名显示<br>- **Bug修复**：操作日志页面分页组件支持切换每页显示数量<br>- **文档更新**：完善回收站删除功能说明，彻底删除时同步删除物理文件 |
| 2026-03-24 | v1.3.0 | 上传功能增强：<br>- **实时进度显示**：批量上传时显示每张图片的独立处理进度<br>- **步骤级跟踪**：实时显示当前处理步骤（保存文件、生成缩略图、AI识别、生成向量等）<br>- **失败隔离**：单个图片处理失败不影响其他图片继续处理<br>- **错误详情**：失败的图片显示具体错误原因<br>- **SSE技术**：使用 Server-Sent Events 实现服务端实时推送进度 |
| 2026-03-24 | v1.4.0 | 上传功能优化与UI改进：<br>- **文件选择验证**：选择文件时自动验证格式、大小，不符合条件的文件标记显示<br>- **数量限制优化**：超过20张限制时自动标记超出部分，仅处理有效文件<br>- **无效文件管理**：无效文件单独显示在红色区域，可单独移除<br>- **本地预览**：上传前点击图片可在弹窗中预览本地文件<br>- **图片库统计**：图片库页面显示当前筛选条件下的总图片数量<br>- **分页样式修复**：当前页码使用白色文字，提升可读性 |
| 2026-03-24 | v1.5.0 | 语义搜索独立与UI美化：<br>- **语义搜索独立页面**：将语义搜索从图片库中独立出来，新增独立菜单入口<br>- **语义搜索增强**：支持Top K参数设置（默认10），支持分类、标签筛选，显示相似度百分比<br>- **图片详情组件化**：抽取ImageDetail.vue可复用组件，支持收藏、下载、删除、重新识别等操作<br>- **菜单图标美化**：使用有意义的SVG图标替换色块，包括仪表盘、图片库、语义搜索、上传、收藏等<br>- **搜索组件优化**：统一搜索框样式，优化聚焦效果，新增重置按钮 |
| 2026-03-24 | v1.6.0 | AI识别能力增强：<br>- **详细描述**：图片描述从一句话扩展为2-4句话，包含主体内容、场景环境、色彩构图、情感氛围<br>- **关键词增加**：关键词从3-5个扩展为8-15个，覆盖主体对象、场景环境、风格特点、色彩特点、情感氛围<br>- **文字识别**：新增图片文字识别功能，自动提取图片中的标题、标语、说明文字、水印等<br>- **分类关键词库扩展**：每个分类增加更多匹配关键词，提升分类准确性 |
| 2026-03-24 | v1.7.0 | 向量存储重构与语义搜索优化：<br>- **向量存储迁移**：向量数据从 JSON 文件迁移到 SQLite 数据库，新增 vectors 表存储向量数据<br>- **向量生成优化**：生成向量时将识别到的文字加入描述，提升语义搜索准确性<br>- **语义搜索修复**：修复相似度显示错误（distance 误用作 similarity），现在正确显示匹配度百分比<br>- **语义搜索交互**：支持 Enter 键搜索，Alt/Ctrl/Shift+Enter 换行<br>- **术语调整**：语义搜索界面将"相似度"改为"匹配度" |
| 2026-03-24 | v1.8.0 | UI增强与上传功能优化：<br>- **皮肤切换功能**：新增4种配色方案（典雅紫、科技蓝、清新绿、活力橙），支持一键切换<br>- **上传可选设置**：上传时可手动指定分类和标签，未指定则自动识别<br>- **公司品牌展示**：侧边栏底部显示公司Logo和版权信息"百珏科技" |
| 2026-03-24 | v1.9.0 | 用户功能增强与UI优化：<br>- **修改密码功能**：新增修改密码页面，用户可自主修改密码（需验证旧密码）<br>- **用户菜单优化**：用户下拉菜单改为"修改密码"和"退出登录"，移除个人信息入口<br>- **用户信息样式**：悬停背景改为固定高度，避免占满导航栏 |
| 2026-03-24 | v2.0.0 | 用户体系与权限管理重大升级：<br>- **用户信息扩展**：新增用户名称、说明、上传限额、可用状态、有效期（生效日期/失效日期）等字段<br>- **用户类型**：支持管理员和普通用户两种类型，管理员可编辑用户类型<br>- **有效期控制**：支持设置生效日期和失效日期，空值表示不限制，非有效期范围内禁止登录<br>- **状态控制**：用户可被禁用，禁用后无法登录<br>- **上传限额**：管理员可设置用户上传限额（默认100张），超出限额禁止上传<br>- **权限控制**：普通用户不能访问用户管理和操作日志；分类/标签仅可查看；只能删除自己上传的图片；不能使用重新识别功能<br>- **admin保护**：admin用户不可删除，不可修改状态/有效期/类型，仅允许修改名称和说明 |
| 2026-03-24 | v2.1.0 | 上传与权限控制优化：<br>- **上传数量调整**：单次上传数量限制从20张调整为100张<br>- **配额显示优化**：管理员显示已上传张数，普通用户显示配额使用情况（已传/限额/剩余）<br>- **配额前端校验**：选择文件时前端实时校验剩余配额，超出部分自动标记为无效<br>- **删除权限统一**：图片库、语义搜索、收藏页面统一删除逻辑，管理员可删除所有图片，普通用户仅可删除自己上传的图片<br>- **重新识别权限**：重新识别功能统一为仅管理员可用<br>- **语义搜索卡片**：搜索结果卡片增加收藏、下载、删除操作按钮，与图片库卡片样式一致 |
| 2026-03-25 | v2.2.0 | 系统功能完善与部署优化：<br>- **系统信息页面**：新增管理员专属页面，显示配置变量（API Key中间打码）、系统统计、用户排名<br>- **发布脚本**：新增 `npm run release` 命令，一键打包生产环境所需文件到 `release/` 目录<br>- **HOST配置**：新增 HOST 环境变量，支持配置监听地址（默认 0.0.0.0 监听所有网卡）<br>- **图片选择优化**：网格视图下复选框移至卡片底部文字区域，点击整个文字区域即可选中<br>- **图片详情布局**：右侧信息栏可滚动，下载和重新识别按钮固定在底部<br>- **回收站错误处理**：清空回收站时文件被占用不会中断流程，跳过失败文件继续删除<br>- **登录界面修复**：修复密码输入框图标悬停消失问题，改用组件 prefix 插槽 |
| 2026-03-25 | v2.3.0 | 收藏功能重构（用户级别收藏）：<br>- **收藏表新增**：新增 `favorites` 表，存储用户-图片收藏关系，支持多用户独立收藏<br>- **收藏逻辑重构**：收藏状态从图片全局属性改为用户级别，每个用户有独立的收藏列表<br>- **API新增**：新增 `/api/favorites` 接口，获取当前用户收藏列表和数量<br>- **级联删除**：图片彻底删除时自动删除相关收藏记录，用户删除时自动删除其收藏记录<br>- **FavoriteRepository**：新增收藏数据访问层，封装收藏的增删查操作 |
| 2026-03-25 | v2.4.0 | AI 服务架构重构（多提供商支持）：<br>- **AI Provider 抽象层**：引入 Provider 模式，支持多种 AI 提供商<br>- **Ollama 支持**：新增 Ollama 本地部署支持，可完全离线运行，无 API 费用<br>- **配置切换**：通过 `AI_PROVIDER` 环境变量切换 DashScope 或 Ollama<br>- **Ollama 配置项**：支持配置服务地址、视觉模型（推荐 llava）、嵌入模型（推荐 nomic-embed-text）<br>- **向量维度兼容**：不同嵌入模型支持不同向量维度（DashScope 1024，nomic-embed-text 768）<br>- **代码结构优化**：services/ai/ 目录下按提供商组织代码 |
| 2026-03-25 | v2.5.0 | 时间显示优化（UTC 转本地时间）：<br>- **时间工具函数**：新增 `client/src/utils/date.js` 工具模块，统一处理时间转换<br>- **UTC 转本地时间**：所有时间字段（创建时间、更新时间、删除时间、有效期）自动转换为本地时间显示<br>- **支持的格式**：自动识别 ISO 格式（带 Z 或时区）和纯 UTC 时间字符串<br>- **日期选择器支持**：有效期选择时自动转换为本地时间，提交时转回 UTC<br>- **涉及页面**：图片库、仪表盘、图片详情、操作日志、回收站、用户管理 |
| 2026-03-26 | v3.0.0 | 数据库迁移至 PostgreSQL + pgvector：<br>- **数据库迁移**：从 SQLite (sql.js) 迁移到 PostgreSQL<br>- **向量存储优化**：使用 pgvector 扩展替代 JSON 存储，支持原生向量搜索<br>- **索引优化**：使用 HNSW 索引，大幅提升向量搜索性能<br>- **动态维度**：支持通过环境变量配置向量维度，兼容不同 Embedding 模型<br>- **连接池**：使用 PostgreSQL 连接池管理数据库连接<br>- **SQL 语法适配**：所有 SQL 语句适配 PostgreSQL 语法（$1, $2 参数占位符等）<br>- **新增配置项**：PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD, EMBEDDING_DIMENSION<br>- **管理接口**：新增 /api/system/vector-dimension 和 /api/system/rebuild-vectors 接口 |
| 2026-03-26 | v3.1.0 | 文件存储架构升级（多存储支持）：<br>- **Storage Provider 抽象层**：引入 Provider 模式，支持多种存储方式<br>- **MinIO 支持**：新增 MinIO 对象存储支持，兼容 S3 协议<br>- **本地存储封装**：现有本地存储封装为 LocalStorageProvider<br>- **配置切换**：通过 `STORAGE_TYPE` 环境变量切换本地存储或 MinIO<br>- **MinIO 配置项**：MINIO_ENDPOINT, MINIO_PORT, MINIO_USE_SSL, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_PUBLIC_URL<br>- **公开访问模式**：MinIO bucket 设置为 public，URL 直接可用<br>- **代码结构优化**：services/storage/ 目录下按存储类型组织代码 |
| 2026-03-26 | v3.2.0 | 图片 URL 返回优化：<br>- **完整 URL 返回**：后端 Repository 层自动为图片添加完整访问 URL（file_url、thumbnail_url）<br>- **前端适配**：所有前端页面使用后端返回的 file_url 和 thumbnail_url，支持 MinIO 和本地存储<br>- **环境变量修复**：修复 .env 文件中包含 # 符号的密码被截断问题，需用引号包裹 |
| 2026-03-26 | v3.3.0 | AI 分类逻辑优化：<br>- **动态分类列表**：AI 分析时从数据库读取所有分类，动态构建 prompt<br>- **模型直接分类**：让 AI 模型根据预设分类直接输出最合适的分类名称<br>- **智能匹配**：支持精确匹配和模糊匹配，匹配不到时自动归入"其他"<br>- **灵活扩展**：新增分类无需修改代码，AI 自动识别新分类 |
| 2026-03-26 | v3.4.0 | AI 绘图提示词生成功能：<br>- **生成提示词**：在图片详情弹窗新增"生成提示词"按钮，调用 AI 分析图片<br>- **多维度分析**：从主体描述、构图视角、光影效果、色彩特征、艺术风格、画质细节等维度生成详细中文提示词<br>- **正向/反向提示词**：生成详细的正向提示词和反向提示词<br>- **参数建议**：推荐画幅比例和风格类型<br>- **一键复制**：支持一键复制全部提示词到剪贴板<br>- **弹窗优化**：提示词弹窗居中显示，固定高度内容可滚动 |
| 2026-03-27 | v3.5.0 | 时间处理优化：<br>- **本地时间存储**：数据库时间字段统一使用本地时间存储，不再进行 UTC 转换<br>- **时区配置**：新增 `TZ` 环境变量，支持配置系统时区（默认 Asia/Shanghai）<br>- **前端适配**：前端时间显示直接使用数据库返回的时间字符串，无需转换<br>- **pg 驱动配置**：配置 pg 驱动返回字符串而非 Date 对象，避免 JSON 序列化时的 UTC 转换 |
| 2026-03-27 | v3.6.0 | 部署配置优化：<br>- **BASE_URL 支持**：支持配置访问路径前缀，适配 nginx 反向代理子路径部署<br>- **前端配置**：`VITE_BASE_URL` 环境变量配置前端基础路径<br>- **后端配置**：`BASE_URL` 环境变量配置后端 API 路径前缀<br>- **nginx 配置示例**：新增 `nginx.conf.example` 文件，提供 nginx 配置参考 |
| 2026-03-27 | v3.7.0 | 提示词生成增强：<br>- **文案与布局分析**：提示词生成新增 textAndLayout 字段，详细描述图片内容布局和文案布局<br>- **智能文案检测**：如图片包含文案，生成专门的文案与布局描述；如无文案，仅描述内容布局<br>- **更精准的提示词**：文案内容融入提示词，帮助 AI 绘图工具生成更接近原图的效果 |