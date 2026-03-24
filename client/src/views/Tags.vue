<template>
  <div class="tags-page">
    <div class="page-header">
      <div class="header-content">
        <h2>标签管理</h2>
        <p>管理图片标签，便于快速筛选</p>
      </div>
      <a-button type="primary" @click="showAddModal">
        <PlusOutlined /> 添加标签
      </a-button>
    </div>

    <div class="tags-grid">
      <div v-for="tag in tags" :key="tag.id" class="tag-card">
        <div class="tag-content">
          <div class="tag-icon">
            <TagOutlined />
          </div>
          <div class="tag-info">
            <div class="tag-name">{{ tag.name }}</div>
            <div class="tag-count">{{ tag.image_count || 0 }} 张图片</div>
          </div>
        </div>
        <div class="tag-actions">
          <a-button type="text" size="small" @click="showEditModal(tag)">
            <EditOutlined />
          </a-button>
          <a-popconfirm title="确定删除此标签？" @confirm="handleDelete(tag)">
            <a-button type="text" size="small" danger>
              <DeleteOutlined />
            </a-button>
          </a-popconfirm>
        </div>
      </div>
    </div>

    <div v-if="tags.length === 0 && !loading" class="empty-state">
      <div class="empty-icon">
        <TagOutlined />
      </div>
      <h3>暂无标签</h3>
      <p>创建标签以便对图片进行分类</p>
    </div>

    <!-- 添加/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingTag ? '编辑标签' : '添加标签'"
      @ok="handleSubmit"
    >
      <a-form layout="vertical">
        <a-form-item label="标签名称" required>
          <a-input v-model:value="formState.name" placeholder="请输入标签名称" size="large" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, TagOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { tagApi } from '@/api/tag'

const loading = ref(false)
const tags = ref([])
const modalVisible = ref(false)
const editingTag = ref(null)

const formState = reactive({
  name: ''
})

onMounted(() => {
  loadTags()
})

async function loadTags() {
  loading.value = true
  try {
    const res = await tagApi.getList()
    tags.value = res.data || []
  } finally {
    loading.value = false
  }
}

function showAddModal() {
  editingTag.value = null
  formState.name = ''
  modalVisible.value = true
}

function showEditModal(tag) {
  editingTag.value = tag
  formState.name = tag.name
  modalVisible.value = true
}

async function handleSubmit() {
  if (!formState.name.trim()) {
    message.warning('请输入标签名称')
    return
  }

  try {
    if (editingTag.value) {
      await tagApi.update(editingTag.value.id, { name: formState.name })
      message.success('标签更新成功')
    } else {
      await tagApi.create({ name: formState.name })
      message.success('标签创建成功')
    }
    modalVisible.value = false
    loadTags()
  } catch (error) {
    message.error('操作失败')
  }
}

async function handleDelete(tag) {
  try {
    await tagApi.delete(tag.id)
    message.success('标签删除成功')
    loadTags()
  } catch (error) {
    message.error('删除失败')
  }
}
</script>

<style scoped>
.tags-page {
  animation: fadeIn 0.3s ease;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-content h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
}

.header-content p {
  color: #64748b;
  font-size: 14px;
}

.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.tag-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.tag-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.tag-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.tag-icon {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
}

.tag-name {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

.tag-count {
  font-size: 13px;
  color: #64748b;
}

.tag-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.tag-card:hover .tag-actions {
  opacity: 1;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  background: white;
  border-radius: 24px;
}

.empty-icon {
  font-size: 64px;
  color: #e2e8f0;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 8px;
}

.empty-state p {
  color: #64748b;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>