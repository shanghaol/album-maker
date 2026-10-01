<template>
  <div>
    <div class="page-header">
      <h2>贴纸管理</h2>
      <el-button type="primary" @click="showAddDialog">添加贴纸</el-button>
    </div>

    <el-row :gutter="20" style="margin-top: 16px">
      <el-col :span="24">
        <el-card>
          <div class="sticker-grid">
            <div v-for="s in stickers" :key="s.id" class="sticker-card">
              <img :src="s.imageUrl" />
              <div class="sticker-info">
                <span class="sticker-name">{{ s.name }}</span>
                <el-tag size="small">{{ s.category }}</el-tag>
              </div>
              <el-button type="danger" size="small" circle @click="remove(s.id)" class="delete-btn">
                ✕
              </el-button>
            </div>
          </div>
          <el-empty v-if="stickers.length === 0" description="暂无贴纸" />
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="addDialog" title="添加贴纸" width="400px">
      <el-form :model="addForm" label-width="80px">
        <el-form-item label="贴纸名称">
          <el-input v-model="addForm.name" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="addForm.category" placeholder="如：边框、爱心、节日" />
        </el-form-item>
        <el-form-item label="贴纸图片">
          <el-upload
            :show-file-list="true"
            :before-upload="(file) => { addForm.file = file; return false }"
            accept="image/*"
            :limit="1"
          >
            <el-button size="small">选择图片</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialog = false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="doAdd">确认添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAdminStickers, addSticker, deleteSticker } from '@/api/sticker'
import { ElMessage, ElMessageBox } from 'element-plus'

const stickers = ref([])
const addDialog = ref(false)
const adding = ref(false)
const addForm = ref({ name: '', category: '', file: null })

onMounted(async () => {
  await loadStickers()
})

async function loadStickers() {
  try {
    const res = await getAdminStickers()
    stickers.value = res.data.data || []
  } catch (e) {}
}

function showAddDialog() {
  addForm.value = { name: '', category: '', file: null }
  addDialog.value = true
}

async function doAdd() {
  if (!addForm.value.file) {
    ElMessage.warning('请选择贴纸图片')
    return
  }
  adding.value = true
  try {
    await addSticker(addForm.value.name || '贴纸', addForm.value.category || '默认', addForm.value.file)
    ElMessage.success('添加成功')
    addDialog.value = false
    await loadStickers()
  } catch (e) {
  } finally {
    adding.value = false
  }
}

async function remove(id) {
  try {
    await ElMessageBox.confirm('确定删除该贴纸？', '提示', { type: 'warning' })
    await deleteSticker(id)
    ElMessage.success('已删除')
    await loadStickers()
  } catch (e) {}
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}

.page-header h2 {
  font-size: 26px;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.02em;
}

.sticker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 20px;
}

.sticker-card {
  position: relative;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.sticker-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.sticker-card img {
  width: 100%;
  height: 120px;
  object-fit: contain;
  padding: 16px;
  background: rgba(0, 0, 0, 0.015);
  transition: transform 0.3s ease;
}

.sticker-card:hover img {
  transform: scale(1.05);
}

.sticker-info {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

.sticker-name {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  font-size: 11px;
  border-radius: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.sticker-card:hover .delete-btn {
  opacity: 1;
}

@media (max-width: 768px) {
  .page-header h2 {
    font-size: 22px;
  }

  .sticker-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }

  .sticker-card {
    border-radius: 14px;
  }

  .sticker-card img {
    height: 100px;
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .page-header h2 {
    font-size: 20px;
  }

  .sticker-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .sticker-card img {
    height: 88px;
    padding: 10px;
  }

  .sticker-info {
    padding: 10px;
  }
}
</style>