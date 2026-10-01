<template>
  <div>
    <h2 class="page-title">导出素材</h2>
    <p class="desc">选择已提交的项目，批量导出用户上传的原图和贴纸素材</p>

    <el-table
      :data="projects"
      border
      stripe
      style="width: 100%; margin-top: 16px"
      @selection-change="handleSelectionChange"
      v-loading="loading"
    >
      <el-table-column type="selection" width="50" />
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="title" label="项目名称" />
      <el-table-column prop="userId" label="用户ID" width="80" />
      <el-table-column prop="submittedAt" label="提交时间" width="180" />
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button size="small" @click="exportSingle(row.id)">导出</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="export-actions">
      <el-button type="primary" :disabled="selectedIds.length === 0" @click="batchExport" :loading="exporting">
        批量导出 ({{ selectedIds.length }})
      </el-button>
      <span v-if="taskStatus === 'PROCESSING'" class="export-status processing">
        <el-icon class="is-loading"><Loading /></el-icon> 正在导出中...
      </span>
      <span v-if="downloadUrl" class="export-status done">
        导出完成！
        <el-button type="success" size="small" @click="download">下载</el-button>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAdminProjects } from '@/api/project'
import { createExport, getExportStatus } from '@/api/export'
import { ElMessage } from 'element-plus'

const projects = ref([])
const loading = ref(false)
const selectedIds = ref([])
const exporting = ref(false)
const taskStatus = ref('')
const downloadUrl = ref('')
const currentTaskId = ref('')
let pollTimer = null

onMounted(async () => {
  loading.value = true
  try {
    const res = await getAdminProjects()
    projects.value = (res.data.data || []).filter(p => p.status === 'SUBMITTED')
  } catch (e) {
  } finally {
    loading.value = false
  }
})

function handleSelectionChange(selection) {
  selectedIds.value = selection.map(s => s.id)
}

async function exportSingle(id) {
  await doExport([id])
}

async function batchExport() {
  await doExport(selectedIds.value)
}

async function doExport(ids) {
  exporting.value = true
  taskStatus.value = 'PROCESSING'
  downloadUrl.value = ''
  try {
    const res = await createExport(ids)
    currentTaskId.value = res.data.data.taskId
    pollTask()
  } catch (e) {
    exporting.value = false
    taskStatus.value = ''
  }
}

function pollTask() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    try {
      const res = await getExportStatus(currentTaskId.value)
      const status = res.data.data.status
      if (status === 'FAILED') {
        ElMessage.error('导出失败')
        taskStatus.value = ''
        exporting.value = false
        clearInterval(pollTimer)
      } else if (status.startsWith('/uploads/')) {
        downloadUrl.value = status
        taskStatus.value = 'DONE'
        exporting.value = false
        clearInterval(pollTimer)
      }
    } catch (e) {
      clearInterval(pollTimer)
      exporting.value = false
    }
  }, 2000)
}

function download() {
  if (downloadUrl.value) {
    window.open(downloadUrl.value, '_blank')
  }
}
</script>

<style scoped>
.page-title {
  font-size: 26px;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.02em;
}

.desc {
  color: rgba(0, 0, 0, 0.4);
  font-size: 14px;
}

.export-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.export-status {
  font-size: 13px;
  font-weight: 500;
}

.export-status.processing {
  color: #fbbf24;
}

.export-status.done {
  color: #34d399;
}

@media (max-width: 768px) {
  .page-title {
    font-size: 22px;
  }

  .desc {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .page-title {
    font-size: 20px;
  }
}
</style>