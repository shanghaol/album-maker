import { ref, computed } from 'vue'
import { getProjectById, getProjectPages, saveProjectPage, submitProject as submitProjectApi } from '@/api/project'
import { getTemplatePages, getTemplateZones } from '@/api/template'
import { getStickers } from '@/api/sticker'
import { uploadFile } from '@/api/export'
import { ElMessage } from 'element-plus'
import { fabric } from 'fabric'
import { normalizeStorageUrl } from '@/utils/storage'
import { parsePageData } from '@/utils/pageData'
import { normalizeBlock, generateDistribution, normalizeDecorParams, DEFAULT_BLOCK, CANVAS_RATIOS, pickClosestRatio, refitPhotoRect } from '@/utils/decorEngine'
import { zoneToOps } from '@/utils/zoneGeometry'

/**
 * 编辑器坐标体系（核心约定）：
 *
 * 页面尺寸：templatePages.width/height（如 2480×3508），是"页面像素"的基准。
 * pageScale：页面在画布上的缩放系数 = min(容器宽/页宽, 容器高/页高) × 0.85 × zoomLevel。
 * 屏幕坐标 = pageOffset + 归一化坐标 × 页面尺寸 × pageScale。
 *
 * pageData 持久化时一律使用归一化坐标 + 页面像素字号（见 utils/pageData.js），
 * 保证同一份数据在任意窗口尺寸/缩放级别下编辑与 H5 预览渲染一致：
 *  - 收集(collectPageData)：屏幕值 ÷ pageScale → 存储值
 *  - 渲染(renderOverlayAsync / addXXX)：存储值 × pageScale → 屏幕值
 */

export function useEditorCore(projectId) {
  const project = ref(null)
  const templatePages = ref([])
  const systemStickers = ref([])
  const currentPageNumber = ref(1)
  const zoomLevel = ref(1)
  const loading = ref(false)
  const projectPagesMap = ref({})

  let canvas = null
  let templateBackground = null
  let currentZones = []
  let pageOffsetX = 0
  let pageOffsetY = 0
  let pageScale = 1
  let pageW = 2480
  let pageH = 3508
  let _isRendering = false
  let _canvasContainerGetter = () => null
  // 编辑器模式（条目3/M1）：creative = 空画布起步（跳过模板背景/zone 占位/预置渲染）
  let _editorMode = 'album'

  function setEditorMode(mode) {
    _editorMode = mode === 'creative' ? 'creative' : 'album'
  }

  function getEditorMode() {
    return _editorMode
  }

  const currentPageImages = computed(() => {
    const data = projectPagesMap.value[currentPageNumber.value]
    if (!data || !data.photoZones) return []
    return data.photoZones.filter(p => p.imageUrl)
  })

  function getCanvas() { return canvas }
  function getCurrentZones() { return currentZones }
  function getPageScale() { return pageScale }
  function getPageOffset() { return { pageOffsetX, pageOffsetY } }
  function getPageDimensions() { return { pageW, pageH } }
  function isRendering() { return _isRendering }
  function setRendering(v) { _isRendering = v }
  function getTemplateBackground() { return templateBackground }
  function setCanvasContainerGetter(fn) { _canvasContainerGetter = fn }
  function getCanvasContainer() { return _canvasContainerGetter() }

  async function loadProject() {
    const res = await getProjectById(projectId)
    project.value = res.data.data
  }

  async function loadTemplate() {
    const res = await getTemplatePages(project.value.templateId)
    templatePages.value = res.data.data || []
  }

  async function loadStickers() {
    try {
      const res = await getStickers()
      systemStickers.value = res.data.data || []
    } catch (e) {
      console.error('[Editor] 加载贴纸失败:', e)
      ElMessage.error('加载贴纸失败，请刷新重试')
    }
  }

  async function loadProjectPages() {
    try {
      const res = await getProjectPages(projectId)
      const pages = res.data.data || []
      pages.forEach(p => {
        projectPagesMap.value[p.pageNumber] = parsePageData(p.pageData)
      })
    } catch (e) {
      console.error('[Editor] 加载项目页面失败:', e)
      ElMessage.error('加载项目数据失败，请刷新重试')
      throw e
    }
  }

  function computeScaleOffset() {
    const tplPage = templatePages.value.find(p => p.pageNumber === currentPageNumber.value)
    const container = _canvasContainerGetter()
    if (!container) return
    const containerW = container.clientWidth
    const containerH = container.clientHeight
    const pw = tplPage?.width || 2480
    const ph = tplPage?.height || 3508
    pageScale = Math.min(containerW / pw, containerH / ph) * 0.85 * zoomLevel.value
    pageOffsetX = (containerW - pw * pageScale) / 2
    pageOffsetY = (containerH - ph * pageScale) / 2
  }

  function initCanvas(canvasContainerEl, canvasElId, callbacks) {
    const container = canvasContainerEl
    const w = container.clientWidth || 800
    const h = container.clientHeight || 600
    canvas = new fabric.Canvas(canvasElId, {
      width: w,
      height: h,
      backgroundColor: '#e8e8e8',
      preserveObjectStacking: true
    })

    canvas.on('mouse:down', (e) => {
      if (!e.target) {
        if (callbacks.onHideContextMenu) callbacks.onHideContextMenu()
        return
      }
      if (e.target._isZoneRect && e.target._zoneId) {
        e.e.preventDefault()
        e.e.stopPropagation()
        callbacks.onZoneClick(e.target._zoneId)
      }
    })

    canvas.on('object:modified', (e) => {
      if (!e.target || _isRendering) return
      const obj = e.target
      if (obj._zoneId && obj.type === 'image' && !obj.isSticker) {
        constrainPhotoToZone(obj)
      }
      if (callbacks.onObjectModified) callbacks.onObjectModified()
    })

    // 自由照片镜像联动：拖拽/缩放/旋转过程中实时同步（参考站共享偏移语义）
    const liveSync = (e) => {
      if (e.target && e.target._copyGroupId) syncCopyPair(e.target)
    }
    canvas.on('object:moving', liveSync)
    canvas.on('object:scaling', liveSync)
    canvas.on('object:rotating', liveSync)

    // 框选兜底：把不可选中对象（虚线框等辅助元素）从选组中剔除
    const sanitizeSelection = (e) => {
      if (callbacks.onSelectionChange) callbacks.onSelectionChange()
      const active = canvas.getActiveObject()
      if (!active || active.type !== 'activeselection' || !e.selection) return
      const helpers = e.selection.filter(o => o.selectable === false)
      if (!helpers.length) return
      helpers.forEach(o => active.remove(o))
      if (!active.getObjects().length) canvas.discardActiveObject()
      canvas.requestRenderAll()
    }

    canvas.on('selection:created', sanitizeSelection)

    canvas.on('selection:updated', sanitizeSelection)

    canvas.on('selection:cleared', () => {
      if (callbacks.onSelectionClear) callbacks.onSelectionClear()
    })

    // 触屏手势（需求 FR-B5，参考站同款）：双击删除装饰/文字，长按复制装饰
    canvas.on('mouse:dblclick', (e) => {
      const obj = e.target
      if (!obj) return
      if (obj._isDecor) {
        canvas.remove(obj)
        canvas.renderAll()
        if (callbacks.onObjectModified) callbacks.onObjectModified()
      }
    })

    let longPressTimer = null
    canvas.on('mouse:down', (e) => {
      const obj = e.target
      if (!obj || !obj._isDecor) return
      longPressTimer = setTimeout(() => {
        longPressTimer = null
        obj.clone((cloned) => {
          cloned.set({ left: obj.left + 30, top: obj.top + 30 })
          cloned._isDecor = true
          cloned._decorManual = true
          cloned._decorParams = obj._decorParams
          cloned._layerType = 'decor'
          canvas.add(cloned)
          canvas.setActiveObject(cloned)
          canvas.renderAll()
          if (callbacks.onObjectModified) callbacks.onObjectModified()
        })
      }, 600)
    })
    const cancelLongPress = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
    }
    canvas.on('mouse:move', cancelLongPress)
    canvas.on('mouse:up', cancelLongPress)

    zoomLevel.value = 1
  }

  async function loadZones() {
    // creative 模式不加载 zone（空画布，条目3；也省一次请求）
    if (_editorMode === 'creative') {
      currentZones = []
      return
    }
    const tplPage = templatePages.value.find(p => p.pageNumber === currentPageNumber.value)
    if (!tplPage) return
    try {
      const res = await getTemplateZones(tplPage.id)
      currentZones = res.data.data || []
    } catch (e) {
      currentZones = []
    }
  }

  // ============================================================
  // 创意元素：主色块（单例）与装饰（需求 FR-B1/B2，模型对齐参考站）
  // 屏幕坐标 = pageOffset + 归一化 × 页面尺寸 × pageScale（与现有体系一致）
  // ============================================================

  /** 条纹 pattern（离屏 canvas）；纯色返回色值字符串 */
  function buildBlockFill(blockData) {
    if (blockData.style !== 'stripe') return blockData.color
    const cell = Math.max(2, (pageW * pageScale) / Math.max(2, blockData.stripeDensity))
    const tile = document.createElement('canvas')
    tile.width = blockData.stripeDir === 'h' ? 8 : cell
    tile.height = blockData.stripeDir === 'h' ? cell : 8
    const ctx = tile.getContext('2d')
    ctx.fillStyle = blockData.color2
    ctx.fillRect(0, 0, tile.width, tile.height)
    ctx.fillStyle = blockData.color
    if (blockData.stripeDir === 'h') {
      ctx.fillRect(0, 0, tile.width, cell / 2)
    } else {
      ctx.fillRect(0, 0, cell / 2, tile.height)
    }
    return new fabric.Pattern({ source: tile, repeat: 'repeat' })
  }

  function getMainBlock() {
    return canvas?.getObjects().find(o => o._isMainBlock) || null
  }

  /** 创建/替换主色块（pageData.block 为归一化参数） */
  function renderMainBlock(blockData) {
    if (!canvas) return
    const old = getMainBlock()
    if (old) canvas.remove(old)
    if (!blockData) return
    const b = normalizeBlock(blockData)
    const rect = new fabric.Rect({
      left: pageOffsetX + b.x * pageW * pageScale,
      top: pageOffsetY + b.y * pageH * pageScale,
      width: b.w * pageW * pageScale,
      height: b.h * pageH * pageScale,
      fill: buildBlockFill(b),
      hasControls: true,
      hasBorders: true,
      cornerColor: '#f472b6',
      cornerSize: 10
    })
    rect._isMainBlock = true
    rect._layerType = 'mainBlock'
    rect._blockData = b
    canvas.add(rect)
    // 主色块置于背景之上、其他对象之下
    const bgIndex = canvas.getObjects().findIndex(o => o === templateBackground)
    if (bgIndex >= 0) {
      canvas.moveTo(rect, bgIndex + 1)
    } else {
      canvas.sendToBack(rect)
    }
  }

  /** 从当前画布读取主色块归一化参数（对象被拖拽/缩放后同步） */
  function collectMainBlock() {
    const rect = getMainBlock()
    if (!rect) return null
    const b = normalizeBlock({
      ...(rect._blockData || DEFAULT_BLOCK),
      x: (rect.left - pageOffsetX) / (pageW * pageScale),
      y: (rect.top - pageOffsetY) / (pageH * pageScale),
      w: (rect.width * rect.scaleX) / (pageW * pageScale),
      h: (rect.height * rect.scaleY) / (pageH * pageScale)
    })
    rect._blockData = b
    return b
  }

  /** 重建主色块填充（换色/换样式时调用，保持位置尺寸） */
  function refreshBlockFill(blockData) {
    const rect = getMainBlock()
    if (!rect) return
    const merged = normalizeBlock({ ...(rect._blockData || DEFAULT_BLOCK), ...blockData })
    rect.set({ fill: buildBlockFill(merged) })
    rect._blockData = merged
    canvas.renderAll()
  }

  /** 文字镂空：用照片 pattern 填充文字（视觉=透出照片，导出所见即所得，需求 Q9） */
  function applyCutoutFill(textObj) {
    // 照片来源：区域照片或自由照片（创意拼贴）
    const photo = canvas.getObjects().find(o => o._layerType === 'photo' || (o._isFreePhoto && o._isPhotoPrimary))
    if (!photo || !photo._element) {
      // 无照片时近似为半透明（参考站同语义：块隐藏/无照片时无效果）
      textObj.set({ fill: 'rgba(255,255,255,0.55)' })
      return
    }
    const w = Math.max(1, Math.round(photo.width * (photo.scaleX || 1)))
    const h = Math.max(1, Math.round(photo.height * (photo.scaleY || 1)))
    const tile = document.createElement('canvas')
    tile.width = w
    tile.height = h
    tile.getContext('2d').drawImage(photo._element, 0, 0, w, h)
    const pattern = new fabric.Pattern({ source: tile, repeat: 'no-repeat' })
    // pattern 相对文字对象定位：偏移 = 照片屏幕位置 - 文字屏幕位置
    pattern.offsetX = Math.round(photo.left - textObj.left)
    pattern.offsetY = Math.round(photo.top - textObj.top)
    textObj.set({ fill: pattern })
  }

  /** 重建页内所有镂空文字的填充（文字移动/缩放/画布缩放后调用） */
  function refreshCutoutFills() {
    if (!canvas) return
    canvas.getObjects()
      .filter(o => o.type === 'textbox' && o._effects && o._effects.textCutout)
      .forEach(applyCutoutFill)
  }

  /** 文字特效序列化（仅保存开启项，减小体积） */
  function serializeEffects(obj) {
    const fx = obj._effects || {}
    const out = {}
    if (fx.shadow) out.shadow = true
    if (fx.textCutout) out.textCutout = true
    return Object.keys(out).length ? out : undefined
  }

  /** 应用文字特效（shadow / textCutout；bold 走 fontWeight） */
  function applyTextEffects(textObj) {
    const fx = textObj._effects || {}
    if (fx.shadow) {
      textObj.set({ shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.45)', blur: 8, offsetX: 3, offsetY: 3 }) })
    } else {
      textObj.set({ shadow: null })
    }
    if (fx.textCutout) {
      applyCutoutFill(textObj)
    }
  }

  // ============================================================
  // 自由照片（创意拼贴核心，需求 FR-B8/Copy Mode）：不依赖模板区域，
  // 页面级归一化坐标，支持单图/上下平铺/左右平铺（两份联动拖拽）
  // ============================================================

  /** 页面相对尺寸 → 屏幕尺寸 */
  function freePhotoTransform(entry) {
    return {
      left: pageOffsetX + entry.x * pageW * pageScale,
      top: pageOffsetY + entry.y * pageH * pageScale,
      scaleX: (entry.w * pageW * pageScale) / (entry._imgW || 1),
      scaleY: (entry.h * pageH * pageScale) / (entry._imgH || 1)
    }
  }

  function makeFreePhotoObject(entry, isPrimary) {
    return new Promise((resolve) => {
      fabric.Image.fromURL(entry.imageUrl, (img) => {
        const t = freePhotoTransform({ ...entry, _imgW: img.width, _imgH: img.height })
        img.set({ ...t, angle: entry.rotation || 0, hasControls: true, hasBorders: true, cornerColor: '#667eea', cornerSize: 10 })
        img._isFreePhoto = true
        img._layerType = 'freePhoto'
        img._imageUrl = entry.imageUrl
        img._isPhotoPrimary = isPrimary
        img._copyMode = entry.copyMode || 'single'
        img._copyGroupId = entry.copyMode && entry.copyMode !== 'single' ? `fp-${entry.imageUrl}` : null
        resolve(img)
      }, { crossOrigin: 'anonymous' })
    })
  }

  /** 按 copyMode 生成镜像位置（tb=正下方一份；lr=正右方一份） */
  function tileOffsetFor(mode) {
    if (mode === 'tb') return { dx: 0, dy: 1 }
    if (mode === 'lr') return { dx: 1, dy: 0 }
    return null
  }

  /** 主图拖拽/缩放/旋转时实时同步镜像副本（参考站：两半共享偏移联动） */
  function syncCopyPair(primary) {
    if (!canvas || !primary._copyGroupId) return
    const off = tileOffsetFor(primary._copyMode)
    if (!off) return
    const w = primary.width * primary.scaleX
    const h = primary.height * primary.scaleY
    canvas.getObjects()
      .filter(o => o._copyGroupId === primary._copyGroupId && o !== primary)
      .forEach(m => {
        m.set({
          left: primary.left + off.dx * w,
          top: primary.top + off.dy * h,
          scaleX: primary.scaleX,
          scaleY: primary.scaleY,
          angle: primary.angle,
          opacity: primary.opacity
        })
        m.setCoords()
      })
  }

  /**
   * 上传自由照片（创意模板无照片区时的照片入口）：居中放置，宽默认页面 60%。
   * replace=true 时替换已有自由照片的图源（换照片保留装饰，FR-B9）。
   */
  async function addFreePhoto(imageUrl, { replace = false } = {}) {
    const primary = getFreePhoto()
    if (replace && primary) {
      await new Promise((resolve) => {
        fabric.Image.fromURL(imageUrl, (img) => {
          primary.setElement(img.getElement())
          primary._imageUrl = imageUrl
          primary.setCoords()
          canvas.renderAll()
          resolve()
        }, { crossOrigin: 'anonymous' })
      })
      refreshCutoutFills()
      canvas.renderAll()
      return
    }
    return new Promise((resolve) => {
      fabric.Image.fromURL(imageUrl, (img) => {
        // 图片加载失败（宽高为0）时不入画布，避免产生隐形对象
        if (!img.width || !img.height) {
          resolve(null)
          return
        }
        // 首张照片：画幅比例吸附（M2）后铺满画布；追加照片仍居中 60%
        const isFirst = !primary
        if (isFirst && Math.min(img.width, img.height) >= 200) {
          const r = pickClosestRatio(img.width, img.height)
          if (!projectPagesMap.value[currentPageNumber.value]) {
            projectPagesMap.value[currentPageNumber.value] = {
              photoZones: [], textZones: [], userStickers: []
            }
          }
          projectPagesMap.value[currentPageNumber.value].canvas = { w: r.w, h: r.h }
          // 更新当前几何并按画幅放置照片：cover 语义（保持原始比例，超出画幅部分裁切，不拉伸变形）
          // 比例吸附通常接近原始比例，裁切量极小；用户后续切画幅由 renderPage 的恢复逻辑同样走 cover
          pageW = r.w
          pageH = r.h
          const container = _canvasContainerGetter()
          const containerW = container?.clientWidth || 800
          const containerH = container?.clientHeight || 600
          pageScale = Math.min(containerW / pageW, containerH / pageH) * 0.85 * zoomLevel.value
          pageOffsetX = (containerW - pageW * pageScale) / 2
          pageOffsetY = (containerH - pageH * pageScale) / 2
          canvas.setWidth(containerW)
          canvas.setHeight(containerH)
          const dispW = pageW * pageScale
          const dispH = pageH * pageScale
          const coverScale = Math.max(dispW / img.width, dispH / img.height)
          const drawW = img.width * coverScale
          const drawH = img.height * coverScale
          img.set({
            left: pageOffsetX + (dispW - drawW) / 2,
            top: pageOffsetY + (dispH - drawH) / 2,
            scaleX: coverScale,
            scaleY: coverScale,
            hasControls: true,
            hasBorders: true,
            cornerColor: '#667eea',
            cornerSize: 10,
            // cover 超出画幅部分用 clipPath 裁掉（编辑器所见 = 导出所得）
            clipPath: new fabric.Rect({
              left: pageOffsetX, top: pageOffsetY,
              width: dispW, height: dispH,
              absolutePositioned: true
            })
          })
        } else {
          const targetW = 0.6 * pageW * pageScale
          const scale = targetW / (img.width || 1)
          const w = img.width * scale
          const h = img.height * scale
          img.set({
            left: pageOffsetX + (pageW * pageScale - w) / 2,
            top: pageOffsetY + (pageH * pageScale - h) / 2,
            scaleX: scale,
            scaleY: scale,
            hasControls: true,
            hasBorders: true,
            cornerColor: '#667eea',
            cornerSize: 10
          })
        }
        img._isFreePhoto = true
        img._layerType = 'freePhoto'
        img._isPhotoPrimary = true
        img._imageUrl = imageUrl
        img._copyMode = 'single'
        img._copyGroupId = null
        img._photoRatio = img.width / img.height
        canvas.add(img)
        canvas.setActiveObject(img)
        canvas.renderAll()
        resolve(img)
      }, { crossOrigin: 'anonymous' })
    })
  }

  function getFreePhoto() {
    return canvas ? canvas.getObjects().find(o => o._isFreePhoto && o._isPhotoPrimary) || null : null
  }

  function hasFreePhoto() {
    return !!getFreePhoto()
  }

  /** 切换 Copy Mode：重建镜像副本（single=仅主图） */
  function setCopyMode(mode) {
    const primary = getFreePhoto()
    if (!primary) return
    if (mode === primary._copyMode) return
    // 移除旧镜像
    canvas.getObjects()
      .filter(o => o._copyGroupId && o !== primary)
      .forEach(o => canvas.remove(o))
    primary._copyMode = mode
    applyCopyTiles(primary)
    canvas.renderAll()
  }

  /** 按 copyMode 克隆镜像副本并定位（single 不产生镜像） */
  function applyCopyTiles(primary) {
    const mode = primary._copyMode
    primary._copyGroupId = mode && mode !== 'single' ? `fp-${primary._imageUrl}` : null
    if (!primary._copyGroupId) return
    primary.clone(clone => {
      clone._isFreePhoto = true
      clone._layerType = 'freePhoto'
      clone._isPhotoPrimary = false
      clone._copyMode = mode
      clone._copyGroupId = primary._copyGroupId
      canvas.add(clone)
      syncCopyPair(primary)
      canvas.renderAll()
    })
  }

  // ============================================================
  // 画幅控制（M1/M2）：项目级画布覆盖 + 比例吸附
  // ============================================================

  /** 设置画布尺寸（页面像素）并重渲染（M1） */
  async function setCanvasSize(w, h) {
    if (!w || !h) return
    if (!projectPagesMap.value[currentPageNumber.value]) {
      projectPagesMap.value[currentPageNumber.value] = {
        photoZones: [], textZones: [], userStickers: []
      }
    }
    projectPagesMap.value[currentPageNumber.value].canvas = {
      w: Math.round(w),
      h: Math.round(h)
    }
    await renderPage()
  }

  /** 按预设比例设置画幅（M2：9 预设） */
  async function setCanvasRatio(ratioId) {
    const r = CANVAS_RATIOS.find(x => x.id === ratioId)
    if (r) await setCanvasSize(r.w, r.h)
  }

  function getCanvasRatioId() {
    const pd = projectPagesMap.value[currentPageNumber.value]
    const w = pd?.canvas?.w || pageW
    const h = pd?.canvas?.h || pageH
    return pickClosestRatio(w, h).id
  }

  /** 装饰分布生成（归一化实例数组；数据来源 decorEngine，渲染为字符 Textbox） */
  function renderDecorations(decorData) {
    if (!canvas) return    // 清除全部旧装饰后按 params+placed 重建（分布由引擎确定性再生成，视觉与保存前一致）
    canvas.getObjects().filter(o => o._isDecor).forEach(o => canvas.remove(o))
    if (!decorData) return
    const p = normalizeDecorParams(decorData.params)
    const distributed = decorData.params ? generateDistribution(p) : []
    const all = [...distributed, ...(Array.isArray(decorData.placed) ? decorData.placed : [])]
    all.forEach(it => {
      if (!it || typeof it.x !== 'number') return
      const sizePx = (it.size || p.size) * pageW * pageScale
      const text = new fabric.Textbox(it.char || '♥', {
        left: pageOffsetX + it.x * pageW * pageScale,
        top: pageOffsetY + it.y * pageH * pageScale,
        width: sizePx * 1.4,
        fontSize: sizePx,
        fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
        fill: it.color || '#ffffff',
        textAlign: 'center',
        angle: it.rotation || 0,
        hasControls: true,
        hasBorders: true
      })
      text._isDecor = true
      text._decorManual = !!it.manual
      text._decorParams = decorData.params
      text._layerType = 'decor'
      canvas.add(text)
    })
    canvas.renderAll()
  }

  /**
   * 收集画布上的创意元素：
   * - block：主色块归一化参数（单对象）
   * - decorations：{ params（分布参数，分布形状由恢复时重新生成）, placed（仅手动放置的形状） }
   */
  function collectCreative() {
    if (!canvas) return {}
    const result = {}
    const block = collectMainBlock()
    if (block) result.block = block

    const decors = canvas.getObjects().filter(o => o._isDecor)
    if (decors.length > 0) {
      const manual = decors.filter(o => o._decorManual)
      result.decorations = {
        params: decors[0]._decorParams || null,
        placed: manual.map(o => ({
          x: (o.left - pageOffsetX) / (pageW * pageScale),
          y: (o.top - pageOffsetY) / (pageH * pageScale),
          size: (o.fontSize || 20) / (pageW * pageScale),
          rotation: o.angle || 0,
          color: o.fill,
          char: o.text,
          manual: true
        }))
      }
    }
    return result
  }

  function renderOverlayAsync() {
    const pageData = projectPagesMap.value[currentPageNumber.value] || {
      photoZones: [], textZones: [], userStickers: []
    }

    const promises = []

    // 恢复主色块（z 序：背景之上、区域对象之下）与装饰
    if (pageData.block) {
      renderMainBlock(pageData.block)
    }
    if (pageData.decorations) {
      renderDecorations(pageData.decorations)
    }

    // 恢复自由照片（zoneId=null，创意拼贴照片入口）
    ;(pageData.photoZones || []).filter(pz => !pz.zoneId && pz.imageUrl).forEach(entry => {
      // 切换画幅后保持照片原始比例（M2 修订）：按新画幅重排矩形，锚定中心
      const fitted = refitPhotoRect(entry, pageW, pageH)
      promises.push(makeFreePhotoObject(fitted, true).then(img => {
        canvas.add(img)
        img._copyMode = entry.copyMode || 'single'
        applyCopyTiles(img)
      }))
    })

    // 创意模板预置区域（COLOR_BLOCK/DECOR，管理员标注）：每次渲染按 zone 重新生成
    ;(currentZones || []).filter(z => z.zoneType === 'COLOR_BLOCK' || z.zoneType === 'DECOR').forEach(zone => {
      const left = pageOffsetX + zone.x * pageW * pageScale
      const top = pageOffsetY + zone.y * pageH * pageScale
      const w = zone.width * pageW * pageScale
      const h = zone.height * pageH * pageScale
      let preset = {}
      try { preset = zone.placeholderText ? JSON.parse(zone.placeholderText) : {} } catch (e) { preset = {} }
      if (zone.zoneType === 'COLOR_BLOCK') {
        const rect = new fabric.Rect({
          left, top, width: w, height: h,
          fill: preset.color || '#ff8fab',
          hasControls: true, hasBorders: true, cornerColor: '#f472b6', cornerSize: 10
        })
        // 异形色块：按区域形状裁剪；内容与裁剪相对固定，故锁定移动
        if ((zone.shape || 'RECT').toUpperCase() !== 'RECT') {
          rect.clipPath = buildZoneClip(zone)
          rect.set({ lockMovementX: true, lockMovementY: true })
        }
        rect._layerType = 'creativeBlock'
        canvas.add(rect)
      } else {
        // DECOR：decorEngine 分布坐标映射进区域边界
        const p = normalizeDecorParams(preset.params || {})
        generateDistribution(p).forEach((it, i) => {
          const sizePx = (it.size || p.size) * w
          const text = new fabric.Textbox(it.char || '♥', {
            left: left + it.x * w,
            top: top + it.y * h,
            width: sizePx * 1.4,
            fontSize: sizePx,
            fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
            fill: it.color || p.colors[0] || '#ffffff',
            textAlign: 'center',
            angle: it.rotation || 0,
            hasControls: true, hasBorders: true
          })
          text._layerType = 'creativeDecor'
          canvas.add(text)
        })
      }
    })

    // creative 模式空画布起步（条目3）：不渲染 zone 占位与预置（COLOR_BLOCK/DECOR 区在上方循环内已一并跳过）
    if (_editorMode !== 'creative') {
    currentZones.forEach(zone => {
      const left = pageOffsetX + zone.x * pageW * pageScale
      const top = pageOffsetY + zone.y * pageH * pageScale
      const w = zone.width * pageW * pageScale
      const h = zone.height * pageH * pageScale

      if (zone.zoneType === 'PHOTO') {
        const existingImage = pageData.photoZones.find(pz => pz.zoneId === zone.id)
        if (existingImage && existingImage.imageUrl) {
          promises.push(new Promise((resolve) => {
            fabric.Image.fromURL(existingImage.imageUrl, (img) => {
              // 保持照片原始比例：cover 等比铺满 zone（超出部分由 clipPath 裁切），居中锚定
              // scaleX/scaleY 为用户相对 cover 基准的附加缩放；x/y 为相对 zone 的附加偏移
              const coverScale = Math.max(
                w / (img.width || w),
                h / (img.height || h)
              )
              const fx = coverScale * (existingImage.scaleX ?? 1)
              const fy = coverScale * (existingImage.scaleY ?? 1)
              img.set({
                left: left + (w - img.width * fx) / 2 + (existingImage.x || 0) * w,
                top: top + (h - img.height * fy) / 2 + (existingImage.y || 0) * h,
                scaleX: fx,
                scaleY: fy,
                angle: existingImage.rotation || 0,
                hasControls: true,
                hasBorders: true,
                cornerColor: '#667eea',
                cornerSize: 10
              })
              img._zoneId = zone.id
              img._layerType = 'photo'
              img._imageUrl = existingImage.imageUrl

              // 异形区域：按形状构建裁剪路径（RECT 回退常规矩形）
              img.clipPath = buildZoneClip(zone)

              buildZoneOutlines(zone, false).forEach(o => canvas.add(o))
              canvas.add(img)
              resolve()
            }, { crossOrigin: 'anonymous' })
          }))
        } else {
          // 空槽位占位：按区域形状绘制虚线轮廓，点击上传照片
          buildZoneOutlines(zone, true).forEach(o => canvas.add(o))
        }
      } else if (zone.zoneType === 'TEXT') {
        const existingText = pageData.textZones.find(tz => tz.zoneId === zone.id)
        const textContent = existingText ? existingText.content : (zone.placeholderText || '点击输入文字')
        // pageData.fontSize 为页面像素单位，渲染到画布时乘 pageScale 还原为屏幕px
        const text = new fabric.Textbox(textContent, {
          left, top, width: w,
          fontSize: (existingText?.fontSize || 20) * pageScale,
          fontFamily: existingText?.fontFamily || 'Microsoft YaHei',
          fill: existingText?.color || '#333',
          fontWeight: existingText?.bold ? 'bold' : 'normal',
          fontStyle: existingText?.italic ? 'italic' : 'normal',
          underline: existingText?.underline || false,
          textAlign: existingText?.textAlign || 'center',
          editable: true,
          hasControls: true
        })
        text._zoneId = zone.id
        text._layerType = 'text'
        text._baseColor = existingText?.color || '#333'
        if (existingText?.effects) {
          text._effects = { ...existingText.effects }
          applyTextEffects(text)
        }
        canvas.add(text)
      }
    })
    } // end if (_editorMode !== 'creative')

    if (pageData.userStickers) {
      pageData.userStickers.forEach(sticker => {
        promises.push(new Promise((resolve) => {
          fabric.Image.fromURL(sticker.stickerUrl, (img) => {
            img.set({
              left: pageOffsetX + sticker.x * pageW * pageScale,
              top: pageOffsetY + sticker.y * pageH * pageScale,
              scaleX: sticker.width * pageW * pageScale / (img.width || 100),
              scaleY: sticker.height * pageH * pageScale / (img.height || 100),
              angle: sticker.rotation || 0,
              hasControls: true,
              hasBorders: true
            })
            img.isSticker = true
            img._layerType = 'sticker'
            img._imageUrl = sticker.stickerUrl
            canvas.add(img)
            resolve()
          }, { crossOrigin: 'anonymous' })
        }))
      })
    }

    // 恢复自由文字（zoneId=null，不属于任何模板区域）：否则保存后重新进入编辑器/切页会丢失
    if (pageData.textZones) {
      pageData.textZones.forEach(text => {
        if (text.zoneId) return
        const freeText = new fabric.Textbox(text.content || '', {
          left: pageOffsetX + (text.x || 0) * pageW * pageScale,
          top: pageOffsetY + (text.y || 0) * pageH * pageScale,
          width: (text.width || 0.3) * pageW * pageScale,
          fontSize: (text.fontSize || 20) * pageScale,
          fontFamily: text.fontFamily || 'Microsoft YaHei',
          fill: text.color || '#333',
          fontWeight: text.bold ? 'bold' : 'normal',
          fontStyle: text.italic ? 'italic' : 'normal',
          underline: text.underline || false,
          textAlign: text.textAlign || 'center',
          editable: true,
          hasControls: true
        })
        freeText.isUserText = true
        freeText._layerType = 'userText'
        freeText._baseColor = text.color || '#333'
        if (text.effects) {
          freeText._effects = { ...text.effects }
          applyTextEffects(freeText)
        }
        canvas.add(freeText)
      })
    }

    return Promise.all(promises).then(() => {
      // 照片异步加载完成后重建镂空文字填充（applyCutoutFill 依赖照片 element）
      refreshCutoutFills()
      canvas.renderAll()
    })
  }

  // ============================================================
  // 异形区域支持（RECT/ELLIPSE/POLYGON/COMPOUND，v1.6 选择工具箱）
  // 形状裁剪作用于 PHOTO 与 COLOR_BLOCK；TEXT/DECOR 仍按外接矩形。
  // ============================================================

  /** 页面归一化 → 当前画布屏幕 px */
  function zonePointToScreen([x, y]) {
    return {
      x: pageOffsetX + x * pageW * pageScale,
      y: pageOffsetY + y * pageH * pageScale
    }
  }

  /** 归一化顶点 → absolutePositioned fabric.Polygon（定位到顶点 bbox 左上角） */
  function buildPolygonObject(points, props) {
    const pts = points.map(zonePointToScreen)
    const minX = Math.min(...pts.map(p => p.x))
    const minY = Math.min(...pts.map(p => p.y))
    return new fabric.Polygon(
      pts.map(p => ({ x: p.x - minX, y: p.y - minY })),
      { left: minX, top: minY, ...props }
    )
  }

  /** 单个形状 op → 裁剪子对象（subtract 置 destination-out 挖除） */
  function buildOpClipShape(op) {
    const subtract = op.op === 'subtract'
    const paint = { fill: '#000', selectable: false, evented: false }
    let obj = null
    if (op.shape === 'polygon') {
      obj = buildPolygonObject(op.points, paint)
    } else if (op.shape === 'ellipse') {
      const p0 = zonePointToScreen([op.x, op.y])
      obj = new fabric.Ellipse({
        left: p0.x, top: p0.y,
        rx: (op.w * pageW * pageScale) / 2,
        ry: (op.h * pageH * pageScale) / 2,
        angle: op.angle || 0,
        ...paint
      })
    } else {
      const p0 = zonePointToScreen([op.x, op.y])
      obj = new fabric.Rect({
        left: p0.x, top: p0.y,
        width: op.w * pageW * pageScale,
        height: op.h * pageH * pageScale,
        angle: op.angle || 0,
        ...paint
      })
    }
    if (subtract) obj.set('globalCompositeOperation', 'destination-out')
    return obj
  }

  /**
   * 按区域形状构建照片裁剪路径（absolutePositioned）。
   * RECT 返回常规矩形；COMPOUND 返回形状 Group 掩码（add 并集 - subtract 挖除）。
   */
  function buildZoneClip(zone) {
    const zoneLeft = pageOffsetX + zone.x * pageW * pageScale
    const zoneTop = pageOffsetY + zone.y * pageH * pageScale
    const zoneW = zone.width * pageW * pageScale
    const zoneH = zone.height * pageH * pageScale
    const shape = (zone.shape || 'RECT').toUpperCase()
    try {
      if (shape === 'ELLIPSE') {
        return new fabric.Ellipse({
          left: zoneLeft, top: zoneTop, rx: zoneW / 2, ry: zoneH / 2, absolutePositioned: true
        })
      }
      if (shape === 'POLYGON') {
        const ops = zoneToOps(zone)
        if (ops[0] && ops[0].shape === 'polygon') {
          return buildPolygonObject(ops[0].points, { absolutePositioned: true })
        }
      } else if (shape === 'COMPOUND') {
        const children = zoneToOps(zone).map(buildOpClipShape).filter(Boolean)
        if (children.length === 1) {
          children[0].set('absolutePositioned', true)
          return children[0]
        }
        if (children.length > 1) {
          return new fabric.Group(children, { absolutePositioned: true })
        }
      }
    } catch (e) {
      console.error('[Editor] 异形裁剪构建失败，回退矩形:', e)
    }
    return new fabric.Rect({
      left: zoneLeft, top: zoneTop, width: zoneW, height: zoneH, absolutePositioned: true
    })
  }

  /**
   * 区域描边对象数组（空槽位占位 / 已填充照片的边框共用）。
   * interactive=true 供点击上传照片；false 为纯装饰边框。
   * COMPOUND 的 subtract 部件以红色虚线区分。
   */
  function buildZoneOutlines(zone, interactive) {
    const zoneLeft = pageOffsetX + zone.x * pageW * pageScale
    const zoneTop = pageOffsetY + zone.y * pageH * pageScale
    const zoneW = zone.width * pageW * pageScale
    const zoneH = zone.height * pageH * pageScale
    const shape = (zone.shape || 'RECT').toUpperCase()
    const base = {
      fill: interactive ? 'rgba(200, 200, 200, 0.3)' : 'transparent',
      stroke: '#667eea',
      strokeWidth: 1.5,
      strokeDashArray: [5, 3],
      selectable: false,
      evented: interactive,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'pointer'
    }
    const objects = []
    if (shape === 'ELLIPSE') {
      objects.push(new fabric.Ellipse({ left: zoneLeft, top: zoneTop, rx: zoneW / 2, ry: zoneH / 2, ...base }))
    } else if (shape === 'COMPOUND') {
      zoneToOps(zone).forEach(op => {
        const extra = op.op === 'subtract' ? { stroke: '#ef4444', strokeDashArray: [3, 3] } : {}
        if (op.shape === 'polygon') {
          objects.push(buildPolygonObject(op.points, { ...base, ...extra }))
        } else if (op.shape === 'ellipse') {
          const p0 = zonePointToScreen([op.x, op.y])
          objects.push(new fabric.Ellipse({
            left: p0.x, top: p0.y,
            rx: (op.w * pageW * pageScale) / 2,
            ry: (op.h * pageH * pageScale) / 2,
            angle: op.angle || 0, ...base, ...extra
          }))
        } else {
          const p0 = zonePointToScreen([op.x, op.y])
          objects.push(new fabric.Rect({
            left: p0.x, top: p0.y,
            width: op.w * pageW * pageScale,
            height: op.h * pageH * pageScale,
            angle: op.angle || 0, ...base, ...extra
          }))
        }
      })
    } else if (shape === 'POLYGON') {
      const ops = zoneToOps(zone)
      if (ops[0] && ops[0].shape === 'polygon') {
        objects.push(buildPolygonObject(ops[0].points, base))
      }
    }
    if (!objects.length) {
      objects.push(new fabric.Rect({ left: zoneLeft, top: zoneTop, width: zoneW, height: zoneH, ...base }))
    }
    objects.forEach(o => {
      o._isZoneRect = true
      o._zoneId = zone.id
      o._layerType = interactive ? 'zonePlaceholder' : 'zoneBorder'
    })
    return objects
  }

  async function renderPage(callbacks) {
    if (!canvas) return
    _isRendering = true
    canvas.clear()
    canvas.backgroundColor = '#e8e8e8'

    if (callbacks && callbacks.onClearHistory) callbacks.onClearHistory()

    const tplPage = templatePages.value.find(p => p.pageNumber === currentPageNumber.value)
    if (!tplPage) { _isRendering = false; return }

    const container = _canvasContainerGetter()
    if (!container) { _isRendering = false; return }
    const containerW = container.clientWidth || 800
    const containerH = container.clientHeight || 600
    // 画布尺寸读取优先级：pageData.canvas（项目级覆盖，M1/M2）> 模板页尺寸
    const pdForSize = projectPagesMap.value[currentPageNumber.value]
    pageW = pdForSize?.canvas?.w || tplPage.width || 2480
    pageH = pdForSize?.canvas?.h || tplPage.height || 3508
    pageScale = Math.min(containerW / pageW, containerH / pageH) * 0.85 * zoomLevel.value
    pageOffsetX = (containerW - pageW * pageScale) / 2
    pageOffsetY = (containerH - pageH * pageScale) / 2

    canvas.setWidth(containerW)
    canvas.setHeight(containerH)

    await loadZones()

    const finalize = () => {
      _isRendering = false
      if (callbacks && callbacks.onAfterRender) callbacks.onAfterRender()
    }

    // creative 模式空画布起步（条目3）：跳过模板背景图
    if (_editorMode !== 'creative' && tplPage.backgroundUrl) {
      await new Promise((resolve) => {
        fabric.Image.fromURL(tplPage.backgroundUrl, (img) => {
          templateBackground = img
          img.set({
            left: pageOffsetX,
            top: pageOffsetY,
            scaleX: pageScale,
            scaleY: pageScale,
            selectable: false,
            evented: false
          })
          canvas.add(img)
          canvas.sendToBack(img)
          resolve()
        }, { crossOrigin: 'anonymous' })
      })
    }
    // PSD 分层模板图层渲染（FR-57，D17/D19：仅相册编辑器；与照片统一 z 序，照片可插层间 FR-58）
    if (_editorMode === 'album' && tplPage.layersJson) {
      await renderTemplateLayers(tplPage)
    }
    await renderOverlayAsync()
    finalize()
  }

  /**
   * 分层模板图层渲染（FR-57）：按档案初始位置或用户已保存调整（pageData.layers）创建图层对象。
   * 图层先于照片添加（默认照片在上），用户可用层级调整把照片插入图层之间（FR-58）。
   */
  function renderTemplateLayers(tplPage) {
    let arr = []
    try {
      arr = JSON.parse(tplPage.layersJson) || []
    } catch {
      arr = []
    }
    if (!Array.isArray(arr) || arr.length === 0) return Promise.resolve()
    const pd = projectPagesMap.value[currentPageNumber.value]
    const userState = new Map((pd && Array.isArray(pd.layers) ? pd.layers : []).map(l => [l.id, l]))
    return Promise.all(arr.filter(l => l && l.url).map((layer, idx) => new Promise((resolve) => {
      fabric.Image.fromURL(layer.url, (img) => {
        const state = userState.get(layer.id) || {}
        const x = state.x != null ? state.x : layer.x
        const y = state.y != null ? state.y : layer.y
        const w = state.width != null ? state.width : layer.width
        const h = state.height != null ? state.height : layer.height
        const px = pageOffsetX + x * pageW * pageScale
        const py = pageOffsetY + y * pageH * pageScale
        img.set({
          left: px,
          top: py,
          scaleX: (w * pageW * pageScale) / (img.width || 1),
          scaleY: (h * pageH * pageScale) / (img.height || 1),
          opacity: state.opacity != null ? state.opacity : (layer.opacity == null ? 1 : layer.opacity),
          visible: state.visible !== false && layer.visible !== false,
          selectable: true,
          evented: true,
          hasControls: true,
          lockRotation: true,
          lockUniScaling: true,
          cornerColor: '#0ea5e9',
          cornerSize: 10
        })
        img._tplLayer = layer.id
        img._tplLayerName = layer.name || ('图层 ' + (idx + 1))
        canvas.add(img)
        resolve()
      }, { crossOrigin: 'anonymous' })
    })))
  }

  async function reRenderWithZoom(saveFn) {
    if (saveFn) await saveFn()
    await renderPage()
  }

  function getPagePreview(pageNumber) {
    const data = projectPagesMap.value[pageNumber]
    if (data?.previewUrl) return data.previewUrl
    const tplPage = templatePages.value.find(p => p.pageNumber === pageNumber)
    return tplPage?.backgroundUrl || null
  }

  function collectPageData() {
    const tplPage = templatePages.value.find(p => p.pageNumber === currentPageNumber.value)
    if (!tplPage) return null

    const photoZones = []
    const textZones = []
    const userStickers = []
    const tplLayers = []
    // 统一 z 序（FR-58/D18）：fabric 对象自底向顶的全局序，photos 与 layers 混排渲染依据
    let zCounter = 0
    const zOrder = new Map()
    canvas.getObjects().forEach(obj => { zOrder.set(obj, zCounter++) })

    // 自由照片（zoneId=null）：仅从主图收集，镜像由恢复时按 copyMode 重建
    canvas.getObjects()
      .filter(o => o._isFreePhoto && o._isPhotoPrimary)
      .forEach(obj => {
        photoZones.push({
          zoneId: null,
          imageUrl: normalizeStorageUrl(obj._imageUrl || ''),
          originalUrl: normalizeStorageUrl(obj._imageUrl || ''),
          x: (obj.left - pageOffsetX) / (pageW * pageScale),
          y: (obj.top - pageOffsetY) / (pageH * pageScale),
          w: (obj.width * obj.scaleX) / (pageW * pageScale),
          h: (obj.height * obj.scaleY) / (pageH * pageScale),
          rotation: obj.angle || 0,
          ratio: obj._photoRatio || (obj.width && obj.height ? obj.width / obj.height : undefined),
          copyMode: obj._copyMode || 'single',
          z: zOrder.has(obj) ? zOrder.get(obj) : undefined
        })
      })

    canvas.getObjects().forEach(obj => {
      // 分层模板图层（FR-57）：用户调整状态随 pageData 保存，模板档案不变（RULE-20）
      if (obj._tplLayer && obj.type === 'image') {
        tplLayers.push({
          id: obj._tplLayer,
          x: (obj.left - pageOffsetX) / (pageW * pageScale),
          y: (obj.top - pageOffsetY) / (pageH * pageScale),
          width: (obj.width * obj.scaleX) / (pageW * pageScale),
          height: (obj.height * obj.scaleY) / (pageH * pageScale),
          opacity: obj.opacity == null ? 1 : obj.opacity,
          visible: obj.visible !== false,
          z: zOrder.has(obj) ? zOrder.get(obj) : undefined
        })
        return
      }
      if (obj._zoneId && obj.type === 'image' && !obj.isSticker && (obj._imageUrl || obj._element)) {
        const zone = currentZones.find(z => z.id === obj._zoneId)
        if (zone) {
          const zoneLeft = pageOffsetX + zone.x * pageW * pageScale
          const zoneTop = pageOffsetY + zone.y * pageH * pageScale
          const zoneW = zone.width * pageW * pageScale
          const zoneH = zone.height * pageH * pageScale
          // 与渲染端 cover 基准互逆：反推用户附加缩放/偏移，保存重载不跳变
          const coverScale = Math.max(zoneW / (obj.width || zoneW), zoneH / (obj.height || zoneH))
          photoZones.push({
            zoneId: obj._zoneId,
            imageUrl: normalizeStorageUrl(obj._imageUrl || obj._element?.src || ''),
            originalUrl: normalizeStorageUrl(obj._imageUrl || obj._element?.src || ''),
            x: (obj.left - zoneLeft - (zoneW - obj.width * obj.scaleX) / 2) / zoneW,
            y: (obj.top - zoneTop - (zoneH - obj.height * obj.scaleY) / 2) / zoneH,
            scaleX: obj.scaleX / coverScale,
            scaleY: obj.scaleY / coverScale,
            rotation: obj.angle || 0
          })
        }
      } else if (obj._zoneId && obj.type === 'textbox') {
        textZones.push({
          zoneId: obj._zoneId,
          content: obj.text,
          // fontSize 以页面像素为单位存储（屏幕px ÷ pageScale），与预览端 cqi 换算口径一致，
          // 不随编辑器窗口大小/缩放级别漂移
          fontSize: pageScale > 0 ? Math.round(obj.fontSize / pageScale) : obj.fontSize,
          fontFamily: obj.fontFamily,
          // 镂空文字的 fill 是照片 Pattern，持久化存原始色（_baseColor）
          color: obj._baseColor || obj.fill,
          bold: obj.fontWeight === 'bold',
          italic: obj.fontStyle === 'italic',
          underline: obj.underline || false,
          textAlign: obj.textAlign,
          effects: serializeEffects(obj)
        })
      } else if (obj.isUserText && obj.type === 'textbox') {
        textZones.push({
          zoneId: null,
          content: obj.text,
          fontSize: pageScale > 0 ? Math.round(obj.fontSize / pageScale) : obj.fontSize,
          fontFamily: obj.fontFamily,
          color: obj._baseColor || obj.fill,
          bold: obj.fontWeight === 'bold',
          italic: obj.fontStyle === 'italic',
          underline: obj.underline || false,
          textAlign: obj.textAlign,
          effects: serializeEffects(obj),
          x: (obj.left - pageOffsetX) / (pageW * pageScale),
          y: (obj.top - pageOffsetY) / (pageH * pageScale),
          width: obj.width / (pageW * pageScale),
          height: obj.height / (pageH * pageScale)
        })
      } else if (obj.isSticker && obj.type === 'image') {
        const src = obj._imageUrl || (obj._element && obj._element.src) || ''
        if (!src) return
        userStickers.push({
          stickerUrl: normalizeStorageUrl(src),
          x: (obj.left - pageOffsetX) / (pageW * pageScale),
          y: (obj.top - pageOffsetY) / (pageH * pageScale),
          width: (obj.width * obj.scaleX) / (pageW * pageScale),
          height: (obj.height * obj.scaleY) / (pageH * pageScale),
          rotation: obj.angle || 0
        })
      }
    })

    // 创意元素（主色块/装饰）随 pageData 一起持久化；canvas 记录当前生效画幅（M1/M2）
    const creative = collectCreative()
    const result = {
      photoZones, textZones, userStickers, ...creative,
      canvas: { w: Math.round(pageW), h: Math.round(pageH) }
    }
    if (tplLayers.length > 0) result.layers = tplLayers
    return result
  }

  function saveCurrentPage() {
    const pageData = collectPageData()
    if (pageData) {
      projectPagesMap.value[currentPageNumber.value] = pageData
    }
    return pageData
  }

  async function uploadPhoto(file, zoneId) {
    try {
      const res = await uploadFile(file, `photos/${project.value.userId}/${projectId}/origin`)
      const imageUrl = res.data.data

      // 先把当前画布（含未保存的色块/装饰等创意元素）刷入 projectPagesMap，
      // 避免下方 renderPage 用过期数据重建画布导致元素丢失（FR-B9）
      saveCurrentPage()

      const pageData = projectPagesMap.value[currentPageNumber.value] || {
        photoZones: [], textZones: [], userStickers: []
      }

      if (zoneId) {
        const existing = pageData.photoZones.find(pz => pz.zoneId === zoneId)
        if (existing) {
          existing.imageUrl = imageUrl
          existing.originalUrl = imageUrl
          existing.x = 0
          existing.y = 0
          existing.scaleX = 1
          existing.scaleY = 1
          existing.rotation = 0
        } else {
          pageData.photoZones.push({
            zoneId: zoneId,
            imageUrl: imageUrl,
            originalUrl: imageUrl,
            x: 0, y: 0,
            scaleX: 1, scaleY: 1,
            rotation: 0
          })
        }
      } else {
        const emptyZone = currentZones.find(z => z.zoneType === 'PHOTO' &&
          !pageData.photoZones.some(pz => pz.zoneId === z.id && pz.imageUrl))
        if (emptyZone) {
          const existing = pageData.photoZones.find(pz => pz.zoneId === emptyZone.id)
          if (existing) {
            existing.imageUrl = imageUrl
            existing.originalUrl = imageUrl
            existing.x = 0
            existing.y = 0
            existing.scaleX = 1
            existing.scaleY = 1
            existing.rotation = 0
          } else {
            pageData.photoZones.push({
              zoneId: emptyZone.id,
              imageUrl: imageUrl,
              originalUrl: imageUrl,
              x: 0, y: 0,
              scaleX: 1, scaleY: 1,
              rotation: 0
            })
          }
        }
      }

      projectPagesMap.value[currentPageNumber.value] = pageData
      await renderPage()
      ElMessage.success('照片上传成功')
    } catch (e) {
      console.error('[Editor] 照片上传失败:', e)
      const status = e.response?.status
      let msg = '照片上传失败，请重试'
      if (status === 413) {
        msg = '图片过大，请压缩后上传'
      } else if (status === 415) {
        msg = '不支持的图片格式'
      } else if (status === 403) {
        msg = '无权限上传，请重新登录'
      } else if (status === 500) {
        msg = '服务器错误，请稍后重试'
      }
      ElMessage.error(msg)
    }
  }

  async function uploadStickerFile(file, userId) {
    try {
      const res = await uploadFile(file, `stickers/user/${userId}`)
      const stickerUrl = res.data.data
      addStickerToCanvas(stickerUrl)
    } catch (e) {
      console.error('[Editor] 上传贴纸失败:', e)
      ElMessage.error('上传贴纸失败，请重试')
    }
  }

  function addStickerToCanvas(stickerUrl) {
    computeScaleOffset()
    fabric.Image.fromURL(stickerUrl, (img) => {
      img.set({
        left: pageOffsetX + 0.3 * pageW * pageScale,
        top: pageOffsetY + 0.3 * pageH * pageScale,
        scaleX: 0.15 * pageW * pageScale / (img.width || 100),
        scaleY: 0.15 * pageH * pageScale / (img.height || 100),
        hasControls: true,
        hasBorders: true
      })
      img.isSticker = true
      img._layerType = 'sticker'
      img._imageUrl = stickerUrl
      canvas.add(img)
      canvas.setActiveObject(img)
      canvas.renderAll()
    }, { crossOrigin: 'anonymous' })
  }

  /**
   * Emoji 贴纸：以系统 Emoji 字体渲染的文字对象，
   * 复用自由文字的持久化/H5/导出链路，双击不可编辑、按贴纸交互。
   */
  function addEmojiToCanvas(char) {
    computeScaleOffset()
    const emojiObj = new fabric.Textbox(char, {
      left: pageOffsetX + 0.3 * pageW * pageScale,
      top: pageOffsetY + 0.3 * pageH * pageScale,
      width: 0.3 * pageW * pageScale,
      fontSize: Math.round(0.14 * pageW * pageScale),
      fontFamily: "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
      textAlign: 'center',
      editable: false,
      hasControls: true,
      hasBorders: true
    })
    emojiObj.isUserText = true
    emojiObj._layerType = 'userText'
    canvas.add(emojiObj)
    canvas.setActiveObject(emojiObj)
    canvas.renderAll()
  }

  function addTextToCanvas(text = '双击编辑文字') {
    computeScaleOffset()
    const textObj = new fabric.Textbox(text, {
      left: pageOffsetX + 0.1 * pageW * pageScale,
      top: pageOffsetY + 0.1 * pageH * pageScale,
      width: 0.3 * pageW * pageScale,
      fontSize: 24 * pageScale,
      fontFamily: 'Microsoft YaHei',
      fill: '#333',
      textAlign: 'center',
      editable: true,
      hasControls: true
    })
    textObj.isUserText = true
    textObj._layerType = 'userText'
    canvas.add(textObj)
    canvas.setActiveObject(textObj)
    canvas.renderAll()
  }

  function constrainPhotoToZone(obj) {
    if (!obj._zoneId) return
    const zone = currentZones.find(z => z.id === obj._zoneId)
    if (!zone) return

    const zoneLeft = pageOffsetX + zone.x * pageW * pageScale
    const zoneTop = pageOffsetY + zone.y * pageH * pageScale
    const zoneW = zone.width * pageW * pageScale
    const zoneH = zone.height * pageH * pageScale

    const imgW = (obj.width || 1) * obj.scaleX
    const imgH = (obj.height || 1) * obj.scaleY

    if (imgW < zoneW) {
      obj.set({ left: zoneLeft + (zoneW - imgW) / 2 })
    } else {
      if (obj.left > zoneLeft) obj.set({ left: zoneLeft })
      if (obj.left + imgW < zoneLeft + zoneW) obj.set({ left: zoneLeft + zoneW - imgW })
    }

    if (imgH < zoneH) {
      obj.set({ top: zoneTop + (zoneH - imgH) / 2 })
    } else {
      if (obj.top > zoneTop) obj.set({ top: zoneTop })
      if (obj.top + imgH < zoneTop + zoneH) obj.set({ top: zoneTop + zoneH - imgH })
    }

    obj.setCoords()
    canvas.renderAll()
  }

  function selectImageByZoneId(img) {
    const objs = canvas.getObjects()
    const found = objs.find(o => o._zoneId === img.zoneId && o.type === 'image')
    if (found) {
      canvas.setActiveObject(found)
      canvas.renderAll()
    }
  }

  function zoomIn() {
    zoomLevel.value = Math.min(3, zoomLevel.value + 0.1)
  }

  function zoomOut() {
    zoomLevel.value = Math.max(0.2, zoomLevel.value - 0.1)
  }

  function zoomToFit() {
    zoomLevel.value = 1
  }

  function applyZoomOnly() {
    if (!canvas) return

    const tplPage = templatePages.value.find(p => p.pageNumber === currentPageNumber.value)
    if (!tplPage) return

    const container = _canvasContainerGetter()
    if (!container) return

    const containerW = container.clientWidth || 800
    const containerH = container.clientHeight || 600

    const oldPageScale = pageScale
    const oldPageOffsetX = pageOffsetX
    const oldPageOffsetY = pageOffsetY

    const pdForSize = projectPagesMap.value[currentPageNumber.value]
    pageW = pdForSize?.canvas?.w || tplPage.width || 2480
    pageH = pdForSize?.canvas?.h || tplPage.height || 3508
    pageScale = Math.min(containerW / pageW, containerH / pageH) * 0.85 * zoomLevel.value
    pageOffsetX = (containerW - pageW * pageScale) / 2
    pageOffsetY = (containerH - pageH * pageScale) / 2

    if (oldPageScale <= 0) return
    const ratio = pageScale / oldPageScale

    canvas.setWidth(containerW)
    canvas.setHeight(containerH)

    const objects = canvas.getObjects()
    objects.forEach(obj => {
      obj.set({
        left: pageOffsetX + (obj.left - oldPageOffsetX) * ratio,
        top: pageOffsetY + (obj.top - oldPageOffsetY) * ratio,
      })

      if (obj.type === 'image') {
        obj.set({
          scaleX: (obj.scaleX || 1) * ratio,
          scaleY: (obj.scaleY || 1) * ratio,
        })
      } else if (obj.type === 'textbox') {
        obj.set({
          // 不取整：逐次缩放时 Math.round 的累计误差会让存储字号漂移；仅在 collectPageData 时取整
          fontSize: (obj.fontSize || 20) * ratio,
          // 宽度同步缩放，保证换行位置与页面比例一致（此前缺失导致 zoom≠1 时换行失真）
          width: (obj.width || 1) * ratio,
        })
      } else if (obj.type === 'rect') {
        obj.set({
          width: (obj.width || 1) * ratio,
          height: (obj.height || 1) * ratio,
        })
      }

      if (obj._zoneId && obj.type === 'image' && !obj.isSticker && obj.clipPath) {
        const zone = currentZones.find(z => z.id === obj._zoneId)
        if (zone) {
          // 缩放后按新 pageScale 重建裁剪路径（兼容矩形/椭圆/多边形/复合）
          const fresh = buildZoneClip(zone)
          if (fresh) obj.clipPath = fresh
        }
      }

      obj.setCoords()
    })

    canvas.renderAll()
  }

  function onCanvasWheel(e) {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    zoomLevel.value = Math.max(0.2, Math.min(3, zoomLevel.value + delta))
  }

  function removePhotoFromZone(zoneId) {
    const pageData = projectPagesMap.value[currentPageNumber.value]
    if (!pageData) return
    const idx = pageData.photoZones.findIndex(pz => pz.zoneId === zoneId)
    if (idx >= 0) {
      pageData.photoZones[idx].imageUrl = null
      pageData.photoZones[idx].originalUrl = null
    }
  }

  function switchPage(pageNumber) {
    currentPageNumber.value = pageNumber
  }

  async function saveDraft(projectIdVal) {
    const pageData = saveCurrentPage()
    if (!pageData) return false
    try {
      await saveProjectPage(projectIdVal, {
        pageNumber: currentPageNumber.value,
        pageData: JSON.stringify(pageData)
      })
      return true
    } catch (e) {
      throw e
    }
  }

  async function submitProject(projectIdVal, router) {
    saveCurrentPage()
    const allPageNumbers = Object.keys(projectPagesMap.value).map(Number)
    for (const pageNum of allPageNumbers) {
      const pageData = projectPagesMap.value[pageNum]
      if (pageData) {
        await saveProjectPage(projectIdVal, {
          pageNumber: pageNum,
          pageData: JSON.stringify(pageData)
        })
      }
    }
    await submitProjectApi(projectIdVal, { h5Url: `/api/h5/projects/${projectIdVal}` })
  }

  /** 提交用缩略图（FR-D7/SR-11）：当前页导出为 ≤480px 宽的 JPEG File，失败返回 null 由调用方降级 */
  function exportPageThumbnail(maxWidth = 480) {
    return new Promise((resolve) => {
      if (!canvas) { resolve(null); return }
      try {
        const dataUrl = canvas.toDataURL({
          format: 'jpeg',
          quality: 0.85,
          multiplier: pageScale > 0 ? 1 / pageScale : 1,
          left: pageOffsetX,
          top: pageOffsetY,
          width: pageW * pageScale,
          height: pageH * pageScale
        })
        const img = new Image()
        img.onload = () => {
          const scale = Math.min(1, maxWidth / pageW)
          const out = document.createElement('canvas')
          out.width = Math.max(1, Math.round(pageW * scale))
          out.height = Math.max(1, Math.round(pageH * scale))
          out.getContext('2d').drawImage(img, 0, 0, out.width, out.height)
          out.toBlob(
            (blob) => resolve(blob ? new File([blob], `thumb-${Date.now()}.jpg`, { type: 'image/jpeg' }) : null),
            'image/jpeg',
            0.85
          )
        }
        img.onerror = () => resolve(null)
        img.src = dataUrl
      } catch (e) {
        console.error('[Editor] 缩略图生成失败:', e)
        resolve(null)
      }
    })
  }

  function dispose() {
    if (canvas) {
      canvas.dispose()
      canvas = null
    }
  }

  return {
    project,
    templatePages,
    systemStickers,
    currentPageNumber,
    zoomLevel,
    loading,
    projectPagesMap,
    currentPageImages,
    getCanvas,
    getCurrentZones,
    getPageScale,
    getPageOffset,
    getPageDimensions,
    isRendering,
    setRendering,
    getTemplateBackground,
    setCanvasContainerGetter,
    getCanvasContainer,
    loadProject,
    loadTemplate,
    loadStickers,
    loadProjectPages,
    initCanvas,
    renderPage,
    renderOverlayAsync,
    getPagePreview,
    collectPageData,
    saveCurrentPage,
    uploadPhoto,
    uploadStickerFile,
    addStickerToCanvas,
    addEmojiToCanvas,
    addTextToCanvas,
    selectImageByZoneId,
    computeScaleOffset,
    normalizeStorageUrl,
    removePhotoFromZone,
    switchPage,
    saveDraft,
    submitProject,
    zoomIn,
    zoomOut,
    zoomToFit,
    applyZoomOnly,
    buildBlockFill,
    renderMainBlock,
    addFreePhoto,
    getFreePhoto,
    hasFreePhoto,
    setCopyMode,
    syncCopyPair,
    setCanvasSize,
    setCanvasRatio,
    getCanvasRatioId,
    setEditorMode,
    getEditorMode,
    refreshCutoutFills,
    applyTextEffects,
    exportPageThumbnail,
    refreshBlockFill,
    collectMainBlock,
    renderDecorations,
    collectCreative,
    getMainBlock,
    onCanvasWheel,
    reRenderWithZoom,
    dispose,
    constrainPhotoToZone
  }
}