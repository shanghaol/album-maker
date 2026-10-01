<template>
  <div class="editor-page" @keydown="onKeyDown" tabindex="0" ref="editorPageRef">
    <div v-if="loading" class="editor-loading">
      <div class="loading-spinner"></div>
      <span>加载编辑器中...</span>
    </div>

    <EditorToolbar
      :title="project?.title || ''"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :zoom-percent="Math.round(zoomLevel * 100)"
      :auto-save-status="autoSaveStatus"
      :saving="saving"
      :submitting="submitting"
      :is-mobile="isMobile"
      @go-back="handleGoBack"
      @undo="undo"
      @redo="redo"
      @zoom-in="handleZoomIn"
      @zoom-out="handleZoomOut"
      @zoom-to-fit="handleZoomToFit"
      @delete-selected="deleteSelected"
      @copy-selected="copySelected"
      @paste-selected="pasteSelected"
      @bring-forward="bringForward"
      @send-backward="sendBackward"
      @bring-to-front="bringToFront"
      @send-to-back="sendToBack"
      @align-objects="alignObjects"
      @save-draft="handleSaveDraft"
      @submit-project="handleSubmitProject"
      :editor-mode="editorMode"
      :canvas-ratio-label="canvasRatioLabel"
      @set-canvas-ratio="handleSetCanvasRatio"
    />

    <div class="editor-body">
      <EditorSidebar
        v-if="!isMobile"
        :template-pages="templatePages"
        :current-page-number="currentPageNumber"
        :current-page-images="currentPageImages"
        :system-stickers="systemStickers"
        :selected-object-info="selectedObjectInfo"
        :prop-collapse-active="propCollapseActive"
        :font-list="fontList"
        :active-panel="activePanel"
        :get-page-preview="getPagePreview"
        :is-mobile="isMobile"
        :editor-mode="editorMode"
        :has-main-block="hasMainBlock"
        :block-data="blockData"
        :free-photo="freePhotoState"
        @switch-page="handleSwitchPage"
        @select-image="selectImageByZoneId"
        @upload-sticker="handleUploadSticker"
        @add-sticker="addStickerToCanvas"
        @add-emoji="addEmojiToCanvas"
        @add-text="handleAddText"
        @update-selected-prop="handleUpdateSelectedProp"
        @update-image-filter="handleUpdateImageFilter"
        @reset-image-filters="resetImageFilters"
        @update:active-panel="activePanel = $event"
        @update:prop-collapse-active="propCollapseActive = $event"
        @add-block="handleAddBlock"
        @update-block="handleUpdateBlock"
        @remove-block="handleRemoveBlock"
        @apply-decor="handleApplyDecor"
        @clear-decor="handleClearDecor"
        @slider-commit="handleSliderCommit"
        @toggle-text-shadow="toggleTextShadow"
        @toggle-text-cutout="toggleTextCutout"
        @upload-free-photo-click="handleFreePhotoClick"
        @set-copy-mode="handleSetCopyMode"
        @replace-free-photo="handleReplaceFreePhoto"
      />

      <div class="editor-canvas-wrapper" ref="canvasWrapper" @contextmenu.prevent="onCanvasContextMenu">
        <div class="canvas-container" ref="canvasContainer">
          <canvas ref="canvasRef" id="editorCanvas" role="application" aria-label="相册编辑画布，使用键盘快捷键操作对象"></canvas>
        </div>
        <EditorContextMenu
          :visible="contextMenu.visible"
          :x="contextMenu.x"
          :y="contextMenu.y"
          @delete="onContextDelete"
          @copy="onContextCopy"
          @bring-to-front="bringToFront"
          @send-to-back="sendToBack"
        />
      </div>
    </div>

    <input ref="zoneFileInput" type="file" accept="image/*" style="display:none" @change="onZoneFileChange" />
    <input ref="freePhotoInput" type="file" accept="image/*" style="display:none" @change="onFreePhotoFileChange" />

    <MobilePropertyBar
      v-if="isMobile"
      :selected-object-info="selectedObjectInfo"
      :has-selection="hasSelection"
      :text-format-state="textFormatState"
      :font-list="fontList"
      @update-selected-prop="handleUpdateSelectedProp"
      @update-image-filter="handleUpdateImageFilter"
      @toggle-text-bold="toggleTextBold"
      @toggle-text-italic="toggleTextItalic"
      @toggle-text-underline="toggleTextUnderline"
      @set-text-align="setTextAlign"
      @update-text-font-family="updateTextFontFamily"
      @update-text-font-size="updateTextFontSize"
      @update-text-color="updateTextColor"
      @slider-commit="handleSliderCommit"
    />

    <div
      v-if="isMobile && templatePages.length"
      class="mobile-page-bar"
    >
      <div class="mobile-page-thumbs">
        <div
          v-for="page in templatePages"
          :key="page.id"
          :class="['mobile-page-thumb', { active: currentPageNumber === page.pageNumber }]"
          @click="handleSwitchPage(page.pageNumber)"
        >
          <img v-if="getPagePreview(page.pageNumber)" :src="getPagePreview(page.pageNumber)" />
          <span v-else>{{ page.pageNumber }}</span>
        </div>
      </div>
      <div class="mobile-page-divider"></div>
      <button
        class="mobile-page-action"
        @click="mobileDrawerVisible = true"
        aria-label="打开编辑面板"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      </button>
    </div>

    <el-drawer
      v-model="mobileDrawerVisible"
      direction="btt"
      size="85%"
      :with-header="false"
      class="mobile-drawer"
    >
      <EditorSidebar
        :template-pages="templatePages"
        :current-page-number="currentPageNumber"
        :current-page-images="currentPageImages"
        :system-stickers="systemStickers"
        :selected-object-info="selectedObjectInfo"
        :prop-collapse-active="propCollapseActive"
        :font-list="fontList"
        :active-panel="activePanel"
        :get-page-preview="getPagePreview"
        :is-mobile="true"
        :editor-mode="editorMode"
        :has-main-block="hasMainBlock"
        :block-data="blockData"
        :free-photo="freePhotoState"
        @switch-page="(pn) => { handleSwitchPage(pn); mobileDrawerVisible = false }"
        @select-image="selectImageByZoneId"
        @upload-sticker="(f) => { handleUploadSticker(f); mobileDrawerVisible = false }"
        @add-sticker="(url) => { addStickerToCanvas(url); mobileDrawerVisible = false }"
        @add-emoji="(e) => { addEmojiToCanvas(e); mobileDrawerVisible = false }"
        @add-text="() => { handleAddText(); mobileDrawerVisible = false }"
        @update-selected-prop="handleUpdateSelectedProp"
        @update-image-filter="handleUpdateImageFilter"
        @reset-image-filters="resetImageFilters"
        @update:active-panel="activePanel = $event"
        @update:prop-collapse-active="propCollapseActive = $event"
        @add-block="handleAddBlock"
        @update-block="handleUpdateBlock"
        @remove-block="handleRemoveBlock"
        @apply-decor="handleApplyDecor"
        @clear-decor="handleClearDecor"
        @slider-commit="handleSliderCommit"
        @upload-free-photo-click="handleFreePhotoClick"
        @set-copy-mode="handleSetCopyMode"
        @replace-free-photo="handleReplaceFreePhoto"
      />
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EditorToolbar from '@/components/EditorToolbar.vue'
import EditorSidebar from '@/components/EditorSidebar.vue'
import EditorContextMenu from '@/components/EditorContextMenu.vue'
import MobilePropertyBar from '@/components/MobilePropertyBar.vue'
import { useEditorCore } from '@/composables/useEditorCore'
import { useEditorHistory } from '@/composables/useEditorHistory'
import { useEditorActions } from '@/composables/useEditorActions'
import { useEditorUI } from '@/composables/useEditorUI'
import { DEFAULT_BLOCK } from '@/utils/decorEngine'
import { uploadFile } from '@/api/export'

const route = useRoute()
const router = useRouter()
const projectId = route.params.projectId

// 编辑器模式（需求：相册/创意编辑器分离）：
// 相册 /editor = album（无创意模块）；创意 /creative-editor = creative（色块/装饰/自由照片）
const editorMode = ref(route.path.startsWith('/creative-editor') ? 'creative' : 'album')

const canvasRef = ref(null)
const canvasContainer = ref(null)
const canvasWrapper = ref(null)
const editorPageRef = ref(null)
const zoneFileInput = ref(null)

const isMobile = ref(false)
const mobileDrawerVisible = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}
checkMobile()
window.addEventListener('resize', checkMobile)

const core = useEditorCore(projectId)
const history = useEditorHistory()
const actions = useEditorActions()
const ui = useEditorUI()

// 仅开发模式：暴露核心句柄供自动化测试/调试（生产构建不含）
if (import.meta.env.DEV) {
  window.__editorCore = core
}

const {
  project, templatePages, systemStickers, currentPageNumber,
  zoomLevel, loading, projectPagesMap, currentPageImages,
  getCanvas, getCurrentZones, getPageScale, getPageOffset, getPageDimensions,
  getTemplateBackground,
  loadProject, loadTemplate, loadStickers, loadProjectPages,
  initCanvas, renderPage, getPagePreview,
  collectPageData, saveCurrentPage,
  uploadPhoto, uploadStickerFile, addStickerToCanvas, addTextToCanvas, addEmojiToCanvas,
  selectImageByZoneId,
  removePhotoFromZone,
  switchPage, saveDraft, submitProject,
  zoomIn, zoomOut, zoomToFit, applyZoomOnly, onCanvasWheel,
  reRenderWithZoom, dispose
} = core

const {
  canUndo, canRedo,
  pushHistory, clearHistory, undo, redo
} = history

const {
  textFormatState, fontList,
  deleteSelected, copySelected, pasteSelected,
  bringForward, sendBackward, bringToFront, sendToBack,
  alignObjects,
  toggleTextBold, toggleTextItalic, toggleTextUnderline,
  toggleTextShadow, toggleTextCutout,
  setTextAlign, updateTextFontFamily, updateTextFontSize, updateTextColor,
  updateTextFormatState, resetTextFormatState,
  updateImageFilter, resetImageFilters,
  setApplyEffectsFn,
  handleKeyDown: actionsHandleKeyDown
} = actions

const {
  selectedObjectInfo, contextMenu,
  autoSaveStatus, saving, submitting,
  activePanel, propCollapseActive,
  markDirty, getIsDirty,
  updateSelectedInfo, updateSelectedProp,
  onContextMenu, hideContextMenu,
  startAutoSave, stopAutoSave,
  switchPageWithSave, saveDraftWithUI, submitProjectWithUI, goBackWithConfirm
} = ui

const hasSelection = computed(() => selectedObjectInfo.value !== null)

// ============ 创意面板状态与处理器（主色块/装饰） ============
const hasMainBlock = ref(false)
const blockData = ref({})

function refreshCreativeState() {
  const b = core.collectMainBlock()
  hasMainBlock.value = !!b
  if (b) blockData.value = { ...b }
  const fp = core.getFreePhoto()
  freePhotoState.value = { has: !!fp, copyMode: fp?._copyMode || 'single' }
  canvasRatioLabel.value = editorMode.value === 'creative' ? core.getCanvasRatioId() : ''
}

// ============ 自由照片（创意拼贴照片入口，FR-B8/B9） ============
const freePhotoState = ref({ has: false, copyMode: 'single' })
// 画幅比例状态（M2：工具栏显示与切换）
const canvasRatioLabel = ref('')

async function handleSetCanvasRatio(ratioId) {
  try {
    await ElMessageBox.confirm(
      '切换画幅后，已有元素将按新画布重新排布，是否继续？',
      '切换画幅',
      { confirmButtonText: '切换', cancelButtonText: '取消', type: 'info' }
    )
  } catch {
    return
  }
  await core.setCanvasRatio(ratioId)
  refreshCreativeState()
  pushHistory()
  markDirty()
}
const freePhotoInput = ref(null)
let freePhotoReplaceMode = false

function handleFreePhotoClick() {
  freePhotoReplaceMode = false
  freePhotoInput.value.click()
}

async function handleFreePhotoFile(file) {
  try {
    const res = await uploadFile(file, `photos/${project.value?.userId}/${projectId}/free`)
    await core.addFreePhoto(res.data.data, { replace: freePhotoReplaceMode })
    pushHistory()
    markDirty()
    refreshCreativeState()
  } catch (err) {
    console.error('[Editor] 自由照片上传失败:', err)
    ElMessage.error('照片上传失败，请重试')
  }
}

function onFreePhotoFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  handleFreePhotoFile(file)
  e.target.value = ''
}

function handleSetCopyMode(mode) {
  core.setCopyMode(mode)
  pushHistory()
  markDirty()
  refreshCreativeState()
}

async function handleReplaceFreePhoto(file) {
  freePhotoReplaceMode = true
  await handleFreePhotoFile(file)
}

function handleAddBlock() {
  core.renderMainBlock(DEFAULT_BLOCK)
  pushHistory()
  markDirty()
  refreshCreativeState()
}

function handleUpdateBlock(patch) {
  core.refreshBlockFill(patch)
  pushHistory()
  markDirty()
  refreshCreativeState()
}

function handleRemoveBlock() {
  const rect = core.getMainBlock()
  if (!rect) return
  core.getCanvas().remove(rect)
  core.getCanvas().renderAll()
  pushHistory()
  markDirty()
  refreshCreativeState()
}

function handleApplyDecor(params) {
  // 切换分布保留手动放置的形状（参考站交互：切换分布模式保留手动形状）
  const existing = core.collectCreative().decorations
  const keptManual = (existing?.placed || []).filter(it => it.manual)
  core.renderDecorations({ params, placed: keptManual })
  pushHistory()
  markDirty()
}

function handleClearDecor() {
  core.renderDecorations(null)
  pushHistory()
  markDirty()
}

history.setCanvasGetter(() => core.getCanvas())
// 撤销/重做后修复无法序列化的对象（主色块条纹 Pattern 的 canvas source）
history.setRestoreHook(() => {
  const c = core.getCanvas()
  if (!c) return
  c.getObjects().forEach(obj => {
    if (obj._isMainBlock && obj._blockData) {
      obj.set({ fill: core.buildBlockFill(obj._blockData) })
    }
  })
  core.refreshCutoutFills()
  c.renderAll()
})
history.setAfterAction(() => {
  updateSelectedInfo()
  refreshCreativeState()
  markDirty()
})
actions.setCanvasGetter(() => core.getCanvas())
core.setCanvasContainerGetter(() => canvasContainer.value)
actions.setPageOffsetGetter(() => core.getPageOffset())
actions.setPageScaleGetter(() => core.getPageScale())
actions.setPageDimensionsGetter(() => core.getPageDimensions())
actions.setCurrentZonesGetter(() => core.getCurrentZones())
actions.setRemovePhotoFromZone((zoneId) => core.removePhotoFromZone(zoneId))
// 文字特效应用委托给 core（shadow/镂空 pattern）
setApplyEffectsFn((obj) => {
  core.applyTextEffects(obj)
  core.refreshCutoutFills()
})
actions.setAfterAction(() => {
  pushHistory()
  updateSelectedInfo()
  markDirty()
})

ui.setCanvasGetter(() => core.getCanvas())
ui.setTemplateBackgroundGetter(() => core.getTemplateBackground())
ui.setSaveCurrentPageFn(() => core.saveCurrentPage())
ui.setCollectPageDataFn(() => core.collectPageData())
ui.setProjectIdGetter(() => projectId)
ui.setCurrentPageNumberGetter(() => currentPageNumber.value)
ui.setThumbnailGetter(() => core.exportPageThumbnail(480))
ui.setProjectPagesMapGetter(() => projectPagesMap)
ui.setAfterAction(() => {
  updateSelectedInfo()
  refreshCreativeState()
  markDirty()
})

function onObjectModified() {
  core.refreshCutoutFills()
  pushHistory()
  updateSelectedInfo()
  refreshCreativeState()
  markDirty()
}

function onSelectionChange() {
  updateSelectedInfo()
  updateTextFormatState()
}

function onSelectionClear() {
  selectedObjectInfo.value = null
  updateTextFormatState()
}

function onKeyDown(e) {
  actionsHandleKeyDown(e, {
    undo,
    redo,
    saveDraft: handleSaveDraft,
    onSelectionChange,
    onSelectionClear
  })
}

const activeZoneId = ref(null)

function onZoneClick(zoneId) {
  activeZoneId.value = zoneId
  zoneFileInput.value.click()
}

function onZoneFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  uploadPhoto(file, activeZoneId.value)
  zoneFileInput.value.value = ''
  activeZoneId.value = null
}

function onCanvasContextMenu(e) {
  onContextMenu(e, canvasWrapper.value)
}

function onContextDelete() {
  hideContextMenu()
  deleteSelected()
}

function onContextCopy() {
  hideContextMenu()
  copySelected()
}

function onHideContextMenu() {
  hideContextMenu()
}

async function handleSwitchPage(pageNumber) {
  await switchPageWithSave(pageNumber, {
    loading,
    onSwitchPage: (pn) => switchPage(pn),
    onResetTextFormat: () => resetTextFormatState(),
    onClearHistory: () => clearHistory(),
    onRenderPage: async () => {
      await renderPage({
        onClearHistory: () => clearHistory(),
        onAfterRender: () => {
          pushHistory()
        }
      })
      refreshCreativeState()
    }
  })
}

async function handleSaveDraft() {
  await saveDraftWithUI(projectId)
}

// 滤镜拖动实时预览：rAF 节流（applyFilters 较重，避免每 tick 全量重算）
let filterRaf = 0
function handleUpdateImageFilter(type, val) {
  if (filterRaf) return
  filterRaf = requestAnimationFrame(() => {
    filterRaf = 0
    updateImageFilter(type, val)
  })
}

// 滑块松手：提交一次历史 + 脏标记 + 属性面板刷新（实时预览过程不推历史，由 pushHistory 防抖收敛）
function handleSliderCommit() {
  updateSelectedInfo()
  pushHistory()
  markDirty()
}

// 属性实时更新：透明度变化时同步 Copy Mode 镜像副本
function handleUpdateSelectedProp(prop, value) {
  updateSelectedProp(prop, value)
  if (prop === 'opacity') {
    const active = selectedObjectInfo.value?._fabricObj
    if (active) core.syncCopyPair(active)
  }
}

async function handleSubmitProject() {
  await submitProjectWithUI(projectId, (pid) => submitProject(pid, router), router)
}

async function handleGoBack() {
  await goBackWithConfirm(router)
}

function handleUploadSticker(file) {
  uploadStickerFile(file, project.value?.userId)
}

function handleAddText(presetText) {
  addTextToCanvas(presetText)
  pushHistory()
  markDirty()
}

async function handleZoomIn() {
  saveCurrentPage()
  zoomIn()
  applyZoomOnly()
  core.refreshCutoutFills()
  pushHistory()
}

async function handleZoomOut() {
  saveCurrentPage()
  zoomOut()
  applyZoomOnly()
  core.refreshCutoutFills()
  pushHistory()
}

async function handleZoomToFit() {
  saveCurrentPage()
  zoomToFit()
  applyZoomOnly()
  core.refreshCutoutFills()
  pushHistory()
}

function handleCanvasWheel(e) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  saveCurrentPage()
  onCanvasWheel(e)
  applyZoomOnly()
  pushHistory()
}

onMounted(async () => {
  loading.value = true
  try {
    await loadProject()
    // 类型纠偏：项目类型与入口路由不符时重定向到对应编辑器（相册↔创意分离）
    const tplType = project.value?.templateType || 'ALBUM'
    const expectedMode = tplType === 'CREATIVE' ? 'creative' : 'album'
    const expectedPath = expectedMode === 'creative' ? '/creative-editor/' : '/editor/'
    if (!route.path.startsWith(expectedPath)) {
      router.replace(expectedPath + projectId)
      return
    }
    editorMode.value = expectedMode
    await loadTemplate()
    await loadStickers()
    await loadProjectPages()
    await nextTick()
    core.setEditorMode(editorMode.value)
    initCanvas(canvasContainer.value, 'editorCanvas', {
      onZoneClick,
      onObjectModified,
      onSelectionChange,
      onSelectionClear,
      onHideContextMenu
    })
    await renderPage({
      onClearHistory: () => clearHistory(),
      onAfterRender: () => {
        pushHistory()
      }
    })
    refreshCreativeState()
    startAutoSave(projectId)
    canvasWrapper.value.addEventListener('wheel', handleCanvasWheel, { passive: false })
    document.addEventListener('click', hideContextMenu)
  } catch (e) {
    console.error('[Editor] 初始化失败:', e)
    ElMessage.error('加载编辑器失败，请刷新重试')
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  stopAutoSave()
  document.removeEventListener('click', hideContextMenu)
  window.removeEventListener('resize', checkMobile)
  if (canvasWrapper.value) {
    canvasWrapper.value.removeEventListener('wheel', handleCanvasWheel)
  }
  dispose()
})
</script>

<style scoped>
.editor-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f7;
  outline: none;
  overflow: hidden;
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor-canvas-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: auto;
  position: relative;
  background-color: #e8e8ed;
  background-image:
    radial-gradient(rgba(0, 0, 0, 0.06) 1px, transparent 1px);
  background-size: 24px 24px;
}

.editor-canvas-wrapper::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.25;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  background-size: 128px 128px;
}

.canvas-container {
  position: relative;
  z-index: 1;
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 4px 8px rgba(0, 0, 0, 0.04),
    0 12px 32px rgba(0, 0, 0, 0.06),
    0 0 0 1px rgba(255, 255, 255, 0.5) inset;
  width: 100%;
  height: 100%;
  max-width: 900px;
  max-height: 700px;
  transition: box-shadow 0.3s ease;
}

.editor-loading {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: saturate(200%) blur(28px);
  -webkit-backdrop-filter: saturate(200%) blur(28px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 9999;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.45);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3.5px solid rgba(0, 0, 0, 0.06);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.mobile-page-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  padding-bottom: env(safe-area-inset-bottom, 8px);
  background: rgba(248, 248, 248, 0.72);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-top: 0.5px solid rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  gap: 0;
  z-index: 100;
}

.mobile-page-thumbs {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  min-width: 0;
}

.mobile-page-thumbs::-webkit-scrollbar {
  display: none;
}

.mobile-page-thumb {
  width: 42px;
  height: 54px;
  border: 2px solid transparent;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.35);
  overflow: hidden;
  flex-shrink: 0;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: rgba(0, 0, 0, 0.04);
}

.mobile-page-thumb.active {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18);
}

.mobile-page-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-page-divider {
  width: 0.5px;
  height: 28px;
  background: rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}

.mobile-page-action {
  width: 44px;
  height: 44px;
  margin: 0 12px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.04);
  color: #1d1d1f;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, transform 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.mobile-page-action:active {
  background: rgba(0, 0, 0, 0.1);
  transform: scale(0.92);
}

.mobile-drawer :deep(.el-drawer) {
  background: #fff;
  border-radius: 16px 16px 0 0;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mobile-drawer :deep(.el-drawer__body) {
  padding: 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
}

.mobile-drawer :deep(.editor-sidebar) {
  width: 100%;
  border-right: none;
  height: auto;
  min-height: 100%;
  flex: 1;
  overflow: visible;
}

.mobile-drawer :deep(.editor-sidebar .sidebar-section:last-child) {
  padding-bottom: env(safe-area-inset-bottom, 24px);
}

.mobile-drawer :deep(.prop-collapse .el-collapse-item__header) {
  font-size: 13px;
  height: 36px;
  line-height: 36px;
  padding: 0 14px;
}

.mobile-drawer :deep(.prop-row) {
  gap: 14px;
  margin-bottom: 12px;
}

.mobile-drawer :deep(.prop-row label) {
  font-size: 12px;
  width: 60px;
}

.mobile-drawer :deep(.el-input__inner),
.mobile-drawer :deep(.el-input-number .el-input__inner) {
  font-size: 12px;
}

@media (max-width: 1024px) {
  .canvas-container {
    max-width: 100%;
    max-height: 500px;
  }
}

@media (max-width: 768px) {
  .editor-canvas-wrapper {
    padding: 10px;
    padding-bottom: 82px;
  }

  .canvas-container {
    border-radius: 8px;
    max-height: 100%;
  }
}

@media (max-width: 480px) {
  .editor-canvas-wrapper {
    padding: 4px;
    padding-bottom: 76px;
  }
}
</style>