<template>
  <div>
    <div class="page-header">
      <h2>模板管理</h2>
      <el-button type="primary" @click="showCreateDialog">创建模板</el-button>
    </div>

    <el-table :data="templates" border stripe style="width: 100%">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="模板名称" />
      <el-table-column label="分类" width="90">
        <template #default="{ row }">
          <el-tag v-if="row.category" size="small" effect="plain">{{ categoryLabel(row.category) }}</el-tag>
          <span v-else style="color:#999;font-size:12px">未分类</span>
        </template>
      </el-table-column>
      <el-table-column label="封面" width="120">
        <template #default="{ row }">
          <el-image v-if="row.coverUrl" :src="row.coverUrl" fit="cover" style="width:100px;height:60px;border-radius:4px" />
          <span v-else style="color:#999;font-size:12px">暂无封面</span>
        </template>
      </el-table-column>
      <el-table-column prop="pageCount" label="页数" width="80" />
      <el-table-column label="画布比例" width="120">
        <template #default="{ row }">
          <span v-if="row.pageWidth && row.pageHeight" style="font-size:12px;color:#666">
            {{ row.pageWidth }} × {{ row.pageHeight }}
          </span>
          <span v-else style="color:#999;font-size:12px">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'PUBLISHED' ? 'success' : row.status === 'DISABLED' ? 'danger' : 'info'">
            {{ row.status === 'PUBLISHED' ? '已发布' : row.status === 'DISABLED' ? '已下架' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180" />
      <el-table-column label="操作" width="260">
        <template #default="{ row }">
          <el-button size="small" @click="managePages(row)">管理页面</el-button>
          <el-button v-if="row.status === 'DRAFT'" size="small" type="success" @click="publish(row.id)">发布</el-button>
          <el-button v-if="row.status === 'PUBLISHED'" size="small" type="warning" @click="disable(row.id)">下架</el-button>
          <el-button v-if="row.status === 'DISABLED'" size="small" type="success" @click="enable(row.id)">恢复</el-button>
          <el-dropdown trigger="click">
            <el-button size="small">更多▾</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="changeCategory(row)">更改分类</el-dropdown-item>
                <el-dropdown-item @click="uploadCover(row)">上传封面</el-dropdown-item>
                <el-dropdown-item @click="remove(row.id)" style="color: #f56c6c">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="createDialog" title="创建模板" width="560px">
      <el-tabs v-model="createMode" class="create-mode-tabs">
        <el-tab-pane label="图片上传" name="image">
          <el-form :model="createForm" label-width="80px">
            <el-form-item label="模板名称">
              <el-input v-model="createForm.name" placeholder="请输入模板名称" />
            </el-form-item>
            <el-form-item label="分类">
              <el-select v-model="createForm.category" placeholder="选择模板分类" style="width:100%">
                <el-option v-for="cat in categoryOptions" :key="cat.value" :label="cat.label" :value="cat.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="createForm.description" type="textarea" placeholder="选填" />
            </el-form-item>
            <el-form-item label="页数">
              <el-input-number v-model="createForm.pageCount" :min="1" :max="100" />
            </el-form-item>
            <el-form-item label="背景图" required>
              <div class="bg-upload-area">
                <div v-if="bgPreviewUrl" class="bg-preview">
                  <el-image :src="bgPreviewUrl" fit="contain" style="width:200px;height:150px;border-radius:4px" />
                  <div class="bg-info">
                    <span class="bg-dimension">{{ bgWidth }} × {{ bgHeight }} px</span>
                    <span class="bg-ratio">比例 {{ bgRatio }}</span>
                    <el-button size="small" type="warning" @click="clearBg">清除</el-button>
                  </div>
                </div>
                <el-upload
                  v-else
                  drag
                  action="#"
                  :auto-upload="false"
                  :show-file-list="false"
                  :on-change="onBgFileChange"
                  accept="image/*"
                  class="bg-uploader"
                >
                  <el-icon class="el-icon--upload"><i class="el-icon-upload" /></el-icon>
                  <div class="el-upload__text">拖拽或<em>点击上传</em>背景图</div>
                  <div class="el-upload__tip">将以此图比例创建画布</div>
                </el-upload>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="PDF上传" name="pdf">
          <el-form :model="pdfForm" label-width="80px">
            <el-form-item label="模板名称">
              <el-input v-model="pdfForm.name" placeholder="请输入模板名称" />
            </el-form-item>
            <el-form-item label="分类">
              <el-select v-model="pdfForm.category" placeholder="选择模板分类" style="width:100%">
                <el-option v-for="cat in categoryOptions" :key="cat.value" :label="cat.label" :value="cat.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="pdfForm.description" type="textarea" placeholder="选填" />
            </el-form-item>
            <el-form-item label="DPI">
              <el-select v-model="pdfForm.dpi" style="width:140px">
                <el-option label="150 (标准)" :value="150" />
                <el-option label="200 (清晰)" :value="200" />
                <el-option label="300 (高清)" :value="300" />
              </el-select>
              <span class="dpi-hint">越高越清晰，生成越慢</span>
            </el-form-item>
            <el-form-item label="PDF文件" required>
              <div class="bg-upload-area">
                <div v-if="pdfFile" class="bg-preview">
                  <div class="pdf-file-info">
                    <el-icon :size="40" color="#409EFF"><i class="el-icon-document" /></el-icon>
                    <div class="pdf-detail">
                      <span class="pdf-name">{{ pdfFile.name }}</span>
                      <span class="pdf-size">{{ formatFileSize(pdfFile.size) }}</span>
                      <span class="pdf-hint">上传后将自动识别页数并生成模板</span>
                    </div>
                    <el-button size="small" type="warning" @click="clearPdf">清除</el-button>
                  </div>
                </div>
                <el-upload
                  v-else
                  drag
                  action="#"
                  :auto-upload="false"
                  :show-file-list="false"
                  :on-change="onPdfFileChange"
                  accept=".pdf"
                  class="bg-uploader pdf-uploader"
                >
                  <el-icon class="el-icon--upload"><i class="el-icon-upload" /></el-icon>
                  <div class="el-upload__text">拖拽或<em>点击上传</em>PDF文件</div>
                  <div class="el-upload__tip">自动识别页数，每页生成一个模板页面</div>
                </el-upload>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="PSD上传" name="psd">
          <el-form :model="psdForm" label-width="80px">
            <el-form-item label="模板名称">
              <el-input v-model="psdForm.name" placeholder="请输入模板名称" />
            </el-form-item>
            <el-form-item label="分类">
              <el-select v-model="psdForm.category" placeholder="选择模板分类" style="width:100%">
                <el-option v-for="cat in categoryOptions" :key="cat.value" :label="cat.label" :value="cat.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="描述">
              <el-input v-model="psdForm.description" type="textarea" placeholder="选填" />
            </el-form-item>
            <el-form-item label="PSD文件" required>
              <div class="bg-upload-area">
                <div v-if="psdFile" class="bg-preview">
                  <div class="pdf-file-info">
                    <el-icon :size="40" color="#409EFF"><i class="el-icon-document" /></el-icon>
                    <div class="pdf-detail">
                      <span class="pdf-name">{{ psdFile.name }}</span>
                      <span class="pdf-size">{{ formatFileSize(psdFile.size) }}</span>
                      <span v-if="psdParseResult" class="pdf-hint">
                        画布 {{ psdParseResult.width }}×{{ psdParseResult.height }} · 可见图层 {{ psdParseResult.layers.length }} 层
                      </span>
                      <span v-else class="pdf-hint">解析中…</span>
                    </div>
                    <el-button size="small" type="warning" @click="clearPsd">清除</el-button>
                  </div>
                  <div v-if="psdWarnings.length" class="psd-warnings">
                    <div v-for="(w, i) in psdWarnings" :key="i">⚠ {{ w }}</div>
                  </div>
                </div>
                <el-upload
                  v-else
                  drag
                  action="#"
                  :auto-upload="false"
                  :show-file-list="false"
                  :on-change="onPsdFileChange"
                  accept=".psd"
                  class="bg-uploader pdf-uploader"
                >
                  <el-icon class="el-icon--upload"><i class="el-icon-upload" /></el-icon>
                  <div class="el-upload__text">拖拽或<em>点击上传</em>PSD文件</div>
                  <div class="el-upload__tip">浏览器端解析图层，创建分层模板（≤200MB、可见图层≤60、不支持PSB）</div>
                </el-upload>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button v-if="createMode === 'image'" type="primary" :loading="creating" :disabled="!bgFile" @click="doCreate">
          {{ bgFile ? '确认创建' : '请先上传背景图' }}
        </el-button>
        <el-button v-if="createMode === 'pdf'" type="primary" :loading="creating" :disabled="!pdfFile" @click="doCreateFromPdf">
          {{ pdfFile ? '确认创建' : '请先上传PDF文件' }}
        </el-button>
        <el-button v-if="createMode === 'psd'" type="primary" :loading="creating" :disabled="!psdParseResult" @click="doCreateFromPsd">
          {{ psdParseResult ? '确认创建分层模板' : '请先上传并解析PSD' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pageDialog" title="页面管理" width="700px">
      <div class="page-upload-list">
        <div v-for="page in templatePages" :key="page.pageNumber" class="page-upload-item">
          <span class="page-label">第 {{ page.pageNumber }} 页</span>
          <div class="page-info">
            <span class="page-size">{{ page.width || 2480 }} × {{ page.height || 3508 }} px</span>
          </div>
          <div class="page-bg-preview">
            <el-image v-if="page.backgroundUrl" :src="page.backgroundUrl" fit="cover" style="width:80px;height:113px;border-radius:4px" />
            <div v-else class="no-bg-placeholder">未上传背景</div>
          </div>
          <el-upload
            action="#"
            :auto-upload="false"
            :show-file-list="false"
            :on-change="(file) => doUploadBg(selectedTemplate.id, page.pageNumber, file.raw)"
            accept="image/*"
          >
            <el-button size="small">上传背景图</el-button>
          </el-upload>
          <el-button size="small" @click="editZones(selectedTemplate.id, page.pageNumber)">标注区域</el-button>
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="categoryDialog" title="更改模板分类" width="420px">
      <el-form label-width="80px">
        <el-form-item label="模板">
          <span>{{ categoryRow?.name }}</span>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="categoryValue" style="width:100%">
            <el-option v-for="cat in categoryOptions" :key="cat.value" :label="cat.label" :value="cat.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialog = false">取消</el-button>
        <el-button type="primary" :loading="changingCategory" @click="doUpdateCategory">保存</el-button>
      </template>
    </el-dialog>

    <input ref="coverInput" type="file" accept="image/*" style="display:none" @change="onCoverChange" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAdminTemplates, createTemplateWithBackground, createTemplateFromPdf, uploadTemplateCover, uploadPageBackground, publishTemplate, disableTemplate, enableTemplate, deleteTemplate, getTemplatePages, updateTemplateCategory, saveTemplateLayers, uploadLayerImage } from '@/api/template'
import { ElMessage, ElMessageBox } from 'element-plus'

// 与用户端模板市场筛选项保持一致（TemplateList.vue categories）
const categoryOptions = [
  { label: '婚礼', value: 'wedding' },
  { label: '旅行', value: 'travel' },
  { label: '亲子', value: 'family' },
  { label: '毕业', value: 'graduation' },
  { label: '其他', value: 'other' }
]

function categoryLabel(category) {
  const cat = categoryOptions.find(c => c.value === category)
  return cat ? cat.label : (category || '')
}

const router = useRouter()
const templates = ref([])
const createDialog = ref(false)
const creating = ref(false)
const pageDialog = ref(false)
const selectedTemplate = ref(null)
const coverInput = ref(null)
const currentCoverTemplateId = ref(null)
const templatePages = ref([])

const createMode = ref('image')
const createForm = ref({ name: '', description: '', pageCount: 20, category: 'other' })
const bgFile = ref(null)
const bgPreviewUrl = ref(null)
const bgWidth = ref(0)
const bgHeight = ref(0)
const bgRatio = ref('')

const pdfForm = ref({ name: '', description: '', dpi: 200, category: 'other' })
const pdfFile = ref(null)

// ---- PSD 分层模板（FR-52/53/56，D13–D16，RULE-19）----
const psdForm = ref({ name: '', description: '', category: 'other' })
const psdFile = ref(null)
const psdParseResult = ref(null) // { width, height, compositeBlob, layers: [{name, blob, x, y, width, height, opacity}] }
const psdWarnings = ref([])

const PSD_MAX_BYTES = 200 * 1024 * 1024 // RULE-19：≤200MB
const PSD_MAX_LAYERS = 60 // RULE-19：可见图层 ≤60

async function onPsdFileChange(uploadFile) {
  const file = uploadFile.raw
  if (!file) return
  psdParseResult.value = null
  psdWarnings.value = []
  // RULE-19 前置校验：扩展名 / 大小 / PSB 拒绝
  if (!file.name.toLowerCase().endsWith('.psd')) {
    ElMessage.error('仅支持 .psd 文件')
    return
  }
  if (file.size > PSD_MAX_BYTES) {
    ElMessage.error('PSD 文件超过 200MB 上限')
    return
  }
  const header = new Uint8Array(await file.slice(0, 6).arrayBuffer())
  const isPsd = header[0] === 0x38 && header[1] === 0x42 && header[2] === 0x50 && header[3] === 0x53
  const version = (header[4] << 8) | header[5]
  if (!isPsd) {
    ElMessage.error('文件内容不是有效的 PSD 文档')
    return
  }
  if (version === 2) {
    ElMessage.error('不支持 PSB（大型文档格式），请在 Photoshop 中另存为 PSD')
    return
  }
  psdFile.value = file
  try {
    const { readPsd } = await import('ag-psd')
    const psd = readPsd(await file.arrayBuffer(), { skipThumbnail: true, skipLinkedFilesData: true })
    if (!psd.canvas) {
      throw new Error('无法合成画布')
    }
    // D14：仅可见像素图层，按层叠顺序（底层→顶层）收集
    const collected = []
    const walk = (children) => {
      for (const layer of children || []) {
        if (layer.children) {
          walk(layer.children)
        } else if (!layer.hidden && layer.canvas) {
          collected.push(layer)
        } else if (!layer.hidden && !layer.canvas && layer.name) {
          psdWarnings.value.push(`图层「${layer.name}」无像素数据（如纯调整图层），已跳过`)
        }
      }
    }
    walk(psd.children)
    if (collected.length > PSD_MAX_LAYERS) {
      psdFile.value = null
      ElMessage.error(`可见图层 ${collected.length} 层超过上限 60 层，请合并图层后重试`)
      return
    }
    // children 顺序为顶层→底层，反转为底层 zIndex=0
    collected.reverse()
    const layers = []
    for (let i = 0; i < collected.length; i++) {
      const layer = collected[i]
      const blob = await canvasToBlob(layer.canvas)
      if (!blob) {
        psdWarnings.value.push(`图层「${layer.name}」栅格化失败，已跳过（FR-56 降级导入）`)
        continue
      }
      layers.push({
        name: layer.name || `图层 ${i + 1}`,
        blob,
        x: layer.left || 0,
        y: layer.top || 0,
        width: layer.canvas.width,
        height: layer.canvas.height,
        opacity: layer.opacity == null ? 1 : layer.opacity
      })
    }
    if (layers.length === 0) {
      psdFile.value = null
      ElMessage.error('未解析到任何可见像素图层')
      return
    }
    const compositeBlob = await canvasToBlob(psd.canvas)
    if (!compositeBlob) {
      throw new Error('画布合成失败')
    }
    psdParseResult.value = { width: psd.width, height: psd.height, compositeBlob, layers }
    ElMessage.success(`解析成功：${psd.width}×${psd.height}，可见图层 ${layers.length} 层`)
  } catch (e) {
    // FR-56：整体解析失败——终止且无残留（尚未创建任何模板）
    console.error('[TemplateManage] PSD 解析失败:', e)
    psdFile.value = null
    ElMessage.error('PSD 解析失败：' + (e && e.message ? e.message : '文件损坏或不支持'))
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      resolve(null)
    }
  })
}

function clearPsd() {
  psdFile.value = null
  psdParseResult.value = null
  psdWarnings.value = []
}

// 三步创建（FR-52）：①合成图建模板（1 页）→ ②逐层上传 PNG → ③保存图层档案（坐标 0-1 归一化）
async function doCreateFromPsd() {
  const result = psdParseResult.value
  if (!result || creating.value) return
  if (!psdForm.value.name) {
    ElMessage.warning('请填写模板名称')
    return
  }
  creating.value = true
  try {
    const compositeFile = new File([result.compositeBlob], 'composite.png', { type: 'image/png' })
    const res = await createTemplateWithBackground(
      compositeFile,
      psdForm.value.name,
      psdForm.value.description,
      1,
      result.width,
      result.height,
      psdForm.value.category
    )
    const templateId = res.data.data.id
    const pagesRes = await getTemplatePages(templateId)
    const page = (pagesRes.data.data || [])[0]
    if (!page) throw new Error('模板页未生成')

    const failedLayers = []
    const layersMeta = []
    for (let i = 0; i < result.layers.length; i++) {
      const layer = result.layers[i]
      try {
        const file = new File([layer.blob], `layer-${i}.png`, { type: 'image/png' })
        const uploadRes = await uploadLayerImage(page.id, file)
        layersMeta.push({
          id: `L${i}`,
          name: layer.name,
          url: uploadRes.data.data,
          x: layer.x / result.width,
          y: layer.y / result.height,
          width: layer.width / result.width,
          height: layer.height / result.height,
          opacity: layer.opacity,
          visible: true,
          zIndex: i
        })
      } catch (e) {
        failedLayers.push(layer.name)
        console.error('[TemplateManage] 图层上传失败:', layer.name, e)
      }
    }
    await saveTemplateLayers(page.id, JSON.stringify(layersMeta))
    ElMessage.success(
      `PSD 分层模板创建成功（${layersMeta.length} 层）` +
        (failedLayers.length ? `；失败已降级跳过：${failedLayers.join('、')}` : '')
    )
    createDialog.value = false
    clearPsd()
    managePages(res.data.data)
  } catch (e) {
    console.error('[TemplateManage] PSD 模板创建失败:', e)
    ElMessage.error('PSD 模板创建失败')
  } finally {
    creating.value = false
  }
}

const categoryDialog = ref(false)
const categoryRow = ref(null)
const categoryValue = ref('other')
const changingCategory = ref(false)

onMounted(async () => {
  await loadTemplates()
})

async function loadTemplates() {
  try {
    const res = await getAdminTemplates()
    const list = res.data.data || []
    // 各模板页面尺寸并行获取，消除 N+1 串行等待（模板多时此前线性变慢）
    await Promise.all(list.map(async (tpl) => {
      try {
        const pagesRes = await getTemplatePages(tpl.id)
        const pages = pagesRes.data.data || []
        if (pages.length > 0) {
          tpl.pageWidth = pages[0].width
          tpl.pageHeight = pages[0].height
        }
      } catch (e) {
        console.error('[TemplateManage] 获取模板页面失败:', e)
      }
    }))
    templates.value = list
  } catch (e) {
    console.error('[TemplateManage] 加载模板列表失败:', e)
    ElMessage.error('加载模板列表失败')
  }
}

function showCreateDialog() {
  createMode.value = 'image'
  createForm.value = { name: '', description: '', pageCount: 20, category: 'other' }
  bgFile.value = null
  bgPreviewUrl.value = null
  bgWidth.value = 0
  bgHeight.value = 0
  bgRatio.value = ''
  pdfForm.value = { name: '', description: '', dpi: 200, category: 'other' }
  pdfFile.value = null
  createDialog.value = true
}

function onBgFileChange(uploadFile) {
  const file = uploadFile.raw
  if (!file) return
  bgFile.value = file
  const url = URL.createObjectURL(file)
  bgPreviewUrl.value = url
  const img = new Image()
  img.onload = () => {
    bgWidth.value = img.naturalWidth
    bgHeight.value = img.naturalHeight
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b))
    const g = gcd(bgWidth.value, bgHeight.value)
    bgRatio.value = `${bgWidth.value / g}:${bgHeight.value / g}`
    URL.revokeObjectURL(url)
  }
  img.src = url
}

function clearBg() {
  bgFile.value = null
  bgPreviewUrl.value = null
  bgWidth.value = 0
  bgHeight.value = 0
  bgRatio.value = ''
}

function onPdfFileChange(uploadFile) {
  const file = uploadFile.raw
  if (!file) return
  pdfFile.value = file
}

function clearPdf() {
  pdfFile.value = null
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function doCreateFromPdf() {
  if (!pdfFile.value) {
    ElMessage.warning('请先上传PDF文件')
    return
  }
  creating.value = true
  try {
    const res = await createTemplateFromPdf(
      pdfFile.value,
      pdfForm.value.name,
      pdfForm.value.description,
      pdfForm.value.dpi,
      pdfForm.value.category
    )
    ElMessage.success('PDF模板创建成功，已自动识别 ' + res.data.data.pageCount + ' 页')
    createDialog.value = false
    managePages(res.data.data)
  } catch (e) {
    console.error('[TemplateManage] PDF模板创建失败:', e)
    ElMessage.error('PDF模板创建失败')
  } finally {
    creating.value = false
  }
}

async function doCreate() {
  if (!bgFile.value) {
    ElMessage.warning('请先上传背景图')
    return
  }
  creating.value = true
  try {
    const res = await createTemplateWithBackground(
      bgFile.value,
      createForm.value.name,
      createForm.value.description,
      createForm.value.pageCount,
      bgWidth.value,
      bgHeight.value,
      createForm.value.category
    )
    ElMessage.success('模板创建成功')
    createDialog.value = false
    managePages(res.data.data)
  } catch (e) {
    console.error('[TemplateManage] 模板创建失败:', e)
    ElMessage.error('模板创建失败')
  } finally {
    creating.value = false
  }
}

function changeCategory(row) {
  categoryRow.value = row
  categoryValue.value = row.category || 'other'
  categoryDialog.value = true
}

async function doUpdateCategory() {
  if (!categoryRow.value) return
  changingCategory.value = true
  try {
    await updateTemplateCategory(categoryRow.value.id, categoryValue.value)
    ElMessage.success('分类已更新')
    categoryDialog.value = false
    await loadTemplates()
  } catch (e) {
    console.error('[TemplateManage] 更新分类失败:', e)
  } finally {
    changingCategory.value = false
  }
}

function uploadCover(row) {
  currentCoverTemplateId.value = row.id
  coverInput.value.click()
}

async function onCoverChange(e) {
  const file = e.target.files[0]
  if (!file) return
  try {
    await uploadTemplateCover(currentCoverTemplateId.value, file)
    ElMessage.success('封面上传成功')
    await loadTemplates()
  } catch (e) {
    console.error('[TemplateManage] 封面上传失败:', e)
    ElMessage.error('封面上传失败')
  }
  coverInput.value.value = ''
}

async function managePages(row) {
  selectedTemplate.value = row
  pageDialog.value = true
  try {
    const res = await getTemplatePages(row.id)
    templatePages.value = res.data.data || []
    if (templatePages.value.length === 0) {
      for (let i = 1; i <= row.pageCount; i++) {
        templatePages.value.push({ pageNumber: i, backgroundUrl: null, width: 2480, height: 3508 })
      }
    }
  } catch (e) {
    templatePages.value = []
    for (let i = 1; i <= row.pageCount; i++) {
      templatePages.value.push({ pageNumber: i, backgroundUrl: null, width: 2480, height: 3508 })
    }
  }
}

async function doUploadBg(templateId, pageNumber, file) {
  try {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = objectUrl
    })
    const width = img.naturalWidth
    const height = img.naturalHeight
    URL.revokeObjectURL(objectUrl)

    await uploadPageBackground(templateId, pageNumber, file, width, height)
    ElMessage.success(`第${pageNumber}页背景图上传成功`)

    const pagesRes = await getTemplatePages(templateId)
    if (pagesRes.data.code === 200) {
      templatePages.value = pagesRes.data.data || []
    }
  } catch (e) {
    ElMessage.error('背景图上传失败: ' + (e.response?.data?.message || e.message || '未知错误'))
  }
}

function editZones(templateId, pageNumber) {
  router.push(`/admin/templates/${templateId}/zones?page=${pageNumber}`)
}

async function publish(id) {
  try {
    await publishTemplate(id)
    ElMessage.success('模板已发布')
    await loadTemplates()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('[TemplateManage] 发布失败:', e)
      ElMessage.error('发布失败')
    }
  }
}

// 模板下架/恢复（FR-63）：PUBLISHED⇄DISABLED，下架后用户端市场不可见
async function disable(id) {
  try {
    await ElMessageBox.confirm('下架后用户端模板市场将不再展示该模板，已创建的项目不受影响。确认下架？', '下架模板', { type: 'warning' })
    await disableTemplate(id)
    ElMessage.success('模板已下架')
    await loadTemplates()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('[TemplateManage] 下架失败:', e)
      ElMessage.error(e && e.response && e.response.data && e.response.data.message ? e.response.data.message : '下架失败')
    }
  }
}

async function enable(id) {
  try {
    await enableTemplate(id)
    ElMessage.success('模板已恢复发布')
    await loadTemplates()
  } catch (e) {
    console.error('[TemplateManage] 恢复失败:', e)
    ElMessage.error(e && e.response && e.response.data && e.response.data.message ? e.response.data.message : '恢复失败')
  }
}

async function remove(id) {
  try {
    await ElMessageBox.confirm('确定删除该模板？', '提示', { type: 'warning' })
    await deleteTemplate(id)
    ElMessage.success('已删除')
    await loadTemplates()
  } catch (e) {
    if (e !== 'cancel') {
      console.error('[TemplateManage] 删除失败:', e)
      ElMessage.error('删除失败')
    }
  }
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 26px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.02em;
}

.page-upload-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-upload-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.01);
  transition: border-color 0.2s ease;
}

.page-upload-item:hover {
  border-color: rgba(0, 0, 0, 0.15);
}

.page-label {
  width: 70px;
  font-weight: 600;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.75);
}

.page-info {
  width: 110px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
  flex-shrink: 0;
}

.page-size {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.3);
}

.page-bg-preview {
  width: 80px;
  height: 113px;
  flex-shrink: 0;
}

.no-bg-placeholder {
  width: 80px;
  height: 113px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px dashed rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.3);
}

.bg-upload-area {
  width: 100%;
}

.bg-uploader {
  width: 100%;
}

.bg-preview {
  display: flex;
  align-items: center;
  gap: 16px;
}

.bg-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bg-dimension {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
}

.bg-ratio {
  font-size: 12px;
  color: #6366f1;
  font-weight: 500;
}

.create-mode-tabs {
  margin-top: -8px;
}

.dpi-hint {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
  margin-left: 8px;
}

.psd-warnings {
  margin-top: 8px;
  padding: 6px 10px;
  background: #fdf6ec;
  border-radius: 6px;
  font-size: 12px;
  color: #b88230;
  max-height: 100px;
  overflow-y: auto;
}

.pdf-file-info {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 12px;
}

.pdf-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.pdf-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.8);
  word-break: break-all;
}

.pdf-size {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.4);
}

.pdf-hint {
  font-size: 12px;
  color: #6366f1;
  font-weight: 500;
}

.pdf-uploader {
  border-color: #409EFF !important;
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }

  .page-header h2 {
    font-size: 22px;
    width: 100%;
  }

  .page-upload-item {
    flex-wrap: wrap;
    gap: 10px;
    padding: 12px;
  }

  .page-label {
    width: auto;
    font-size: 13px;
  }

  .page-info {
    width: auto;
  }

  .bg-preview {
    flex-direction: column;
    align-items: flex-start;
  }

  .pdf-file-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .pdf-detail {
    width: 100%;
  }

  .create-mode-tabs :deep(.el-tabs__item) {
    font-size: 13px;
    padding: 0 12px;
  }
}

@media (max-width: 480px) {
  .page-header h2 {
    font-size: 20px;
  }

  .page-upload-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>