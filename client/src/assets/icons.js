// 菜单图标 SVG 路径定义
// viewBox: "0 0 24 24"

export const menuIcons = {
  // 仪表盘 - 时钟/仪表图标
  dashboard: {
    svgPath: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
    color: '#6366f1'
  },

  // 图片库 - 网格/画廊图标
  images: {
    svgPath: '<rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>',
    color: '#10b981'
  },

  // 语义搜索 - 灯泡/大脑图标
  semanticSearch: {
    svgPath: '<path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 21h6M10 17v4M14 17v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    color: '#f59e0b'
  },

  // 上传图片 - 向上箭头图标
  upload: {
    svgPath: '<path d="M12 3v12m0-12l-4 4m4-4l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    color: '#f59e0b'
  },

  // 我的收藏 - 心形图标
  favorites: {
    svgPath: '<path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.18L12 21z" fill="currentColor"/>',
    color: '#ef4444'
  },

  // 分类管理 - 文件夹图标
  categories: {
    svgPath: '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" fill="none" stroke="currentColor" stroke-width="2"/>',
    color: '#8b5cf6'
  },

  // 标签管理 - 标签图标
  tags: {
    svgPath: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="7" r="2" fill="currentColor"/>',
    color: '#06b6d4'
  },

  // 回收站 - 垃圾桶图标
  trash: {
    svgPath: '<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    color: '#94a3b8'
  },

  // 操作日志 - 文档图标
  logs: {
    svgPath: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="14,2 14,8 20,8" fill="none" stroke="currentColor" stroke-width="2"/><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="10" y1="9" x2="8" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    color: '#64748b'
  },

  // 用户管理 - 人物图标
  users: {
    svgPath: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    color: '#ec4899'
  }
}

// 统计卡片图标
export const statIcons = {
  // 图片总数
  images: {
    svgPath: '<rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>',
    color: '#6366f1'
  },

  // 分类数量
  categories: {
    svgPath: '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" fill="none" stroke="currentColor" stroke-width="2"/>',
    color: '#10b981'
  },

  // 标签数量
  tags: {
    svgPath: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="7" r="2" fill="currentColor"/>',
    color: '#f59e0b'
  },

  // 收藏数量
  favorites: {
    svgPath: '<path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.18L12 21z" fill="currentColor"/>',
    color: '#ef4444'
  }
}

// 快捷操作图标
export const actionIcons = {
  // 上传
  upload: {
    svgPath: '<path d="M12 3v12m0-12l-4 4m4-4l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  },

  // 浏览
  browse: {
    svgPath: '<rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>'
  },

  // 分类
  category: {
    svgPath: '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" fill="none" stroke="currentColor" stroke-width="2"/>'
  },

  // 标签
  tag: {
    svgPath: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="7" r="2" fill="currentColor"/>'
  }
}