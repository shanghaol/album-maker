/**
 * 管理端模板区域编辑器核心（PS 式选择工具箱）。
 *
 * 与用户编辑器 useEditorCore 解耦：本 composable 面向"模板页 + 区域标注"，
 * 区域数据以形状 op 列表（见 utils/zoneGeometry.js）为内存真源，
 * 持久化时按 shape 拆回 template_zones 的列结构。
 */
import { ref, computed } from 'vue'
import { fabric } from 'fabric'
import { ElMessage } from 'element-plus'
import { getTemplatePages, getTemplateZones, saveTemplateZones, uploadPageBackground, saveTemplateLayers } from '@/api/template'
import {
  pageToScreen, screenToPage, zoneToOps, opsToZoneShape, opsBBox,
  simplifyPoints, floodSelectMask, maskToPolygon
} from '@/utils/zoneGeometry'

const ZONE_TYPE_COLORS = {
  PHOTO: { stroke: '#6366f1', fill: 'rgba(99, 102, 241, 0.18)' },
  TEXT: { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.15)' },
  COLOR_BLOCK: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.15)' },
  DECOR: { stroke: '#ec4899', fill: 'rgba(236, 72, 153, 0.13)' }
}
const SUBTRACT_STYLE = { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.12)' }

/** 新区域默认参数（与旧编辑器保持一致） */
function defaultZoneFields(zoneType) {
  const base = { zoneType, rotation: 0, sortOrder: 0 }
  if (zoneType === 'TEXT') {
    return { ...base, placeholderText: '请输入文字' }
  }
  if (zoneType === 'COLOR_BLOCK') {
    return { ...base, placeholderText: JSON.stringify({ color: '#ff8fab', style: 'solid' }) }
  }
  if (zoneType === 'DECOR') {
    return { ...base, placeholderText: JSON.stringify({ params: { chars: ['♥'], distribution: 'random', colors: ['#ffffff'], count: 12, size: 0.04 } }) }
  }
  return { ...base, placeholderText: '' }
}

export function useZoneEditor(templateId) {
  // ---------- 响应式状态 ----------
  const loading = ref(false)
  const saving = ref(false)
  const dirty = ref(false)
  const template = ref(null)
  const pages = ref([])
  const currentPageNumber = ref(1)
  const zones = ref([])
  const tool = ref('select') // select | rect | ellipse | lasso | polygon | wand
  const newZoneType = ref('PHOTO')
  const selectionMode = ref('new') // new | add | subtract
  const wandTolerance = ref(32)
  const zoomLevel = ref(1)
  const selectedZoneIndex = ref(-1)
  const undoCount = ref(0)
  const redoCount = ref(0)
  // ---------- PSD 分层模板图层（FR-54/55，D15）----------
  const layers = ref([]) // [{id,name,url,x,y,width,height,opacity,visible,zIndex}]（0-1 归一化）
  const applying = ref(false)
  const hasLayers = computed(() => layers.value.length > 0)

  const currentPage = computed(() => pages.value.find(p => p.pageNumber === currentPageNumber.value) || null)
  const canUndo = computed(() => undoCount.value > 0)
  const canRedo = computed(() => redoCount.value > 0)

  // ---------- 非响应式内部状态 ----------
  let canvas = null
  let wrapperEl = null
  let bgFabric = null // 背景图 fabric.Image（可拖拽对位，不持久化）
  let bgPixelCtx = null // 背景图离屏像素画布（魔棒用）
  let bgPixelW = 0
  let bgPixelH = 0
  let drawState = null // { startScreen, lastScreen, preview, points }
  let polyState = null // { points: [screen], marker, rubber }
  let undoStack = []
  let redoStack = []
  let renderToken = 0 // 渲染代数：异步 onload 回调过期防护（缩放/切页并发时丢弃旧渲染产物）
  let gestureSnapshot = null
  let antsRaf = 0
  let antsObjects = []

  function getLayout() {
    const cw = (wrapperEl && wrapperEl.clientWidth) || 800
    const ch = (wrapperEl && wrapperEl.clientHeight) || 600
    const pw = (currentPage.value && currentPage.value.width) || 2480
    const ph = (currentPage.value && currentPage.value.height) || 3508
    const fit = Math.min(cw / pw, ch / ph) * 0.85
    const scale = fit * zoomLevel.value
    return {
      canvasW: cw, canvasH: ch, pw, ph, scale,
      offsetX: (cw - pw * scale) / 2,
      offsetY: (ch - ph * scale) / 2
    }
  }

  // ---------- 数据加载 ----------
  async function loadTemplate() {
    loading.value = true
    try {
      const res = await getTemplatePages(templateId)
      pages.value = res.data.data || []
      const first = pages.value[0]
      if (first && !pages.value.some(p => p.pageNumber === currentPageNumber.value)) {
        currentPageNumber.value = first.pageNumber
      }
      await loadPageZones()
    } finally {
      loading.value = false
    }
  }

  async function loadPageZones() {
    zones.value = []
    layers.value = parseLayers(currentPage.value)
    undoStack = []
    redoStack = []
    undoCount.value = 0
    redoCount.value = 0
    dirty.value = false
    selectedZoneIndex.value = -1
    const page = currentPage.value
    if (!page) return
    try {
      const res = await getTemplateZones(page.id)
      zones.value = (res.data.data || []).map((z, idx) => ({
        ...defaultZoneFields(z.zoneType),
        id: z.id,
        zoneType: z.zoneType,
        shape: (z.shape || 'RECT').toUpperCase(),
        shapesJson: z.shapesJson || null,
        rotation: z.rotation || 0,
        sortOrder: z.sortOrder || idx,
        placeholderText: z.placeholderText || '',
        x: z.x || 0,
        y: z.y || 0,
        width: z.width || 0,
        height: z.height || 0,
        _ops: zoneToOps(z)
      }))
    } catch (e) {
      zones.value = []
    }
  }

  async function switchPage(pageNumber) {
    if (dirty.value) {
      try {
        await ElMessageBoxConfirm()
      } catch (e) {
        return
      }
    }
    currentPageNumber.value = pageNumber
    await loadPageZones()
    renderPage()
  }

  function ElMessageBoxConfirm() {
    return import('element-plus').then(({ ElMessageBox }) =>
      ElMessageBox.confirm('当前页有未保存的区域修改，切换后将丢失，是否继续？', '切换页面', {
        confirmButtonText: '继续切换',
        cancelButtonText: '留在本页',
        type: 'warning'
      })
    )
  }

  // ---------- 画布初始化与渲染 ----------
  function initCanvas(el, canvasId) {
    wrapperEl = el
    canvas = new fabric.Canvas(canvasId, {
      backgroundColor: 'transparent',
      selection: false,
      preserveObjectStacking: true
    })
    resizeCanvas()

    canvas.on('mouse:down', onPointerDown)
    canvas.on('mouse:move', onPointerMove)
    canvas.on('mouse:up', onPointerUp)
    canvas.on('mouse:dblclick', () => {
      if (tool.value === 'polygon') finishPolygon()
    })
    canvas.on('object:modified', onObjectModified)
    canvas.on('selection:created', syncSelection)
    canvas.on('selection:updated', syncSelection)
    canvas.on('selection:cleared', () => {
      // 绘制工具下 fabric 空点按下会清活动对象，但合并目标（加/减选的作用区域）需保持，
      // 仅在移动/选择工具下跟随 fabric 清除
      if (tool.value !== 'select') return
      selectedZoneIndex.value = -1
      stopAnts()
    })
  }

  function resizeCanvas() {
    if (!canvas || !wrapperEl) return
    canvas.setWidth(wrapperEl.clientWidth || 800)
    canvas.setHeight(wrapperEl.clientHeight || 600)
  }

  function applyToolInteraction() {
    if (!canvas) return
    const drawing = tool.value !== 'select'
    canvas.selection = false
    canvas.forEachObject(obj => {
      if (obj._isPageBg) {
        obj.selectable = false
        obj.evented = false
        return
      }
      const interactive = !drawing
      obj.selectable = interactive
      obj.evented = interactive
    })
    canvas.defaultCursor = drawing ? 'crosshair' : 'default'
    canvas.renderAll()
  }

  function setTool(t) {
    cancelDrawing()
    tool.value = t
    applyToolInteraction()
  }

  function addPageBounds(layout) {
    const p0 = pageToScreen(0, 0, layout)
    const rect = new fabric.Rect({
      left: p0.x,
      top: p0.y,
      width: layout.pw * layout.scale,
      height: layout.ph * layout.scale,
      fill: '#ffffff',
      stroke: 'rgba(0,0,0,0.12)',
      strokeWidth: 1,
      selectable: false,
      evented: false
    })
    rect._isPageBg = true
    canvas.add(rect)
    canvas.sendToBack(rect)
  }

  function addBackgroundImage(layout, token, callback) {
    const url = currentPage.value && currentPage.value.backgroundUrl
    if (!url) {
      callback && callback()
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!canvas || token !== renderToken) return
      const imgRatio = img.width / img.height
      const pageRatio = layout.pw / layout.ph
      let displayW
      let displayH
      if (imgRatio > pageRatio) {
        displayH = layout.ph * layout.scale
        displayW = displayH * imgRatio
      } else {
        displayW = layout.pw * layout.scale
        displayH = displayW / imgRatio
      }
      const scale = displayW / img.width
      const left = layout.offsetX + (layout.pw * layout.scale - displayW) / 2
      const top = layout.offsetY + (layout.ph * layout.scale - displayH) / 2
      const fabricImg = new fabric.Image(img, {
        left, top,
        scaleX: scale,
        scaleY: scale,
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        cornerColor: '#f59e0b',
        cornerSize: 10,
        transparentCorners: false,
        lockRotation: true,
        lockUniScaling: true
      })
      fabricImg._isBackground = true
      canvas.add(fabricImg)
      canvas.sendToBack(fabricImg)
      canvas.sendToBack(canvas.getObjects().find(o => o._isPageBg) || fabricImg)
      bgFabric = fabricImg
      prepareBgPixels(img)
      callback && callback()
      canvas.renderAll()
    }
    img.onerror = () => {
      if (!canvas || token !== renderToken) return
      ElMessage.warning('背景图加载失败，请重新上传')
      callback && callback()
    }
    img.src = url
  }

  /** 背景图离屏像素缓存（魔棒数据源，自然分辨率） */
  function prepareBgPixels(img) {
    bgPixelW = img.naturalWidth || img.width
    bgPixelH = img.naturalHeight || img.height
    const off = document.createElement('canvas')
    off.width = bgPixelW
    off.height = bgPixelH
    const ctx = off.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    bgPixelCtx = ctx
  }

  function buildZoneObject(zone, op, zoneIdx, opIdx, layout) {
    const style = op.op === 'subtract' ? SUBTRACT_STYLE : (ZONE_TYPE_COLORS[zone.zoneType] || ZONE_TYPE_COLORS.PHOTO)
    const common = {
      stroke: style.stroke,
      strokeWidth: 2,
      strokeDashArray: op.op === 'subtract' ? [4, 3] : [6, 3],
      strokeUniform: true,
      fill: style.fill,
      hasControls: true,
      hasBorders: true,
      cornerColor: style.stroke,
      cornerSize: 9,
      transparentCorners: false
    }
    let obj = null
    if (op.shape === 'polygon') {
      const pts = op.points.map(p => {
        const s = pageToScreen(p[0], p[1], layout)
        return { x: s.x, y: s.y }
      })
      const minX = Math.min(...pts.map(p => p.x))
      const minY = Math.min(...pts.map(p => p.y))
      const local = pts.map(p => ({ x: p.x - minX, y: p.y - minY }))
      obj = new fabric.Polygon(local, { left: minX, top: minY, ...common })
      obj._origLocal = local
    } else if (op.shape === 'ellipse') {
      const p0 = pageToScreen(op.x, op.y, layout)
      obj = new fabric.Ellipse({
        left: p0.x, top: p0.y,
        rx: (op.w * layout.pw * layout.scale) / 2,
        ry: (op.h * layout.ph * layout.scale) / 2,
        angle: op.angle || 0,
        ...common
      })
    } else {
      const p0 = pageToScreen(op.x, op.y, layout)
      obj = new fabric.Rect({
        left: p0.x, top: p0.y,
        width: op.w * layout.pw * layout.scale,
        height: op.h * layout.ph * layout.scale,
        angle: op.angle || 0,
        ...common
      })
    }
    obj._zoneIndex = zoneIdx
    obj._opIndex = opIdx
    return obj
  }

  function renderZones() {
    if (!canvas) return
    const layout = getLayout()
    // 移除旧区域对象（保留页面边界与背景）
    canvas.getObjects().filter(o => o._zoneIndex !== undefined).forEach(o => canvas.remove(o))
    zones.value.forEach((zone, zoneIdx) => {
      zoneToOps(zone).forEach((op, opIdx) => {
        // 优先使用内存 _ops（绘制过程中的实时几何），zoneToOps 已涵盖
        const useOp = zone._ops && zone._ops[opIdx] ? zone._ops[opIdx] : op
        canvas.add(buildZoneObject(zone, useOp, zoneIdx, opIdx, layout))
      })
    })
    applyToolInteraction()
    canvas.renderAll()
  }

  function renderPage() {
    if (!canvas) return
    const token = ++renderToken
    stopAnts()
    bgFabric = null
    bgPixelCtx = null
    canvas.clear()
    const layout = getLayout()
    resizeCanvas()
    addPageBounds(layout)
    const url = currentPage.value && currentPage.value.backgroundUrl
    if (url) {
      addBackgroundImage(layout, token, () => { renderLayers(token); renderZones() })
    } else {
      renderLayers(token)
      renderZones()
    }
  }

  /** 解析图层档案（FR-53）；坏数据降级为无图层 */
  function parseLayers(page) {
    if (!page || !page.layersJson) return []
    try {
      const arr = JSON.parse(page.layersJson)
      return Array.isArray(arr) ? arr.filter(l => l && l.url) : []
    } catch {
      return []
    }
  }

  /**
   * 图层渲染（FR-54）：背景之上、区域之下；可拖动/缩放，_layerIndex 标记。
   * 过期渲染防护：token 不匹配（缩放/切页已触发新一轮渲染）时丢弃 onload 产物，
   * 避免旧位置/大小的图层对象被加进新画布（修复缩放画面错乱）。
   */
  function renderLayers(token) {
    if (!canvas || layers.value.length === 0) return
    if (token === undefined) token = renderToken
    const layout = getLayout()
    layers.value.forEach((layer, i) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (!canvas || token !== renderToken) return
        const w = layer.width * layout.pw * layout.scale
        const h = layer.height * layout.ph * layout.scale
        const fabricImg = new fabric.Image(img, {
          left: layout.offsetX + layer.x * layout.pw * layout.scale,
          top: layout.offsetY + layer.y * layout.ph * layout.scale,
          scaleX: w / img.width,
          scaleY: h / img.height,
          opacity: layer.opacity == null ? 1 : layer.opacity,
          visible: layer.visible !== false,
          selectable: true,
          evented: true,
          hasControls: true,
          lockRotation: true,
          lockUniScaling: true,
          cornerColor: '#0ea5e9',
          cornerSize: 10
        })
        fabricImg._layerIndex = i
        // 层叠约束：背景 < 图层 < 区域。插入到首个区域对象之前（追加 add 会在异步晚到时盖住区域）
        const objs = canvas.getObjects()
        const zoneFirstIdx = objs.findIndex(o => o._zoneIndex !== undefined)
        if (zoneFirstIdx >= 0) {
          canvas.insertAt(fabricImg, zoneFirstIdx + i, false)
        } else {
          canvas.add(fabricImg)
        }
        canvas.renderAll()
      }
      img.src = layer.url
    })
  }

  /** 按当前 layers.value 重排画布图层对象（调序/撤销恢复后调用），保持层叠约束 */
  function refreshLayerObjects() {
    if (!canvas) return
    canvas.getObjects().filter(o => o._layerIndex !== undefined).forEach(o => canvas.remove(o))
    renderLayers()
  }

  /**
   * 管理员调整图层顺序（FR-54 补充，2026-09-29 用户需求）：dir=1 上移（向顶层）/ -1 下移。
   * 数组序即层叠序（应用合成与用户端渲染同源）；调整前进撤销栈。
   */
  function moveLayer(index, dir) {
    const to = index + dir
    if (index < 0 || to < 0 || to >= layers.value.length) return
    pushHistory()
    const arr = layers.value
    const [moved] = arr.splice(index, 1)
    arr.splice(to, 0, moved)
    arr.forEach((l, i) => { l.zIndex = i })
    refreshLayerObjects()
  }

  /** 图层显隐切换（FR-54） */
  function toggleLayerVisible(index) {
    const layer = layers.value[index]
    if (!layer) return
    layer.visible = layer.visible === false
    const obj = canvas && canvas.getObjects().find(o => o._layerIndex === index)
    if (obj) {
      obj.visible = layer.visible
      canvas.renderAll()
    }
  }

  /**
   * 应用合成（FR-55/D15）：将图层当前状态按层序合成写回页面背景；
   * 图层档案同步保存（含调整后位置），可反复进入再调。
   */
  async function applyComposite() {
    const page = currentPage.value
    if (!page || applying.value || layers.value.length === 0) return
    applying.value = true
    try {
      // 1) 离屏按页面原始尺寸合成可见图层
      const off = document.createElement('canvas')
      off.width = page.width || 2480
      off.height = page.height || 3508
      const ctx = off.getContext('2d')
      const ordered = layers.value.map((l, i) => ({ l, i }))
      for (const { l } of ordered) {
        if (l.visible === false) continue
        await drawLayer(ctx, l, off.width, off.height)
      }
      const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('合成失败')
      // 2) 写回页面背景 + 3) 保存图层档案（调整后位置）
      const compositeFile = new File([blob], 'composite.png', { type: 'image/png' })
      await uploadPageBackground(templateId, page.pageNumber, compositeFile, off.width, off.height)
      await saveTemplateLayers(page.id, JSON.stringify(layers.value))
      ElMessage.success('已应用合成：页面背景更新，图层档案保留可再调')
      dirty.value = false
      await loadTemplate()
      renderPage()
    } catch (e) {
      console.error('[useZoneEditor] 应用合成失败:', e)
      ElMessage.error('应用合成失败')
    } finally {
      applying.value = false
    }
  }

  function drawLayer(ctx, layer, pageW, pageH) {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        ctx.save()
        ctx.globalAlpha = layer.opacity == null ? 1 : layer.opacity
        ctx.drawImage(img, layer.x * pageW, layer.y * pageH, layer.width * pageW, layer.height * pageH)
        ctx.restore()
        resolve()
      }
      img.onerror = resolve // 单层绘制失败降级跳过
      img.src = layer.url
    })
  }

  // ---------- 绘制状态机 ----------
  function pointer(opt) {
    return canvas.getPointer(opt.e)
  }

  function effectiveMode(evt) {
    if (evt && evt.shiftKey) return 'add'
    if (evt && evt.altKey) return 'subtract'
    return selectionMode.value
  }

  function onPointerDown(opt) {
    const p = pointer(opt)
    // 选择工具下的手势（移动/缩放，含图层对象）在 fabric 内部完成，历史需在手势开始前留快照
    if (tool.value === 'select') {
      gestureSnapshot = snapshotState()
    }
    if (tool.value === 'wand') {
      runWand(p, opt.e)
      return
    }
    if (tool.value === 'polygon') {
      handlePolyClick(p)
      return
    }
    if (tool.value === 'select' || tool.value === undefined) return

    drawState = { startScreen: p, lastScreen: p, points: [p], preview: null, evt: opt.e }
    if (tool.value === 'rect' || tool.value === 'ellipse') {
      drawState.preview = new fabric.Rect({
        left: p.x, top: p.y, width: 1, height: 1,
        stroke: '#6366f1', strokeWidth: 1.5, strokeDashArray: [5, 3],
        fill: 'rgba(99, 102, 241, 0.12)', selectable: false, evented: false, visible: false
      })
    } else if (tool.value === 'lasso') {
      drawState.preview = new fabric.Polyline([{ x: p.x, y: p.y }], {
        stroke: '#6366f1', strokeWidth: 1.5, strokeDashArray: [5, 3],
        fill: 'rgba(99, 102, 241, 0.12)', selectable: false, evented: false
      })
    }
    if (drawState.preview) canvas.add(drawState.preview)
  }

  function onPointerMove(opt) {
    if (tool.value === 'polygon' && polyState && polyState.points.length) {
      const p = pointer(opt)
      updatePolyRubber(p)
      return
    }
    if (!drawState || !drawState.preview) return
    const p = pointer(opt)
    drawState.lastScreen = p
    const s = drawState.startScreen
    if (tool.value === 'rect' || tool.value === 'ellipse') {
      drawState.preview.set({
        left: Math.min(s.x, p.x),
        top: Math.min(s.y, p.y),
        width: Math.abs(p.x - s.x),
        height: Math.abs(p.y - s.y),
        visible: true
      })
      drawState.preview.setCoords()
    } else if (tool.value === 'lasso') {
      const pts = drawState.points
      const lastPt = pts[pts.length - 1]
      if (Math.hypot(p.x - lastPt.x, p.y - lastPt.y) > 3) pts.push({ x: p.x, y: p.y })
      drawState.preview.set('points', pts.slice())
      drawState.preview.setCoords()
    }
    canvas.renderAll()
  }

  function onPointerUp(opt) {
    if (!drawState) return
    const p = pointer(opt)
    const layout = getLayout()
    const s = drawState.startScreen
    let op = null
    if (tool.value === 'rect') {
      const p00 = screenToPage(Math.min(s.x, p.x), Math.min(s.y, p.y), layout)
      const p11 = screenToPage(Math.max(s.x, p.x), Math.max(s.y, p.y), layout)
      if (p11.x - p00.x > 0.004 && p11.y - p00.y > 0.004) {
        op = { op: 'add', shape: 'rect', x: p00.x, y: p00.y, w: p11.x - p00.x, h: p11.y - p00.y, angle: 0 }
      }
    } else if (tool.value === 'ellipse') {
      const p00 = screenToPage(Math.min(s.x, p.x), Math.min(s.y, p.y), layout)
      const p11 = screenToPage(Math.max(s.x, p.x), Math.max(s.y, p.y), layout)
      if (p11.x - p00.x > 0.004 && p11.y - p00.y > 0.004) {
        op = { op: 'add', shape: 'ellipse', x: p00.x, y: p00.y, w: p11.x - p00.x, h: p11.y - p00.y, angle: 0 }
      }
    } else if (tool.value === 'lasso') {
      op = lassoToOp(layout)
    }
    cancelDrawing()
    if (op) commitOp(op, effectiveMode(opt.e))
  }

  function lassoToOp(layout) {
    const pts = drawState ? drawState.points : []
    if (pts.length < 3) return null
    const epsScreen = 3 / (layout.pw * layout.scale)
    const norm = pts.map(p => screenToPage(p.x, p.y, layout)).map(p => [p.x, p.y])
    const simplified = simplifyPoints(norm, epsScreen, true)
    if (simplified.length < 3) return null
    return { op: 'add', shape: 'polygon', points: simplified }
  }

  function cancelDrawing() {
    if (drawState && drawState.preview) canvas.remove(drawState.preview)
    drawState = null
    clearPolyPreview()
    canvas && canvas.renderAll()
  }

  // ---------- 多边形套索 ----------
  function handlePolyClick(p) {
    if (!polyState) {
      polyState = { points: [{ x: p.x, y: p.y }], marker: null, poly: null, rubber: null }
      const marker = new fabric.Circle({
        left: p.x - 4, top: p.y - 4, radius: 4,
        fill: '#6366f1', stroke: '#fff', strokeWidth: 1.5,
        selectable: false, evented: false
      })
      polyState.marker = marker
      canvas.add(marker)
      return
    }
    const first = polyState.points[0]
    if (polyState.points.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) < 10) {
      finishPolygon()
      return
    }
    polyState.points.push({ x: p.x, y: p.y })
    refreshPolyPreview()
  }

  function refreshPolyPreview() {
    if (!polyState) return
    if (polyState.poly) canvas.remove(polyState.poly)
    if (polyState.points.length >= 2) {
      polyState.poly = new fabric.Polyline(polyState.points.slice(), {
        stroke: '#6366f1', strokeWidth: 1.5, strokeDashArray: [5, 3],
        fill: 'rgba(99, 102, 241, 0.08)', selectable: false, evented: false
      })
      canvas.add(polyState.poly)
    }
    canvas.renderAll()
  }

  function updatePolyRubber(p) {
    if (!polyState) return
    if (polyState.rubber) canvas.remove(polyState.rubber)
    const last = polyState.points[polyState.points.length - 1]
    polyState.rubber = new fabric.Line([last.x, last.y, p.x, p.y], {
      stroke: 'rgba(99, 102, 241, 0.6)', strokeWidth: 1.2, strokeDashArray: [3, 3],
      selectable: false, evented: false
    })
    canvas.add(polyState.rubber)
    canvas.renderAll()
  }

  function finishPolygon() {
    if (!polyState || polyState.points.length < 3) {
      cancelDrawing()
      return
    }
    const layout = getLayout()
    const pts = polyState.points
    const norm = pts.map(p => screenToPage(p.x, p.y, layout)).map(p => [p.x, p.y])
    const simplified = simplifyPoints(norm, 1 / (layout.pw * layout.scale), true)
    clearPolyPreview()
    polyState = null
    canvas.renderAll()
    if (simplified.length >= 3) {
      commitOp({ op: 'add', shape: 'polygon', points: simplified }, effectiveMode(null))
    }
  }

  function polyUndoPoint() {
    if (!polyState) return
    polyState.points.pop()
    if (!polyState.points.length) {
      cancelDrawing()
      return
    }
    refreshPolyPreview()
  }

  function clearPolyPreview() {
    if (!polyState) return
    ;[polyState.marker, polyState.poly, polyState.rubber].forEach(o => o && canvas.remove(o))
  }

  // ---------- 魔棒 ----------
  function runWand(pScreen, evt) {
    if (!bgFabric || !bgPixelCtx) {
      ElMessage.warning('请先上传背景图，再使用魔棒工具')
      return
    }
    const ix = Math.floor((pScreen.x - bgFabric.left) / bgFabric.scaleX)
    const iy = Math.floor((pScreen.y - bgFabric.top) / bgFabric.scaleY)
    if (ix < 0 || ix >= bgPixelW || iy < 0 || iy >= bgPixelH) {
      ElMessage.warning('请点击背景图上的图案区域')
      return
    }
    const imageData = bgPixelCtx.getImageData(0, 0, bgPixelW, bgPixelH)
    const mask = floodSelectMask(imageData, bgPixelW, bgPixelH, ix, iy, wandTolerance.value)
    if (!mask) {
      ElMessage.warning('请点击背景图上的图案区域')
      return
    }
    const poly = maskToPolygon(mask, bgPixelW, bgPixelH, { maxPoints: 300 })
    if (!poly || poly.length < 3) {
      ElMessage.warning('识别到的区域过小，请调整容差后重试')
      return
    }
    const layout = getLayout()
    const points = poly.map(([px, py]) => {
      const n = screenToPage(bgFabric.left + px * bgFabric.scaleX, bgFabric.top + py * bgFabric.scaleY, layout)
      return [n.x, n.y]
    })
    commitOp({ op: 'add', shape: 'polygon', points }, effectiveMode(evt))
    ElMessage.success(`魔棒识别到 ${points.length} 个顶点的区域`)
  }

  // ---------- op 提交（新建区域 / 加选 / 减选） ----------
  function commitOp(op, mode) {
    const selectedBefore = selectedZoneIndex.value
    op = { ...op, op: mode === 'subtract' ? 'subtract' : 'add' }
    let targetIdx = selectedZoneIndex.value
    if (import.meta.env.DEV) {
      window.__lastCommit = { mode, selectedBefore, selMode: selectionMode.value, count: zones.value.length }
    }
    // 历史在变更前入栈，撤销才能回到变更前
    pushHistory()
    if (mode === 'new' || targetIdx < 0 || targetIdx >= zones.value.length) {
      const zone = {
        ...defaultZoneFields(newZoneType.value),
        shape: 'RECT',
        shapesJson: null,
        x: 0, y: 0, width: 0, height: 0,
        sortOrder: zones.value.length,
        _ops: [op]
      }
      zones.value.push(zone)
      targetIdx = zones.value.length - 1
    } else {
      zones.value[targetIdx]._ops.push(op)
    }
    syncZoneFields(zones.value[targetIdx])
    dirty.value = true
    renderZones()
    // fabric 在本次 mouse:up 分发结束后还会执行自身的选区清理（selection:cleared），
    // 若同步 setActiveObject 会被其覆盖，故延后到事件循环下一拍恢复选中
    const idxToSelect = targetIdx
    setTimeout(() => selectZone(idxToSelect), 0)
  }

  /** 由 _ops 重算持久化字段（shape / shapesJson / bbox / rotation） */
  function syncZoneFields(zone) {
    const ops = zone._ops
    zone.shape = opsToZoneShape(ops)
    if (zone.shape === 'POLYGON' || zone.shape === 'COMPOUND') {
      zone.shapesJson = JSON.stringify(ops)
    } else {
      zone.shapesJson = null
    }
    const bbox = opsBBox(ops)
    zone.x = bbox.x
    zone.y = bbox.y
    zone.width = bbox.width
    zone.height = bbox.height
    zone.rotation = ops.length === 1 && ops[0].shape !== 'polygon' ? (ops[0].angle || 0) : 0
  }

  // ---------- 选中与对象修改 ----------
  function syncSelection(e) {
    const obj = e.target
    stopAnts()
    if (!obj || obj._zoneIndex === undefined) {
      selectedZoneIndex.value = -1
      return
    }
    selectedZoneIndex.value = obj._zoneIndex
    startAnts(obj)
  }

  function selectZone(idx) {
    const obj = canvas && canvas.getObjects().find(o => o._zoneIndex === idx)
    if (obj) {
      canvas.setActiveObject(obj)
      syncSelection({ target: obj })
      canvas.renderAll()
    }
  }

  function deleteSelectedZone() {
    const idx = selectedZoneIndex.value
    if (idx < 0) return
    pushHistory()
    zones.value.splice(idx, 1)
    selectedZoneIndex.value = -1
    canvas.discardActiveObject()
    dirty.value = true
    renderZones()
  }

  function removeZone(idx) {
    pushHistory()
    zones.value.splice(idx, 1)
    if (selectedZoneIndex.value === idx) {
      selectedZoneIndex.value = -1
      canvas && canvas.discardActiveObject()
    }
    dirty.value = true
    renderZones()
  }

  function onObjectModified(e) {
    const obj = e.target
    if (!obj) return
    if (obj._isBackground) {
      gestureSnapshot = null // 背景对位不进历史
      return
    }
    if (obj._layerIndex !== undefined) {
      // 图层拖动/缩放：回写归一化位置，并压入手势开始前的快照（图层操作可撤销）
      const layer = layers.value[obj._layerIndex]
      if (layer) {
        const layout = getLayout()
        layer.x = Math.max(0, Math.min(1, (obj.left - layout.offsetX) / (layout.pw * layout.scale)))
        layer.y = Math.max(0, Math.min(1, (obj.top - layout.offsetY) / (layout.ph * layout.scale)))
        layer.width = Math.max(0.001, (obj.width * obj.scaleX) / (layout.pw * layout.scale))
        layer.height = Math.max(0.001, (obj.height * obj.scaleY) / (layout.ph * layout.scale))
      }
      if (gestureSnapshot) {
        undoStack.push(gestureSnapshot)
        if (undoStack.length > 50) undoStack.shift()
        redoStack = []
        undoCount.value = undoStack.length
        redoCount.value = 0
        gestureSnapshot = null
      }
      return
    }
    if (obj._zoneIndex === undefined) return
    const zone = zones.value[obj._zoneIndex]
    const op = zone && zone._ops && zone._ops[obj._opIndex]
    if (!op) return
    const layout = getLayout()
    if (op.shape === 'polygon') {
      bakePolygonTransform(obj, op, layout)
    } else {
      op.x = Math.max(0, Math.min(1, (obj.left - layout.offsetX) / (layout.pw * layout.scale)))
      op.y = Math.max(0, Math.min(1, (obj.top - layout.offsetY) / (layout.ph * layout.scale)))
      op.w = Math.max(0.001, (obj.width * obj.scaleX) / (layout.pw * layout.scale))
      op.h = Math.max(0.001, (obj.height * obj.scaleY) / (layout.ph * layout.scale))
      op.angle = obj.angle || 0
    }
    syncZoneFields(zone)
    dirty.value = true
    // 移动/缩放：压入手势开始前的快照，撤销才能回到拖拽前
    if (gestureSnapshot) {
      undoStack.push(gestureSnapshot)
      if (undoStack.length > 50) undoStack.shift()
      redoStack = []
      undoCount.value = undoStack.length
      redoCount.value = 0
      gestureSnapshot = null
    }
  }

  /** 将 Polygon 的移动/缩放/旋转经变换矩阵烘焙回顶点，再重建对象 */
  function bakePolygonTransform(obj, op, layout) {
    const m = obj.calcTransformMatrix()
    const screenPts = (obj._origLocal || []).map(p => fabric.util.transformPoint(new fabric.Point(p.x, p.y), m))
    const norm = screenPts.map(s => screenToPage(s.x, s.y, layout)).map(p => [p.x, p.y])
    op.points = norm
    // 烘焙后重建：points 已含全部变换，scale/angle 归零
    const oldIdx = canvas.getObjects().indexOf(obj)
    const rebuilt = buildZoneObject(zones.value[obj._zoneIndex], op, obj._zoneIndex, obj._opIndex, layout)
    canvas.remove(obj)
    canvas.insertAt(rebuilt, oldIdx, false)
    rebuilt._origLocal = rebuilt.points.map(p => ({ x: p.x, y: p.y }))
    canvas.setActiveObject(rebuilt)
  }

  // ---------- 蚂蚁线 ----------
  function startAnts(obj) {
    stopAnts()
    antsObjects = [obj]
    let offset = 0
    const tick = () => {
      offset = (offset + 0.35) % 9
      antsObjects.forEach(o => {
        if (canvas.getObjects().includes(o)) {
          o.set('strokeDashOffset', -offset)
        }
      })
      canvas.renderAll()
      antsRaf = requestAnimationFrame(tick)
    }
    antsRaf = requestAnimationFrame(tick)
  }

  function stopAnts() {
    if (antsRaf) {
      cancelAnimationFrame(antsRaf)
      antsRaf = 0
    }
    if (antsObjects.length && canvas) {
      antsObjects.forEach(o => o.set && o.set('strokeDashOffset', 0))
      antsObjects = []
      canvas.renderAll()
    }
  }

  // ---------- 缩放 ----------
  function zoomIn() {
    zoomLevel.value = Math.min(3, Math.round(zoomLevel.value * 1.2 * 100) / 100)
    renderPage()
  }

  function zoomOut() {
    zoomLevel.value = Math.max(0.4, Math.round((zoomLevel.value / 1.2) * 100) / 100)
    renderPage()
  }

  function zoomToFit() {
    zoomLevel.value = 1
    renderPage()
  }

  // ---------- 历史（区域 + 图层双状态快照；图层手势与调序均可撤销，修复"撤回不可用"） ----------
  function snapshotZones() {
    return JSON.parse(JSON.stringify(zones.value))
  }

  function snapshotState() {
    return { zones: snapshotZones(), layers: JSON.parse(JSON.stringify(layers.value)) }
  }

  function pushHistory() {
    undoStack.push(snapshotState())
    if (undoStack.length > 50) undoStack.shift()
    redoStack = []
    undoCount.value = undoStack.length
    redoCount.value = 0
  }

  function undo() {
    if (!undoStack.length) return
    redoStack.push(snapshotState())
    const state = undoStack.pop()
    zones.value = state.zones
    layers.value = state.layers
    undoCount.value = undoStack.length
    redoCount.value = redoStack.length
    canvas && canvas.discardActiveObject()
    selectedZoneIndex.value = -1
    dirty.value = true
    renderZones()
    refreshLayerObjects()
  }

  function redo() {
    if (!redoStack.length) return
    undoStack.push(snapshotState())
    const state = redoStack.pop()
    zones.value = state.zones
    layers.value = state.layers
    undoCount.value = undoStack.length
    redoCount.value = redoStack.length
    canvas && canvas.discardActiveObject()
    selectedZoneIndex.value = -1
    dirty.value = true
    renderZones()
    refreshLayerObjects()
  }

  // ---------- 背景上传 ----------
  async function uploadBackground(file) {
    const page = currentPage.value
    if (!page) return
    loading.value = true
    try {
      await uploadPageBackground(templateId, page.pageNumber, file)
      const res = await getTemplatePages(templateId)
      pages.value = res.data.data || []
      dirty.value = false // 背景即时生效，与区域脏状态解耦
      renderPage()
      ElMessage.success('背景图已更新')
    } catch (e) {
      ElMessage.error('背景图上传失败')
    } finally {
      loading.value = false
    }
  }

  // ---------- 保存 ----------
  async function saveZones() {
    const page = currentPage.value
    if (!page) {
      ElMessage.error('页面数据加载失败')
      return
    }
    if (!page.backgroundUrl) {
      ElMessage.error('请先上传背景图')
      return
    }
    saving.value = true
    try {
      const payload = zones.value.map((z, idx) => {
        syncZoneFields(z)
        return {
          zoneType: z.zoneType,
          shape: z.shape,
          shapesJson: z.shapesJson,
          x: z.x,
          y: z.y,
          width: z.width,
          height: z.height,
          rotation: z.rotation || 0,
          placeholderText: z.placeholderText || '',
          sortOrder: idx
        }
      })
      await saveTemplateZones(page.id, payload)
      dirty.value = false
      ElMessage.success('区域已保存')
    } catch (e) {
      ElMessage.error('保存失败，请重试')
    } finally {
      saving.value = false
    }
  }

  function dispose() {
    stopAnts()
    cancelDrawing()
    if (canvas) {
      canvas.dispose()
      canvas = null
    }
  }

  return {
    // 状态
    loading, saving, dirty, template, pages, currentPage, currentPageNumber,
    zones, tool, newZoneType, selectionMode, wandTolerance, zoomLevel,
    selectedZoneIndex, canUndo, canRedo,
    layers, hasLayers, applying,
    // 方法
    loadTemplate, switchPage, initCanvas, renderPage, renderZones,
    setTool, cancelDrawing, finishPolygon, polyUndoPoint,
    deleteSelectedZone, removeZone, selectZone,
    zoomIn, zoomOut, zoomToFit, undo, redo,
    uploadBackground, saveZones, dispose,
    toggleLayerVisible, applyComposite, moveLayer
  }
}
