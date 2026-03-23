<template>
  <div class="categories-page">
    <a-page-header title="分类管理">
      <template #extra>
        <a-button type="primary" @click="showAddModal(null)">
          <PlusOutlined /> 添加一级分类
        </a-button>
      </template>
    </a-page-header>

    <a-table
      :columns="columns"
      :data-source="flatCategories"
      :loading="loading"
      row-key="id"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <span :style="{ paddingLeft: record.level * 24 + 'px' }">
            {{ record.parent_id ? '└ ' : '' }}{{ record.name }}
          </span>
        </template>
        <template v-if="column.key === 'level'">
          <a-tag :color="record.parent_id ? 'blue' : 'green'">
            {{ record.parent_id ? '二级' : '一级' }}
          </a-tag>
        </template>
        <template v-if="column.key === 'actions'">
          <a-space>
            <a-button
              v-if="!record.parent_id"
              type="link"
              size="small"
              @click="showAddModal(record)"
            >
              添加子分类
            </a-button>
            <a-button type="link" size="small" @click="showEditModal(record)">
              编辑
            </a-button>
            <a-popconfirm title="确定删除此分类？" @confirm="handleDelete(record)">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 添加/编辑分类弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingCategory ? '编辑分类' : (parentCategory ? '添加子分类' : '添加一级分类')"
      @ok="handleSubmit"
    >
      <a-form layout="vertical">
        <a-form-item label="分类名称" required>
          <a-input v-model:value="formState.name" placeholder="请输入分类名称" />
        </a-form-item>
        <a-form-item v-if="parentCategory" label="父分类">
          <a-input :value="parentCategory.name" disabled />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { categoryApi } from '@/api/category'

const loading = ref(false)
const categories = ref([])
const modalVisible = ref(false)
const editingCategory = ref(null)
const parentCategory = ref(null)

const formState = reactive({
  name: ''
})

const columns = [
  { title: '分类名称', key: 'name' },
  { title: '级别', key: 'level', width: 100 },
  { title: '操作', key: 'actions', width: 200 }
]

const flatCategories = computed(() => {
  const result = []
  const flatten = (cats, level = 0) => {
    cats.forEach(cat => {
      result.push({ ...cat, level })
      if (cat.children?.length) {
        flatten(cat.children, level + 1)
      }
    })
  }
  flatten(categories.value)
  return result
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