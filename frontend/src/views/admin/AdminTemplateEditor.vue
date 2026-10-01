<template>
  <div class="editor-page" ref="editorPageRef" @keydown="onKeyDown" tabindex="0">
    <div v-if="core.loading.value" class="editor-loading">
      <div class="loading-spinner"></div>
      <span>加载编辑器中...</span>
    </div>

    <ZoneToolbar
      :title="templateName"
      :can-undo="core.canUndo.value"
      :can-redo="core.canRedo.value"
      :zoom-percent="Math.round(core.zoomLevel.value * 100)"
      :saving="core.saving.value"
      :dirty="core.dirty.value"
      :is-mobile="isMobile"
      @go-back="goBack"
      @undo="core.undo"
      @redo="core.redo"
      @zoom-in="core.zoomIn"
      @zoom-out="core.zoomOut"
      @zoom-to-fit="core.zoomToFit"
      @delete-selected="core.deleteSelectedZone"
      @save="handleSave"
    />

    <div class="editor-body">
      <ZoneToolRail
        :tool="core.tool.value"
        :selection-mode="core.selectionMode.value"
        @update:tool="core.setTool"
      />

      <div class="editor-canvas-wrapper" ref="canvasWrapper">
        <div class="canvas-container">
          <canvas id="adminZoneCanvas"></canvas>
        </div>
      </div>

      <ZoneSidebar
        v-if="!isMobile"
        :pages="core.pages.value"
        :current-page-number="core.currentPageNumber.value"
        :zones="core.zones.value"
        :selected-zone-index="core.selectedZoneIndex.value"
        :tool="core.tool.value"
        :new-zone-type="core.newZoneType.value"
        :selection-mode="core.selectionMode.value"
        :wand-tolerance="core.wandTolerance.value"
        :layers="core.layers.value"
        :applying="core.applying.value"
        @switch-page="core.switchPage"
        @upload-bg="handleUploadBg"
        @toggle-layer-visible="core.toggleLayerVisible"
        @apply-composite="core.applyComposite"
        @move-layer="core.moveLayer"
        @update:new-zone-type="core.newZoneType.value = $event"
        @update:selection-mode="core.selectionMode.value = $event"
        @update:wand-tolerance="core.wandTolerance.value = $event"
        @select-zone="core.selectZone"
        @remove-zone="core.removeZone"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import ZoneToolbar from '@/components/admin/ZoneToolbar.vue'
import ZoneToolRail from '@/components/admin/ZoneToolRail.vue'
import ZoneSidebar from '@/components/admin/ZoneSidebar.vue'
import { useZoneEditor } from '@/composables/useZoneEditor'
import { getTemplateById } from '@/api/template'

const route = useRoute()
const router = useRouter()
const templateId = route.params.id

const core = useZoneEditor(templateId)
if (import.meta.env.DEV) window.__zoneCore = core
const canvasWrapper = ref(null)
const editorPageRef = ref(null)
const isMobile = ref(window.innerWidth < 768)

const templateName = computed(() => core.template.value?.name || `模板 #${templateId}`)

const TOOL_KEYS = { v: 'select', m: 'rect', e: 'ellipse', l: 'lasso', p: 'polygon', w: 'wand' }

function onKeyDown(e) {
  const target = e.target
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    e.shiftKey ? core.redo() : core.undo()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    core.redo()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    handleSave()
    return
  }
  if (e.key === 'Escape') {
    core.cancelDrawing()
    return
  }
  if (e.key === 'Enter') {
    if (core.tool.value === 'polygon') core.finishPolygon()
    return
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault()
    if (core.tool.value === 'polygon') {
      core.polyUndoPoint()
    } else {
      core.deleteSelectedZone()
    }
    return
  }
  const tool = TOOL_KEYS[e.key.toLowerCase()]
  if (tool && !e.ctrlKey && !e.metaKey && !e.altKey) {
    core.setTool(tool)
  }
}

async function handleSave() {
  await core.saveZones()
}

async function handleUploadBg(file) {
  await core.uploadBackground(file)
}

async function goBack() {
  if (core.dirty.value) {
    try {
      await ElMessageBox.confirm('有未保存的区域修改，离开将丢失，是否继续？', '未保存提醒', {
        confirmButtonText: '放弃修改并离开',
        cancelButtonText: '留在本页',
        type: 'warning'
      })
    } catch (e) {
      return
    }
  }
  router.back()
}

onBeforeRouteLeave(async (to, from, next) => {
  if (!core.dirty.value) return next()
  try {
    await ElMessageBox.confirm('有未保存的区域修改，离开将丢失，是否继续？', '未保存提醒', {
      confirmButtonText: '放弃修改并离开',
      cancelButtonText: '留在本页',
      type: 'warning'
    })
    next()
  } catch (e) {
    next(false)
  }
})

function onWindowResize() {
  isMobile.value = window.innerWidth < 768
  if (canvasWrapper.value) core.renderPage()
}

function onWheel(e) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  if (e.deltaY < 0) core.zoomIn()
  else core.zoomOut()
}

onMounted(async () => {
  window.addEventListener('resize', onWindowResize)
  canvasWrapper.value.addEventListener('wheel', onWheel, { passive: false })
  editorPageRef.value.focus()
  try {
    const res = await getTemplateById(templateId)
    core.template.value = res.data.data || null
  } catch (e) {
    core.template.value = null
  }
  core.initCanvas(canvasWrapper.value, 'adminZoneCanvas')
  // 支持 /admin/templates/:id/zones?page=N 深链接定位到指定页
  const queryPage = parseInt(route.query.page)
  if (queryPage > 0) core.currentPageNumber.value = queryPage
  await core.loadTemplate()
  core.renderPage()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  if (canvasWrapper.value) {
    canvasWrapper.value.removeEventListener('wheel', onWheel)
  }
  core.dispose()
})
</script>

<style scoped>
/* 与用户编辑器 EditorView 同源的画布舞台视觉 */
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
  overflow: hidden;
  position: relative;
  background-color: #e8e8ed;
  background-image: radial-gradient(rgba(0, 0, 0, 0.06) 1px, transparent 1px);
  background-size: 24px 24px;
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
  max-width: 980px;
  max-height: 760px;
  overflow: hidden;
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

@media (max-width: 768px) {
  .editor-canvas-wrapper {
    padding: 10px;
  }
  .canvas-container {
    border-radius: 8px;
  }
}
</style>
