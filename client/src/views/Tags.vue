<template>
  <div class="tags-page">
    <a-page-header title="标签管理">
      <template #extra>
        <a-button type="primary" @click="showAddModal">
          <PlusOutlined /> 添加标签
        </a-button>
      </template>
    </a-page-header>

    <a-table
      :columns="columns"
      :data-source="tags"
      :loading="loading"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'image_count'">
          <a-badge :count="record.image_count" :number-style="{ backgroundColor: '#52c41a' }" />
        </template>
        <template v-if="column.key === 'actions'">
          <a-space>
            <a-button type="link" size="small" @click="showEditModal(record)">编辑</a-button>
            <a-popconfirm title="确定删除此标签？" @confirm="handleDelete(record)">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 添加/编辑标签弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingTag ? '编辑标签' : '添加标签'"
      @ok="handleSubmit"
    >
      <a-form layout="vertical">
        <a-form-item label="标签名称" required>
          <a-input v-model:value="formState.name" placeholder="请输入标签名称" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { tagApi } from '@/api/tag'

const loading = ref(false)
const tags = ref([])
const modalVisible = ref(false)
const editingTag = ref(null)

const formState = reactive({
  name: ''
})

const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '标签名称', dataIndex: 'name' },
  { title: '关联图片数', key: 'image_count', width: 120 },
  { title: '创建时间', dataIndex: 'created_at', width: 180 },
  { title: '操作', key: 'actions', width: 150 }
]

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