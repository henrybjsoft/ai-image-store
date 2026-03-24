<template>
  <div class="categories-page">
    <div class="page-header">
      <div class="header-content">
        <h2>分类管理</h2>
        <p>{{ userStore.isAdmin ? '管理图片分类，支持两级结构' : '查看图片分类' }}</p>
      </div>
      <a-button v-if="userStore.isAdmin" type="primary" @click="showAddModal(null)">
        <PlusOutlined /> 添加分类
      </a-button>
    </div>

    <div class="category-grid">
      <div v-for="category in categories" :key="category.id" class="category-card">
        <div class="category-header">
          <div class="category-icon">
            <FolderOutlined />
          </div>
          <div class="category-title">{{ category.name }}</div>
          <div v-if="userStore.isAdmin" class="category-actions">
            <a-button type="text" size="small" @click="showAddModal(category)">
              <PlusOutlined />
            </a-button>
            <a-button type="text" size="small" @click="showEditModal(category)">
              <EditOutlined />
            </a-button>
            <a-popconfirm title="确定删除此分类？" @confirm="handleDelete(category)">
              <a-button type="text" size="small" danger>
                <DeleteOutlined />
              </a-button>
            </a-popconfirm>
          </div>
        </div>
        <div v-if="category.children?.length" class="subcategory-list">
          <div v-for="child in category.children" :key="child.id" class="subcategory-item">
            <span class="subcategory-name">{{ child.name }}</span>
            <div v-if="userStore.isAdmin" class="subcategory-actions">
              <a-button type="text" size="small" @click="showEditModal(child)">
                <EditOutlined />
              </a-button>
              <a-popconfirm title="确定删除？" @confirm="handleDelete(child)">
                <a-button type="text" size="small" danger>
                  <DeleteOutlined />
                </a-button>
              </a-popconfirm>
            </div>
          </div>
        </div>
        <div v-else class="no-subcategory">
          <span>暂无子分类</span>
        </div>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingCategory ? '编辑分类' : (parentCategory ? '添加子分类' : '添加一级分类')"
      @ok="handleSubmit"
      class="category-modal"
    >
      <a-form layout="vertical">
        <a-form-item label="分类名称" required>
          <a-input v-model:value="formState.name" placeholder="请输入分类名称" size="large" />
        </a-form-item>
        <a-form-item v-if="parentCategory" label="父分类">
          <a-input :value="parentCategory.name" disabled />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, FolderOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { categoryApi } from '@/api/category'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const loading = ref(false)
const categories = ref([])
const modalVisible = ref(false)
const editingCategory = ref(null)
const parentCategory = ref(null)

const formState = reactive({
  name: ''
})

onMounted(() => {
  loadCategories()
})

async function loadCategories() {
  loading.value = true
  try {
    const res = await categoryApi.getTree()
    categories.value = res.data || []
  } finally {
    loading.value = false
  }
}

function showAddModal(parent) {
  parentCategory.value = parent
  editingCategory.value = null
  formState.name = ''
  modalVisible.value = true
}

function showEditModal(category) {
  parentCategory.value = categories.value.find(c => c.id === category.parent_id)
  editingCategory.value = category
  formState.name = category.name
  modalVisible.value = true
}

async function handleSubmit() {
  if (!formState.name.trim()) {
    message.warning('请输入分类名称')
    return
  }

  try {
    if (editingCategory.value) {
      await categoryApi.update(editingCategory.value.id, { name: formState.name })
      message.success('分类更新成功')
    } else {
      await categoryApi.create({
        name: formState.name,
        parent_id: parentCategory.value?.id || null
      })
      message.success('分类创建成功')
    }
    modalVisible.value = false
    loadCategories()
  } catch (error) {
    message.error('操作失败')
  }
}

async function handleDelete(category) {
  try {
    await categoryApi.delete(category.id)
    message.success('分类删除成功')
    loadCategories()
  } catch (error) {
    message.error(error.response?.data?.message || '删除失败')
  }
}
</script>

<style scoped>
.categories-page {
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

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.category-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.category-card:hover {
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.category-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, var(--primary-color, #6366f1) 0%, var(--secondary-color, #8b5cf6) 100%);
  color: white;
}

.category-icon {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.category-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
}

.category-actions {
  display: flex;
  gap: 4px;
}

.category-actions .ant-btn {
  color: rgba(255, 255, 255, 0.8);
}

.category-actions .ant-btn:hover {
  color: white;
}

.subcategory-list {
  padding: 12px;
}

.subcategory-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.subcategory-item:hover {
  background: #f8fafc;
}

.subcategory-name {
  font-size: 14px;
  color: #1e293b;
}

.subcategory-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.subcategory-item:hover .subcategory-actions {
  opacity: 1;
}

.no-subcategory {
  padding: 20px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.category-modal :deep(.ant-input) {
  border-radius: 10px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>