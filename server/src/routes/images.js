const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const { ImageRepository, TagRepository, CategoryRepository, LogRepository, UserRepository, FavoriteRepository } = require('../repository');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const { processImageWithAI, getEmbedding, generateImagePrompt } = require('../services/aiService');
const { addImageVector, removeImageVector, buildEmbeddingText } = require('../services/vectorService');
const { getStorage, isLocalStorage } = require('../services/storage');

const router = express.Router();

// 获取 MIME 类型
function getMimeType(ext) {
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
  };
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

// 修复中文文件名乱码 - multer 使用 latin1 编码，需要转换为 utf8
function decodeFilename(originalname) {
  try {
    return Buffer.from(originalname, 'latin1').toString('utf8');
  } catch {
    return originalname;
  }
}

// 内存存储用于上传
const memoryStorage = multer.memoryStorage();

const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;
const MAX_FILES = parseInt(process.env.MAX_FILES) || 100;

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  if (ALLOWED_FORMATS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件格式: ${ext}`));
  }
};

const uploadMemory = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES
  }
});

// 创建缩略图
async function createThumbnail(buffer, filename) {
  try {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.svg') {
      return null; // SVG 不生成缩略图
    }

    const thumbnailFilename = `thumb_${path.basename(filename, ext)}.jpg`;
    const thumbnailKey = `thumbnails/${thumbnailFilename}`;

    const thumbnailSize = parseInt(process.env.THUMBNAIL_SIZE) || 400;
    const thumbnailQuality = parseInt(process.env.THUMBNAIL_QUALITY) || 80;

    const thumbnailBuffer = await sharp(buffer)
      .rotate() // 根据 EXIF 方向自动旋转
      .resize(thumbnailSize, thumbnailSize, { fit: 'inside' })
      .jpeg({ quality: thumbnailQuality })
      .toBuffer();

    return { key: thumbnailKey, buffer: thumbnailBuffer };
  } catch (error) {
    console.error('创建缩略图失败:', error);
    return null;
  }
}

// 修正图片方向（根据 EXIF 信息旋转并去除方向标签）
async function fixImageOrientation(buffer, ext) {
  try {
    // 只处理 JPEG 和 PNG 图片
    if (!['.jpg', '.jpeg', '.png'].includes(ext.toLowerCase())) {
      return buffer;
    }

    const image = sharp(buffer);
    const metadata = await image.metadata();

    // 如果有 EXIF 方向信息且不是 1（正常方向）
    if (metadata.orientation && metadata.orientation !== 1) {
      // 读取图片，旋转到正确方向，去除 EXIF 方向信息
      return await image
        .rotate()
        .withMetadata({ orientation: 1 })
        .toBuffer();
    }

    return buffer;
  } catch (error) {
    console.error('修正图片方向失败:', error);
    return buffer;
  }
}

// 获取图片尺寸
async function getImageDimensions(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    return { width: null, height: null };
  }
}

// 辅助函数：为图片添加标签信息
async function enrichImageWithTags(image) {
  if (image) {
    image.tags = await ImageRepository.getTags(image.id);
    if (image.keywords) {
      try {
        image.keywords = JSON.parse(image.keywords);
      } catch (e) {
        image.keywords = [];
      }
    }
  }
  return image;
}

// SSE 进度上传接口
router.post('/upload-progress', authenticateToken, uploadMemory.array('images', MAX_FILES), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件'
      });
    }

    // 检查上传限额（普通用户）
    if (req.user.role !== 'admin') {
      const user = await UserRepository.findById(req.user.id);
      const quota = user.quota || 0;
      if (quota > 0) {
        const currentCount = await UserRepository.getImageCount(req.user.id);
        if (currentCount + req.files.length > quota) {
          return res.status(400).json({
            success: false,
            message: `上传数量超出限额。当前已上传 ${currentCount} 张，限额 ${quota} 张，本次上传 ${req.files.length} 张`
          });
        }
      }
    }

    // 解析可选的分类和标签
    const manualCategoryId = req.body.categoryId ? parseInt(req.body.categoryId) : null;
    const manualTagIds = req.body.tagIds ? JSON.parse(req.body.tagIds) : [];

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendProgress = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const totalFiles = req.files.length;
    const results = [];
    const CONCURRENCY = parseInt(process.env.UPLOAD_CONCURRENCY) || 5;
    const storage = getStorage();

    // 发送初始状态
    sendProgress({ type: 'start', total: totalFiles });

    // 并发控制器
    class ConcurrencyLimit {
      constructor(limit) {
        this.limit = limit;
        this.running = 0;
        this.queue = [];
      }

      async run(fn) {
        while (this.running >= this.limit) {
          await new Promise(resolve => this.queue.push(resolve));
        }
        this.running++;
        try {
          return await fn();
        } finally {
          this.running--;
          const next = this.queue.shift();
          if (next) next();
        }
      }
    }

    const limiter = new ConcurrencyLimit(CONCURRENCY);

    // 处理单个文件的函数
    async function processFile(file, fileIndex) {
      const originalName = decodeFilename(file.originalname);

      try {
        // 步骤1: 准备文件
        sendProgress({
          type: 'progress',
          fileIndex,
          fileName: originalName,
          step: 'saving',
          stepText: '保存文件中...',
          progress: 0
        });

        const ext = path.extname(originalName).toLowerCase();
        const filename = `${uuidv4()}${ext}`;
        const yearMonth = new Date().toISOString().slice(0, 7);
        const fileKey = `${yearMonth}/${filename}`;

        // 修正图片方向
        let imageBuffer = await fixImageOrientation(file.buffer, ext);

        // 步骤2: 获取图片尺寸
        sendProgress({
          type: 'progress',
          fileIndex,
          fileName: originalName,
          step: 'dimensions',
          stepText: '获取图片信息...',
          progress: 20
        });

        const dimensions = await getImageDimensions(imageBuffer);

        // 步骤3: 创建缩略图
        sendProgress({
          type: 'progress',
          fileIndex,
          fileName: originalName,
          step: 'thumbnail',
          stepText: '生成缩略图...',
          progress: 30
        });

        const thumbnail = await createThumbnail(imageBuffer, filename);

        // 步骤4: 上传到存储
        sendProgress({
          type: 'progress',
          fileIndex,
          fileName: originalName,
          step: 'uploading',
          stepText: '上传到存储...',
          progress: 40
        });

        // 上传原图
        await storage.uploadBuffer(imageBuffer, fileKey, {
          contentType: getMimeType(ext)
        });

        // 上传缩略图
        let thumbnailKey = null;
        if (thumbnail) {
          await storage.uploadBuffer(thumbnail.buffer, thumbnail.key, {
            contentType: 'image/jpeg'
          });
          thumbnailKey = thumbnail.key;
        }

        // 步骤5: AI 识别
        sendProgress({
          type: 'progress',
          fileIndex,
          fileName: originalName,
          step: 'ai',
          stepText: 'AI 识别中...',
          progress: 60
        });

        const aiResult = await processImageWithAI(imageBuffer);

        // 步骤6: 保存到数据库
        sendProgress({
          type: 'progress',
          fileIndex,
          fileName: originalName,
          step: 'database',
          stepText: '保存到数据库...',
          progress: 80
        });

        // 如果用户手动指定了分类，则使用手动指定的分类，否则使用AI识别的分类
        const finalCategoryId = manualCategoryId || aiResult.categoryId;

        const imageId = await ImageRepository.create({
          filename,
          originalName,
          filePath: fileKey,
          thumbnailPath: thumbnailKey,
          fileSize: file.size,
          fileFormat: ext.slice(1),
          width: dimensions.width,
          height: dimensions.height,
          description: aiResult.description,
          keywords: JSON.stringify(aiResult.keywords),
          categoryId: finalCategoryId,
          uploadedBy: req.user.id,
          extractedText: aiResult.extractedText
        });

        // 如果用户手动指定了标签，则添加这些标签
        if (manualTagIds && manualTagIds.length > 0) {
          for (const tagId of manualTagIds) {
            await ImageRepository.addTag(imageId, tagId);
          }
        }

        // 步骤7: 生成向量
        sendProgress({
          type: 'progress',
          fileIndex,
          fileName: originalName,
          step: 'vector',
          stepText: '生成向量...',
          progress: 90
        });

        const embedding = await getEmbedding(buildEmbeddingText(aiResult.description, aiResult.extractedText));
        await addImageVector(imageId, embedding, req.user.id);

        // 完成
        results.push({
          id: imageId,
          filename,
          original_name: originalName,
          success: true
        });

        sendProgress({
          type: 'complete',
          fileIndex,
          fileName: originalName,
          progress: 100,
          result: {
            id: imageId,
            success: true
          }
        });

        await LogRepository.create(req.user.id, 'upload_image', 'image', imageId, `上传图片: ${originalName}`, req.ip);

        return { success: true, imageId };
      } catch (error) {
        console.error('处理图片失败:', error);
        results.push({
          original_name: originalName,
          success: false,
          error: error.message
        });

        sendProgress({
          type: 'error',
          fileIndex,
          fileName: originalName,
          error: error.message
        });

        return { success: false, error: error.message };
      }
    }

    // 并发处理所有文件
    const promises = req.files.map((file, index) =>
      limiter.run(() => processFile(file, index))
    );

    await Promise.all(promises);

    // 发送最终结果
    sendProgress({
      type: 'done',
      total: totalFiles,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });

    res.end();
  } catch (error) {
    console.error('上传图片错误:', error);
    res.status(500).json({
      success: false,
      message: error.message || '上传图片失败'
    });
  }
});

// 批量上传图片（保留原接口兼容）
router.post('/upload', authenticateToken, uploadMemory.array('images', MAX_FILES), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件'
      });
    }

    // 解析可选的分类和标签
    const manualCategoryId = req.body.categoryId ? parseInt(req.body.categoryId) : null;
    const manualTagIds = req.body.tagIds ? JSON.parse(req.body.tagIds) : [];

    const storage = getStorage();
    const results = [];

    for (const file of req.files) {
      try {
        // 修复中文文件名乱码
        const originalName = decodeFilename(file.originalname);
        const ext = path.extname(originalName).toLowerCase();
        const filename = `${uuidv4()}${ext}`;
        const yearMonth = new Date().toISOString().slice(0, 7);
        const fileKey = `${yearMonth}/${filename}`;

        // 修正图片方向
        let imageBuffer = await fixImageOrientation(file.buffer, ext);

        // 获取图片尺寸
        const dimensions = await getImageDimensions(imageBuffer);

        // 创建缩略图
        const thumbnail = await createThumbnail(imageBuffer, filename);

        // 上传到存储
        await storage.uploadBuffer(imageBuffer, fileKey, {
          contentType: getMimeType(ext)
        });

        let thumbnailKey = null;
        if (thumbnail) {
          await storage.uploadBuffer(thumbnail.buffer, thumbnail.key, {
            contentType: 'image/jpeg'
          });
          thumbnailKey = thumbnail.key;
        }

        // AI 识别
        const aiResult = await processImageWithAI(imageBuffer);

        // 保存到数据库
        const finalCategoryId = manualCategoryId || aiResult.categoryId;

        const imageId = await ImageRepository.create({
          filename,
          originalName,
          filePath: fileKey,
          thumbnailPath: thumbnailKey,
          fileSize: file.size,
          fileFormat: ext.slice(1),
          width: dimensions.width,
          height: dimensions.height,
          description: aiResult.description,
          keywords: JSON.stringify(aiResult.keywords),
          categoryId: finalCategoryId,
          uploadedBy: req.user.id,
          extractedText: aiResult.extractedText
        });

        // 添加标签
        if (manualTagIds && manualTagIds.length > 0) {
          for (const tagId of manualTagIds) {
            await ImageRepository.addTag(imageId, tagId);
          }
        }

        // 生成向量
        const embedding = await getEmbedding(buildEmbeddingText(aiResult.description, aiResult.extractedText));
        await addImageVector(imageId, embedding, req.user.id);

        results.push({
          id: imageId,
          filename,
          original_name: originalName,
          success: true
        });

        await LogRepository.create(req.user.id, 'upload_image', 'image', imageId, `上传图片: ${originalName}`, req.ip);
      } catch (error) {
        console.error('处理图片失败:', error);
        const originalName = decodeFilename(file.originalname);
        results.push({
          original_name: originalName,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `成功上传 ${results.filter(r => r.success).length}/${req.files.length} 张图片`,
      data: results
    });
  } catch (error) {
    console.error('上传图片错误:', error);
    res.status(500).json({
      success: false,
      message: error.message || '上传图片失败'
    });
  }
});

// 获取图片列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      categoryId,
      keyword,
      uploadedBy,
      page = 1,
      pageSize = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const result = await ImageRepository.findList({
      categoryId,
      userId: req.user.id,
      keyword,
      uploadedBy,
      page,
      pageSize,
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取图片列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取图片列表失败'
    });
  }
});

// 获取图片详情
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const image = await ImageRepository.findByIdWithDetails(id);

    if (!image || image.is_deleted) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    // 检查当前用户是否收藏
    image.is_favorite = await FavoriteRepository.isFavorited(req.user.id, parseInt(id)) ? 1 : 0;

    await enrichImageWithTags(image);

    res.json({
      success: true,
      data: image
    });
  } catch (error) {
    console.error('获取图片详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取图片详情失败'
    });
  }
});

// 更新图片信息
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, categoryId, keywords } = req.body;

    const image = await ImageRepository.findById(id);
    if (!image || image.is_deleted) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    await ImageRepository.update(id, {
      description,
      categoryId,
      keywords: keywords ? JSON.stringify(keywords) : null
    });

    await LogRepository.create(req.user.id, 'update_image', 'image', id, `更新图片信息`, req.ip);

    res.json({
      success: true,
      message: '图片信息更新成功'
    });
  } catch (error) {
    console.error('更新图片错误:', error);
    res.status(500).json({
      success: false,
      message: '更新图片失败'
    });
  }
});

// 删除图片（移入回收站）
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const image = await ImageRepository.findById(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    // 普通用户只能删除自己上传的图片
    if (req.user.role !== 'admin' && image.uploaded_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '权限不足，只能删除自己上传的图片'
      });
    }

    await ImageRepository.softDelete(id);

    await LogRepository.create(req.user.id, 'delete_image', 'image', id, `删除图片: ${image.original_name}`, req.ip);

    res.json({
      success: true,
      message: '图片已移入回收站'
    });
  } catch (error) {
    console.error('删除图片错误:', error);
    res.status(500).json({
      success: false,
      message: '删除图片失败'
    });
  }
});

// 批量删除
router.post('/batch-delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要删除的图片'
      });
    }

    // 普通用户只能删除自己上传的图片
    if (req.user.role !== 'admin') {
      const images = await ImageRepository.findByIds(ids);
      const notOwned = images.filter(img => img.uploaded_by !== req.user.id);
      if (notOwned.length > 0) {
        return res.status(403).json({
          success: false,
          message: '权限不足，只能删除自己上传的图片'
        });
      }
    }

    await ImageRepository.softDeleteBatch(ids);

    await LogRepository.create(req.user.id, 'batch_delete_images', 'image', null, `批量删除 ${ids.length} 张图片`, req.ip);

    res.json({
      success: true,
      message: `已删除 ${ids.length} 张图片`
    });
  } catch (error) {
    console.error('批量删除错误:', error);
    res.status(500).json({
      success: false,
      message: '批量删除失败'
    });
  }
});

// 下载单张图片
router.get('/download/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const image = await ImageRepository.findById(id);
    if (!image || image.is_deleted) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    const storage = getStorage();

    // 检查文件是否存在
    const exists = await storage.exists(image.file_path);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: '图片文件不存在'
      });
    }

    // 设置响应头
    res.setHeader('Content-Type', getMimeType(`.${image.file_format}`));
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(image.original_name)}`);

    // 获取文件流并传输
    const stream = await storage.getStream(image.file_path);
    stream.pipe(res);
  } catch (error) {
    console.error('下载图片错误:', error);
    res.status(500).json({
      success: false,
      message: '下载图片失败'
    });
  }
});

// 批量下载
router.post('/batch-download', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要下载的图片'
      });
    }

    const images = await ImageRepository.findByIds(ids);

    if (images.length === 0) {
      return res.status(404).json({
        success: false,
        message: '没有可下载的图片'
      });
    }

    const storage = getStorage();

    // 设置响应头
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=images_${Date.now()}.zip`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const image of images) {
      if (!image.is_deleted) {
        try {
          const exists = await storage.exists(image.file_path);
          if (exists) {
            const buffer = await storage.getBuffer(image.file_path);
            archive.append(buffer, { name: image.original_name });
          }
        } catch (e) {
          console.warn(`批量下载跳过文件: ${image.file_path}`, e.message);
        }
      }
    }

    archive.finalize();
  } catch (error) {
    console.error('批量下载错误:', error);
    res.status(500).json({
      success: false,
      message: '批量下载失败'
    });
  }
});

// 收藏/取消收藏
router.put('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const image = await ImageRepository.findById(id);
    if (!image || image.is_deleted) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    const isFavorited = await FavoriteRepository.toggle(req.user.id, parseInt(id));

    await LogRepository.create(req.user.id, isFavorited ? 'favorite_image' : 'unfavorite_image', 'image', id,
      `${isFavorited ? '收藏' : '取消收藏'}图片: ${image.original_name}`, req.ip);

    res.json({
      success: true,
      message: isFavorited ? '已收藏' : '已取消收藏',
      data: { is_favorite: isFavorited }
    });
  } catch (error) {
    console.error('收藏操作错误:', error);
    res.status(500).json({
      success: false,
      message: '收藏操作失败'
    });
  }
});

// 调整分类
router.put('/:id/category', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId } = req.body;

    const image = await ImageRepository.findById(id);
    if (!image || image.is_deleted) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    await ImageRepository.updateCategory(id, categoryId);

    await LogRepository.create(req.user.id, 'change_category', 'image', id, `调整图片分类: ${image.original_name}`, req.ip);

    res.json({
      success: true,
      message: '分类调整成功'
    });
  } catch (error) {
    console.error('调整分类错误:', error);
    res.status(500).json({
      success: false,
      message: '调整分类失败'
    });
  }
});

// 为图片添加标签
router.post('/:id/tags', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tagId } = req.body;

    const image = await ImageRepository.findById(id);
    if (!image || image.is_deleted) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    const tag = await TagRepository.findById(tagId);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: '标签不存在'
      });
    }

    const added = await ImageRepository.addTag(id, tagId);
    if (!added) {
      return res.status(400).json({
        success: false,
        message: '图片已有该标签'
      });
    }

    await LogRepository.create(req.user.id, 'add_tag', 'image', id, `为图片添加标签: ${tag.name}`, req.ip);

    res.json({
      success: true,
      message: '标签添加成功'
    });
  } catch (error) {
    console.error('添加标签错误:', error);
    res.status(500).json({
      success: false,
      message: '添加标签失败'
    });
  }
});

// 移除图片标签
router.delete('/:id/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const { id, tagId } = req.params;

    await ImageRepository.removeTag(id, tagId);

    await LogRepository.create(req.user.id, 'remove_tag', 'image', id, `移除图片标签`, req.ip);

    res.json({
      success: true,
      message: '标签移除成功'
    });
  } catch (error) {
    console.error('移除标签错误:', error);
    res.status(500).json({
      success: false,
      message: '移除标签失败'
    });
  }
});

// 重新识别图片（AI重新生成描述和关键词）- 仅管理员
router.post('/:id/reanalyze', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const image = await ImageRepository.findById(id);
    if (!image || image.is_deleted) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    const storage = getStorage();

    // 检查文件是否存在
    const exists = await storage.exists(image.file_path);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: '图片文件不存在'
      });
    }

    // 获取图片 Buffer
    const imageBuffer = await storage.getBuffer(image.file_path);

    // 调用 AI 重新识别
    const aiResult = await processImageWithAI(imageBuffer);

    // 更新数据库
    await ImageRepository.updateAIResult(id, {
      description: aiResult.description,
      keywords: JSON.stringify(aiResult.keywords),
      categoryId: aiResult.categoryId,
      extractedText: aiResult.extractedText
    });

    // 更新向量数据库
    await removeImageVector(id);
    const embedding = await getEmbedding(buildEmbeddingText(aiResult.description, aiResult.extractedText));
    await addImageVector(id, embedding, image.uploaded_by);

    await LogRepository.create(req.user.id, 'reanalyze_image', 'image', id, `重新识别图片: ${image.original_name}`, req.ip);

    res.json({
      success: true,
      message: '重新识别成功',
      data: {
        description: aiResult.description,
        keywords: aiResult.keywords,
        categoryId: aiResult.categoryId,
        categoryName: aiResult.categoryId ? await CategoryRepository.getNameById(aiResult.categoryId) : null,
        extractedText: aiResult.extractedText
      }
    });
  } catch (error) {
    console.error('重新识别图片错误:', error);
    res.status(500).json({
      success: false,
      message: '重新识别失败'
    });
  }
});

// 生成绘图提示词
router.post('/:id/generate-prompt', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const image = await ImageRepository.findById(id);
    if (!image || image.is_deleted) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    const storage = getStorage();

    // 检查文件是否存在
    const exists = await storage.exists(image.file_path);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: '图片文件不存在'
      });
    }

    // 获取图片 Buffer
    const imageBuffer = await storage.getBuffer(image.file_path);

    // 调用 AI 生成提示词
    const result = await generateImagePrompt(imageBuffer);

    await LogRepository.create(req.user.id, 'generate_prompt', 'image', id, `生成绘图提示词: ${image.original_name}`, req.ip);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('生成提示词错误:', error);
    res.status(500).json({
      success: false,
      message: error.message || '生成提示词失败'
    });
  }
});

module.exports = router;