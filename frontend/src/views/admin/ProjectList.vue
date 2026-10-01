<template>
  <div>
    <h2 class="page-title">用户项目</h2>

    <div class="search-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索项目名称"
        clearable
        class="search-input"
        @keyup.enter="doSearch"
        @clear="doSearch"
      >
        <template #prefix>
          <Search :size="16" class="search-icon" />
        </template>
      </el-input>
      <el-select v-model="searchStatus" placeholder="全部状态" clearable class="search-select" @change="doSearch">
        <el-option label="全部状态" value="" />
        <el-option label="草稿" value="DRAFT" />
        <el-option label="已提交" value="SUBMITTED" />
      </el-select>
      <el-button type="primary" @click="doSearch">搜索</el-button>
      <span class="search-result-count" v-if="projects.length > 0">共 {{ projects.length }} 个项目</span>
    </div>

    <el-table :data="projects" border stripe style="width: 100%; margin-top: 16px" v-loading="loading">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="title" label="项目名称" min-width="160">
        <template #default="{ row }">
          <span class="project-title">{{ row.title }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="userId" label="用户ID" width="100" />
      <el-table-column prop="templateId" label="模板ID" width="100" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'SUBMITTED' ? 'success' : 'warning'">
            {{ row.status === 'SUBMITTED' ? '已提交' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="submittedAt" label="提交时间" width="180">
        <template #default="{ row }">
          {{ row.submittedAt || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180" />
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'SUBMITTED'" size="small" @click="preview(row.id)">
            预览H5
          </el-button>
          <el-button size="small" type="primary" @click="viewDetail(row)">
            查看详情
          </el-button>
          <el-button size="small" type="danger" @click="remove(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && projects.length === 0" description="暂无项目数据" />

    <el-dialog v-model="detailDialog" title="项目详情" width="800px">
      <div v-if="currentProject" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="项目名称">{{ currentProject.title }}</el-descriptions-item>
          <el-descriptions-item label="用户ID">{{ currentProject.userId }}</el-descriptions-item>
          <el-descriptions-item label="模板ID">{{ currentProject.templateId }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentProject.status === 'SUBMITTED' ? 'success' : 'warning'" size="small">
              {{ currentProject.status === 'SUBMITTED' ? '已提交' : '草稿' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ currentProject.submittedAt || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ currentProject.createdAt || '-' }}</el-descriptions-item>
        </el-descriptions>
        <div class="page-preview-grid" style="margin-top: 16px">
          <div v-for="page in detailPages" :key="page.id" class="detail-page-item">
            <img v-if="page.previewUrl" :src="page.previewUrl" />
            <span v-else>第{{ page.pageNumber }}页</span>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAdminProjects, getAdminProjectPages, deleteAdminProject } from '@/api/project'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@lucide/vue'

const projects = ref([])
const loading = ref(false)
const searchKeyword = ref('')
const searchStatus = ref('')
const detailDialog = ref(false)
const currentProject = ref(null)
const detailPages = ref([])

onMounted(() => {
  doSearch()
})

async function doSearch() {
  loading.value = true
  try {
    const params = {}
    if (searchKeyword.value) params.keyword = searchKeyword.value
    if (searchStatus.value) params.status = searchStatus.value
    const res = await getAdminProjects(params)
    projects.value = res.data.data || []
  } catch (e) {
    projects.value = []
  } finally {
    loading.value = false
  }
}

function preview(id) {
  window.open(`/api/h5/projects/${id}`, '_blank')
}

async function viewDetail(row) {
  currentProject.value = row
  try {
    const res = await getAdminProjectPages(row.id)
    detailPages.value = res.data.data || []
  } catch (e) {
    detailPages.value = []
  }
  detailDialog.value = true
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除项目"${row.title}"（ID: ${row.id}）？此操作不可恢复。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    await deleteAdminProject(row.id)
    ElMessage.success('项目已删除')
    await doSearch()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}
</script>

<style scoped>
.page-title {
  font-size: 26px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.02em;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 24px;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.search-input {
  width: 260px;
}

.search-select {
  width: 140px;
}

.search-icon {
  color: rgba(0, 0, 0, 0.3);
}

.search-result-count {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.4);
  margin-left: 8px;
  font-weight: 500;
}

.project-title {
  font-weight: 500;
  color: rgba(0, 0, 0, 0.8);
}

.page-preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.detail-page-item {
  width: 120px;
  height: 160px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
  background: rgba(0, 0, 0, 0.02);
}

.detail-page-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (max-width: 768px) {
  .page-title {
    font-size: 22px;
  }

  .search-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 14px;
    margin-top: 16px;
  }

  .search-input,
  .search-select {
    width: 100% !important;
  }

  .search-result-count {
    margin-left: 0;
    text-align: center;
  }

  .page-preview-grid {
    max-height: 300px;
  }

  .detail-page-item {
    width: 80px;
    height: 110px;
  }
}

@media (max-width: 480px) {
  .page-title {
    font-size: 20px;
  }

  .search-bar {
    padding: 10px;
    border-radius: 8px;
  }

  .detail-page-item {
    width: 70px;
    height: 95px;
  }
}
</style>