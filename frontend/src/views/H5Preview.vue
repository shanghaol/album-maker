<template>
  <div class="h5-preview-page">
    <div class="preview-header">
      <el-button @click="$router.back()" :icon="'ArrowLeft'" text class="back-btn">返回</el-button>
      <span class="preview-title">{{ project?.title || '相册预览' }}</span>
      <div class="header-spacer" />
      <el-button v-if="project" size="small" @click="copyShareLink">复制分享链接</el-button>
    </div>

    <div class="preview-body">
      <div class="book-wrapper">
        <div class="flipbook" ref="flipbookRef">
          <div class="book-page book-page-left" ref="pageLeftRef"></div>
          <div class="book-page book-page-right" ref="pageRightRef"></div>
          <div
            class="flip-card"
            :class="flipClass"
            :style="flipStyle"
            ref="flipCardRef"
          >
            <div class="flip-face flip-front" ref="flipFrontRef"></div>
            <div class="flip-face flip-back" ref="flipBackRef"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="preview-footer">
      <span class="page-indicator">{{ currentView + 1 }} / {{ totalViews }}</span>
      <div class="preview-controls">
        <el-button :disabled="currentView <= 0 || isFlipping" @click="prevPage" size="small">上一页</el-button>
        <el-button :disabled="currentView >= totalViews - 1 || isFlipping" @click="nextPage" size="small">下一页</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { getProjectById, getProjectPages } from '@/api/project'
import { getTemplatePages, getTemplateZones } from '@/api/template'
import { ElMessage } from 'element-plus'
import { normalizeStorageUrl } from '@/utils/storage'
import { parsePageData } from '@/utils/pageData'
import { normalizeBlock, generateDistribution, normalizeDecorParams, refitPhotoRect } from '@/utils/decorEngine'
import { singleShapeClipStyle, compoundMaskStyle } from '@/utils/zoneGeometry'

const route = useRoute()
const projectId = route.params.projectId
const project = ref(null)
const projectPages = ref([])

// 复制公开分享地址（FR-61）：与个人主页复制的地址一致，剪贴板不可用时降级
async function copyShareLink() {
  const url = `${location.origin}/api/h5/projects/${projectId}`
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('分享链接已复制')
  } catch {
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    ElMessage.success('分享链接已复制')
  }
}
const templatePages = ref([])
const zoneMap = ref({})
const currentView = ref(0)
const isFlipping = ref(false)
const flipAnimating = ref(false)
const flipDirection = ref('forward')

const pageLeftRef = ref(null)
const pageRightRef = ref(null)
const flipCardRef = ref(null)
const flipFrontRef = ref(null)
const flipBackRef = ref(null)
const flipbookRef = ref(null)

const totalViews = computed(() => Math.max(templatePages.value.length, 0))

// 翻页动画兜底定时器：标签页切后台等场景 transitionend 不触发会导致 isFlipping 永久卡死
let flipFallbackTimer = null
const FLIP_FALLBACK_MS = 1000

function clearFlipFallback() {
  if (flipFallbackTimer) {
    clearTimeout(flipFallbackTimer)
    flipFallbackTimer = null
  }
}

// 项目页按 pageNumber 索引：项目页可能不连续（如只保存了第2页），按下标取会错位
const projectPageMap = computed(() => {
  const map = {}
  projectPages.value.forEach(p => { map[p.pageNumber] = p })
  return map
})

// 单页作品（创意拼贴）：不做书页展开，整页居中显示
const isSinglePage = computed(() => templatePages.value.length === 1)

const displaySize = ref({ widthNum: 200, heightNum: 300, width: '200px', height: '300px', innerWidth: '400px' })

function calcDisplaySize() {
  const tpl = templatePages.value[0]
  if (!tpl) {
    displaySize.value = { widthNum: 200, heightNum: 300, width: '200px', height: '300px', innerWidth: '400px' }
    return
  }
  // 画幅读取优先级：pageData.canvas（项目级覆盖，M1/M2）> 模板页尺寸
  const firstProj = projectPages.value.find(p => p.pageNumber === tpl.pageNumber)
  let pw = tpl.width || 1024
  let ph = tpl.height || 768
  try {
    const pd = firstProj?.pageData ? JSON.parse(firstProj.pageData) : null
    if (pd?.canvas?.w && pd?.canvas?.h) {
      pw = pd.canvas.w
      ph = pd.canvas.h
    }
  } catch (e) { /* 解析失败回落模板值 */ }
  // 书页展开模式：一个模板页 = 左右两个物理页；单页模式：整页即一个显示单元
  const physicalW = isSinglePage.value ? pw : pw / 2
  const ratio = physicalW / ph
  const isMobile = window.innerWidth < 768
  const maxW = isMobile ? window.innerWidth * 0.44 : window.innerWidth * 0.32
  const maxH = isMobile ? window.innerHeight * 0.65 : window.innerHeight * 0.78
  let dw, dh
  if (maxW / ratio <= maxH) {
    dw = maxW
    dh = maxW / ratio
  } else {
    dh = maxH
    dw = maxH * ratio
  }
  displaySize.value = { widthNum: dw, heightNum: dh, width: dw + 'px', height: dh + 'px', innerWidth: dw * 2 + 'px' }
}

const flipClass = computed(() => {
  if (!flipAnimating.value) return ''
  return flipDirection.value === 'forward' ? 'forward animating' : 'backward animating'
})

const flipStyle = computed(() => {
  const size = displaySize.value
  return { width: size.width, height: size.height }
})

function createPageContent(spreadIndex, isRightHalf) {
  const tplPage = templatePages.value[spreadIndex]
  const projPage = tplPage ? projectPageMap.value[tplPage.pageNumber] : null
  const size = displaySize.value

  const innerDiv = document.createElement('div')
  innerDiv.className = 'page-inner'
  // 单页模式：page-inner 即整页（1×）；展开模式：跨左右两半（2×）
  innerDiv.style.width = isSinglePage.value ? size.width : size.innerWidth
  innerDiv.style.left = (!isSinglePage.value && isRightHalf) ? ('-' + size.width) : '0'
  // 动态元素无 Vue scoped 属性，container-type 需内联声明（cqi 基准 = page-inner 宽）
  innerDiv.style.containerType = 'inline-size'
  // 同理：scoped 里的定位/高度对动态元素不生效，必须内联，否则容器高 0 导致整页白屏
  innerDiv.style.position = 'absolute'
  innerDiv.style.top = '0'
  innerDiv.style.height = '100%'

  if (tplPage && tplPage.backgroundUrl) {
    innerDiv.style.backgroundImage = `url(${normalizeStorageUrl(tplPage.backgroundUrl)})`
  } else if (projPage && projPage.previewUrl) {
    innerDiv.style.backgroundImage = `url(${projPage.previewUrl})`
  }
  innerDiv.style.backgroundSize = '100% 100%'
  innerDiv.style.backgroundPosition = 'center'
  innerDiv.style.backgroundRepeat = 'no-repeat'

  if (projPage && projPage.pageData) {
    const pageData = parsePageData(projPage.pageData)
    const zones = zoneMap.value[tplPage?.pageNumber] || []
    // 画幅覆盖（M1/M2）：pageData.canvas 优先于模板页尺寸
    let pageW = tplPage?.width || 1024
    let pageH = tplPage?.height || 768
    if (pageData.canvas?.w && pageData.canvas?.h) {
      pageW = pageData.canvas.w
      pageH = pageData.canvas.h
    }
    const innerPx = isSinglePage.value ? size.widthNum : size.widthNum * 2 // page-inner 实际渲染宽（px）

    // ---- 主色块（z 序：背景之上、贴纸/文字之下） ----
    if (pageData.block) {
      const b = normalizeBlock(pageData.block)
      const blockDiv = document.createElement('div')
      blockDiv.style.position = 'absolute'
      blockDiv.style.left = (b.x * 100) + '%'
      blockDiv.style.top = (b.y * 100) + '%'
      blockDiv.style.width = (b.w * 100) + '%'
      blockDiv.style.height = (b.h * 100) + '%'
      blockDiv.style.pointerEvents = 'none'
      if (b.style === 'stripe') {
        const cell = innerPx / Math.max(2, b.stripeDensity)
        const px = Math.round(cell) + 'px'
        const dir = b.stripeDir === 'h' ? '180deg' : '90deg'
        blockDiv.style.background = `repeating-linear-gradient(${dir}, ${b.color} 0 ${px}, ${b.color2} ${px} ${Math.round(cell * 2)}px)`
      } else {
        blockDiv.style.background = b.color
      }
      innerDiv.appendChild(blockDiv)
    }

    // ---- 装饰（与编辑器同引擎确定性生成 + 手动放置） ----
    if (pageData.decorations && pageData.decorations.params) {
      const p = normalizeDecorParams(pageData.decorations.params)
      const distributed = generateDistribution(p)
      const all = [...distributed, ...(pageData.decorations.placed || [])]
      all.forEach(it => {
        if (!it || typeof it.x !== 'number') return
        const sizePct = ((it.size || p.size) * 100)
        const span = document.createElement('span')
        span.style.position = 'absolute'
        span.style.left = (it.x * 100) + '%'
        span.style.top = (it.y * 100) + '%'
        span.style.fontSize = `calc(${sizePct / 2} * 1cqi)`
        span.style.lineHeight = '1'
        span.style.transform = `rotate(${it.rotation || 0}deg)`
        span.style.transformOrigin = 'center center'
        span.style.color = it.color || '#ffffff'
        span.style.pointerEvents = 'none'
        span.textContent = it.char || '♥'
        innerDiv.appendChild(span)
      })
    }

    // ---- PSD 分层模板图层（FR-59/NFR-11，D18）：档案初值 + 用户态覆盖，zIndex 与照片统一 z 序 ----
    const tplLayers = (() => {
      let arr = []
      try { arr = tplPage && tplPage.layersJson ? (JSON.parse(tplPage.layersJson) || []) : [] } catch (e) { arr = [] }
      return Array.isArray(arr) ? arr.filter(l => l && l.url) : []
    })()
    const layerUserState = new Map((pageData.layers || []).map(l => [l.id, l]))
    tplLayers.forEach(layer => {
      const st = layerUserState.get(layer.id) || {}
      if (st.visible === false || layer.visible === false) return
      const x = st.x != null ? st.x : layer.x
      const y = st.y != null ? st.y : layer.y
      const w = st.width != null ? st.width : layer.width
      const h = st.height != null ? st.height : layer.height
      const img = document.createElement('img')
      img.src = normalizeStorageUrl(layer.url)
      img.style.position = 'absolute'
      img.style.left = (x * 100) + '%'
      img.style.top = (y * 100) + '%'
      img.style.width = (w * 100) + '%'
      img.style.height = (h * 100) + '%'
      img.style.opacity = String(st.opacity != null ? st.opacity : (layer.opacity == null ? 1 : layer.opacity))
      img.style.pointerEvents = 'none'
      const z = st.z != null ? st.z : layer.zIndex
      if (z != null) img.style.zIndex = String(z)
      innerDiv.appendChild(img)
    })

    // ---- 照片渲染区记录（镂空文字背景对齐用） ----
    const photoRects = {}
    pageData.photoZones?.forEach(pz => {
      if (!pz.imageUrl || !pz.zoneId) return
      const zone = zones.find(z => z.id === pz.zoneId)
      if (zone) photoRects[pz.zoneId] = { zone, url: normalizeStorageUrl(pz.imageUrl) }
    })

    // ---- 自由照片（zoneId=null，创意拼贴；copyMode 平铺渲染；切画幅保持原始比例） ----
    const freeTiles = []
    pageData.photoZones?.forEach(pzRaw => {
      if (!pzRaw.imageUrl || pzRaw.zoneId) return
      // 画幅与照片比例不一致时重排矩形（cover 裁切语义，M2 修订）
      const pz = refitPhotoRect(pzRaw, pw, ph)
      freeTiles.push(pz)
      const tiles = [{ dx: 0, dy: 0 }]
      if (pz.copyMode === 'tb') tiles.push({ dx: 0, dy: 1 })
      if (pz.copyMode === 'lr') tiles.push({ dx: 1, dy: 0 })
      tiles.forEach(t => {
        const wrapper = document.createElement('div')
        wrapper.style.position = 'absolute'
        wrapper.style.left = ((pz.x + t.dx * pz.w) * 100) + '%'
        wrapper.style.top = ((pz.y + t.dy * pz.h) * 100) + '%'
        wrapper.style.width = (pz.w * 100) + '%'
        wrapper.style.height = (pz.h * 100) + '%'
        wrapper.style.transform = `rotate(${pz.rotation || 0}deg)`
        if (pzRaw.z != null) wrapper.style.zIndex = String(pzRaw.z)
        wrapper.style.transformOrigin = 'center center'
        wrapper.style.pointerEvents = 'none'
        wrapper.style.overflow = 'hidden'
        const img = document.createElement('img')
        img.src = normalizeStorageUrl(pz.imageUrl)
        img.alt = ''
        img.style.width = '100%'
        img.style.height = '100%'
        img.style.objectFit = 'cover'
        img.style.display = 'block'
        wrapper.appendChild(img)
        innerDiv.appendChild(wrapper)
      })
    })

    // ---- 创意预置区域（COLOR_BLOCK/DECOR，管理员标注） ----
    ;(zones || []).filter(z => z.zoneType === 'COLOR_BLOCK' || z.zoneType === 'DECOR').forEach(zone => {
      let preset = {}
      try { preset = zone.placeholderText ? JSON.parse(zone.placeholderText) : {} } catch (e) { preset = {} }
      if (zone.zoneType === 'COLOR_BLOCK') {
        const d = document.createElement('div')
        d.style.position = 'absolute'
        d.style.left = (zone.x * 100) + '%'
        d.style.top = (zone.y * 100) + '%'
        d.style.width = (zone.width * 100) + '%'
        d.style.height = (zone.height * 100) + '%'
        d.style.background = preset.color || '#ff8fab'
        d.style.pointerEvents = 'none'
        // 异形色块（v1.6 选择工具箱）：单形状 clip-path / 复合 SVG 蒙版
        const clipStyle = singleShapeClipStyle(zone) || compoundMaskStyle(zone)
        if (clipStyle) Object.assign(d.style, clipStyle)
        innerDiv.appendChild(d)
      } else {
        const p = normalizeDecorParams(preset.params || {})
        generateDistribution(p).forEach(it => {
          const s = document.createElement('span')
          s.textContent = it.char || '♥'
          s.style.position = 'absolute'
          s.style.left = ((zone.x + it.x * zone.width) * 100) + '%'
          s.style.top = ((zone.y + it.y * zone.height) * 100) + '%'
          s.style.fontSize = ((it.size || p.size) * zone.width * 100) + 'cqi'
          s.style.color = it.color || '#ffffff'
          s.style.transform = `rotate(${it.rotation || 0}deg)`
          s.style.transformOrigin = 'center center'
          s.style.pointerEvents = 'none'
          s.style.lineHeight = '1'
          innerDiv.appendChild(s)
        })
      }
    })

    if (pageData.userStickers && pageData.userStickers.length > 0) {
      pageData.userStickers.forEach(sticker => {
        if (!sticker.stickerUrl) return
        const wrapper = document.createElement('div')
        wrapper.style.position = 'absolute'
        wrapper.style.left = (sticker.x * 100) + '%'
        wrapper.style.top = (sticker.y * 100) + '%'
        wrapper.style.width = (sticker.width * 100) + '%'
        wrapper.style.height = (sticker.height * 100) + '%'
        wrapper.style.transform = `rotate(${sticker.rotation || 0}deg)`
        wrapper.style.transformOrigin = 'center center'
        wrapper.style.pointerEvents = 'none'

        const img = document.createElement('img')
        img.src = normalizeStorageUrl(sticker.stickerUrl)
        img.alt = ''
        img.style.width = '100%'
        img.style.height = '100%'
        img.style.objectFit = 'contain'
        img.style.display = 'block'
        wrapper.appendChild(img)
        innerDiv.appendChild(wrapper)
      })
    }

    if (pageData.textZones && pageData.textZones.length > 0) {
      pageData.textZones.forEach(text => {
        const wrapper = document.createElement('div')
        wrapper.style.position = 'absolute'
        wrapper.style.pointerEvents = 'none'

        if (text.zoneId) {
          const zone = zones.find(z => z.id === text.zoneId)
          if (!zone) return
          wrapper.style.left = (zone.x * 100) + '%'
          wrapper.style.top = (zone.y * 100) + '%'
          wrapper.style.width = (zone.width * 100) + '%'
          wrapper.style.height = (zone.height * 100) + '%'
        } else {
          wrapper.style.left = ((text.x || 0) * 100) + '%'
          wrapper.style.top = ((text.y || 0) * 100) + '%'
          wrapper.style.width = ((text.width || 0.1) * 100) + '%'
          wrapper.style.height = ((text.height || 0.05) * 100) + '%'
        }

        wrapper.style.display = 'flex'
        wrapper.style.alignItems = 'center'
        wrapper.style.justifyContent = 'center'
        wrapper.style.overflow = 'hidden'

        const span = document.createElement('span')
        span.textContent = text.content || ''
        const relFontSize = ((text.fontSize || 20) / pageW) * 100
        span.style.fontSize = relFontSize + 'cqi'
        span.style.fontFamily = text.fontFamily || 'Microsoft YaHei, sans-serif'
        span.style.fontWeight = text.bold ? 'bold' : 'normal'
        span.style.fontStyle = text.italic ? 'italic' : 'normal'
        span.style.textDecoration = text.underline ? 'underline' : 'none'
        span.style.textAlign = text.textAlign || 'center'
        span.style.width = '100%'
        span.style.wordBreak = 'break-word'
        span.style.lineHeight = '1.3'

        const fx = text.effects || {}
        if (fx.textCutout) {
          // 镂空：文字透明 + 照片背景裁剪进文字（洞透照片，需求 Q9）
          // 照片来源：区域照片优先，其次自由照片
          const zonePhoto = Object.values(photoRects)[0]
          const freePhotoEntry = freeTiles.find(p => p.imageUrl)
          if (zonePhoto) {
            span.style.color = 'transparent'
            span.style.backgroundImage = `url(${zonePhoto.url})`
            span.style.backgroundSize = 'cover'
            span.style.backgroundPosition = 'center'
            span.style.webkitBackgroundClip = 'text'
            span.style.backgroundClip = 'text'
          } else if (freePhotoEntry && !text.zoneId && text.x != null) {
            // 自由照片：以文字中心在页面中的位置反向采样照片区域，模拟挖洞透照片
            const px = (text.x || 0) + (text.width || 0.3) / 2
            const py = (text.y || 0) + (text.height || 0.05) / 2
            const bx = ((px - freePhotoEntry.x) / freePhotoEntry.w) * 100
            const by = ((py - freePhotoEntry.y) / freePhotoEntry.h) * 100
            span.style.color = 'transparent'
            span.style.backgroundImage = `url(${normalizeStorageUrl(freePhotoEntry.imageUrl)})`
            span.style.backgroundSize = `${(freePhotoEntry.w / Math.max(0.001, text.width || 0.3)) * 100}% auto`
            span.style.backgroundPosition = `${Math.min(100, Math.max(0, bx))}% ${Math.min(100, Math.max(0, by))}%`
            span.style.webkitBackgroundClip = 'text'
            span.style.backgroundClip = 'text'
          } else {
            span.style.color = 'rgba(255,255,255,0.55)'
          }
        } else {
          span.style.color = text.color || '#333333'
        }
        if (fx.shadow) {
          span.style.textShadow = '3px 3px 8px rgba(0,0,0,0.45)'
        }

        wrapper.appendChild(span)
        innerDiv.appendChild(wrapper)
      })
    }
  }

  return innerDiv
}

function setPageContent(pageEl, spreadIndex, isRightHalf) {
  if (!pageEl) return
  pageEl.innerHTML = ''
  pageEl.appendChild(createPageContent(spreadIndex, isRightHalf))
}

function updateStaticPages() {
  const leftEl = pageLeftRef.value
  const rightEl = pageRightRef.value
  const size = displaySize.value
  if (leftEl) {
    leftEl.style.width = size.width
    leftEl.style.height = size.height
    setPageContent(leftEl, currentView.value, false)
  }
  if (rightEl) {
    // 单页模式隐藏右半页
    rightEl.style.display = isSinglePage.value ? 'none' : ''
    rightEl.style.width = size.width
    rightEl.style.height = size.height
    setPageContent(rightEl, currentView.value, true)
  }
}

function updateFlipCardSize() {
  const size = displaySize.value
  const card = flipCardRef.value
  if (card) {
    card.style.width = size.width
    card.style.height = size.height
  }
}

function renderBook() {
  calcDisplaySize()
  updateStaticPages()
  updateFlipCardSize()
}

onMounted(async () => {
  try {
    const pRes = await getProjectById(projectId)
    project.value = pRes.data.data

    const pagesRes = await getProjectPages(projectId)
    projectPages.value = (pagesRes.data.data || [])
      .sort((a, b) => a.pageNumber - b.pageNumber)

    const tplRes = await getTemplatePages(project.value.templateId)
    templatePages.value = (tplRes.data.data || [])
      .sort((a, b) => a.pageNumber - b.pageNumber)

    const zonePromises = templatePages.value.map(tp => getTemplateZones(tp.id))
    const zoneResults = await Promise.all(zonePromises)
    zoneResults.forEach((res, i) => {
      const tplPage = templatePages.value[i]
      if (tplPage) {
        zoneMap.value[tplPage.pageNumber] = res.data.data || []
      }
    })

    await nextTick()
    renderBook()
  } catch (e) {
    console.error('[H5Preview] 加载预览数据失败:', e)
    ElMessage.error('加载预览数据失败')
  }

  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchend', onTouchEnd, { passive: true })
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  clearFlipFallback()
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('touchstart', onTouchStart)
  document.removeEventListener('touchend', onTouchEnd)
  window.removeEventListener('resize', onResize)
})

function onResize() {
  renderBook()
}

async function nextPage() {
  if (isFlipping.value || currentView.value >= totalViews.value - 1) return
  isFlipping.value = true
  flipDirection.value = 'forward'
  flipAnimating.value = true
  await nextTick()
  await nextTick()

  const card = flipCardRef.value
  const frontEl = flipFrontRef.value
  const backEl = flipBackRef.value

  updateFlipCardSize()

  if (frontEl) {
    frontEl.innerHTML = ''
    frontEl.appendChild(createPageContent(currentView.value, true))
  }
  if (backEl) {
    backEl.innerHTML = ''
    backEl.appendChild(createPageContent(currentView.value + 1, false))
  }

  if (card) {
    card.addEventListener('transitionend', onFlipEnd)
    card.style.transition = 'none'
    card.style.transform = 'rotateY(0deg)'
    card.offsetHeight
    card.style.transition = 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)'
    card.style.transform = 'rotateY(-180deg)'
    clearFlipFallback()
    flipFallbackTimer = setTimeout(() => {
      if (isFlipping.value) finishNextPage()
    }, FLIP_FALLBACK_MS)
  } else {
    finishNextPage()
  }
}

function finishNextPage() {
  clearFlipFallback()
  const card = flipCardRef.value
  if (card) {
    card.removeEventListener('transitionend', onFlipEnd)
  }
  currentView.value++
  flipAnimating.value = false
  isFlipping.value = false
  updateStaticPages()
}

async function prevPage() {
  if (isFlipping.value || currentView.value <= 0) return
  isFlipping.value = true
  flipDirection.value = 'backward'
  flipAnimating.value = true
  await nextTick()
  await nextTick()

  const card = flipCardRef.value
  const frontEl = flipFrontRef.value
  const backEl = flipBackRef.value

  updateFlipCardSize()

  if (frontEl) {
    frontEl.innerHTML = ''
    frontEl.appendChild(createPageContent(currentView.value, false))
  }
  if (backEl) {
    backEl.innerHTML = ''
    backEl.appendChild(createPageContent(currentView.value - 1, true))
  }

  if (card) {
    card.addEventListener('transitionend', onFlipEnd)
    card.style.transition = 'none'
    // 后退翻页：当前左页绕书脊向右翻回（0°→180°），露出上一 spread——
    // 与前进（右页向左翻，0°→-180°）方向相反
    card.style.transform = 'rotateY(0deg)'
    card.offsetHeight
    card.style.transition = 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)'
    card.style.transform = 'rotateY(180deg)'
    clearFlipFallback()
    flipFallbackTimer = setTimeout(() => {
      if (isFlipping.value) finishPrevPage()
    }, FLIP_FALLBACK_MS)
  } else {
    finishPrevPage()
  }
}

function finishPrevPage() {
  clearFlipFallback()
  const card = flipCardRef.value
  if (card) {
    card.removeEventListener('transitionend', onFlipEnd)
  }
  currentView.value--
  flipAnimating.value = false
  isFlipping.value = false
  updateStaticPages()
}

function onFlipEnd(e) {
  if (e.propertyName !== 'transform') return
  if (flipDirection.value === 'forward') {
    finishNextPage()
  } else {
    finishPrevPage()
  }
}

function handleKeydown(e) {
  if (e.key === 'ArrowLeft') prevPage()
  else if (e.key === 'ArrowRight') nextPage()
}

let touchStartX = 0
function onTouchStart(e) {
  touchStartX = e.touches[0].clientX
}
function onTouchEnd(e) {
  const deltaX = e.changedTouches[0].clientX - touchStartX
  if (Math.abs(deltaX) > 50) {
    if (deltaX > 0) prevPage()
    else nextPage()
  }
}
</script>

<style scoped>
.h5-preview-page {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #f5f5f7;
}

.preview-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  padding-top: env(safe-area-inset-top, 0px);
  flex-shrink: 0;
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  background: rgba(245, 245, 247, 0.72);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: none;
  position: sticky;
  top: 0;
  z-index: 30;
}

.back-btn {
  color: rgba(0, 0, 0, 0.4) !important;
  transition: color 0.15s ease;
}

.back-btn:hover {
  color: #1d1d1f !important;
  background: transparent !important;
}

.preview-title {
  color: #1d1d1f;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.header-spacer {
  width: 48px;
}

.preview-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  perspective: 2000px;
  container-type: inline-size;
}

.book-wrapper {
  perspective: 2000px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.flipbook {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 0;
}

.book-page {
  background-color: #fff;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.book-page::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 20px;
  pointer-events: none;
  z-index: 2;
}

.book-page-left {
  border-radius: 6px 0 0 6px;
  box-shadow: -4px 4px 24px rgba(0, 0, 0, 0.08);
  z-index: 1;
}

.book-page-left::after {
  right: 0;
  background: linear-gradient(to right, transparent, rgba(0, 0, 0, 0.04));
}

.book-page-right {
  border-radius: 0 6px 6px 0;
  box-shadow: 4px 4px 24px rgba(0, 0, 0, 0.08);
  z-index: 1;
}

.book-page-right::after {
  left: 0;
  background: linear-gradient(to left, transparent, rgba(0, 0, 0, 0.04));
}

.page-inner {
  position: absolute;
  top: 0;
  height: 100%;
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
  container-type: inline-size;
}

.flip-card {
  position: absolute;
  top: 0;
  height: 100%;
  transform-style: preserve-3d;
  z-index: 10;
  pointer-events: none;
  display: none;
}

.flip-card.animating {
  display: block;
}

.flip-face {
  position: absolute;
  top: 0;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  overflow: hidden;
  background-color: #fff;
}

.flip-face::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40px;
  pointer-events: none;
  z-index: 5;
}

.flip-card.forward .flip-front::after {
  right: 0;
  background: linear-gradient(to right, transparent, rgba(0, 0, 0, 0.08));
}

.flip-card.forward .flip-back::after {
  left: 0;
  background: linear-gradient(to left, transparent, rgba(0, 0, 0, 0.08));
}

.flip-card.backward .flip-front::after {
  left: 0;
  background: linear-gradient(to left, transparent, rgba(0, 0, 0, 0.08));
}

.flip-card.backward .flip-back::after {
  right: 0;
  background: linear-gradient(to right, transparent, rgba(0, 0, 0, 0.08));
}

.flip-back {
  transform: rotateY(180deg);
}

.flip-card.forward {
  right: 0;
  transform-origin: left center;
  border-radius: 0 6px 6px 0;
  box-shadow: 8px 0 24px rgba(0, 0, 0, 0.12);
}

.flip-card.forward .flip-back {
  border-radius: 6px 0 0 6px;
}

.flip-card.backward {
  left: 0;
  transform-origin: right center;
  border-radius: 6px 0 0 6px;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);
}

.flip-card.backward .flip-back {
  border-radius: 0 6px 6px 0;
}

.preview-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 20px 24px;
  flex-shrink: 0;
  background: transparent;
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 20px;
}

.page-indicator {
  color: rgba(0, 0, 0, 0.45);
  font-size: 13px;
  font-weight: 500;
  background: rgba(0, 0, 0, 0.04);
  padding: 5px 14px;
  border-radius: 7px;
  min-width: 70px;
  text-align: center;
}

.preview-controls :deep(.el-button) {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  color: #1d1d1f;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.15s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.preview-controls :deep(.el-button:hover:not(:disabled)) {
  background: #fff;
  border-color: rgba(0, 0, 0, 0.15);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.preview-controls :deep(.el-button:disabled) {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.25);
  box-shadow: none;
  cursor: not-allowed;
}

@media (min-width: 768px) {
  .preview-header {
    height: 64px;
    padding: 0 32px;
  }

  .preview-title {
    font-size: 18px;
  }
}

@media (max-width: 768px) {
  .preview-header {
    height: 52px;
    padding: 0 12px;
    padding-top: env(safe-area-inset-top, 0px);
    background: rgba(248, 248, 248, 0.72);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border-bottom: 0.5px solid rgba(0, 0, 0, 0.12);
    animation: ios-header-in 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  }

  @keyframes ios-header-in {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .preview-title {
    font-size: 14px;
    font-weight: 600;
  }

  .header-spacer {
    width: 36px;
  }

  .back-btn {
    border-radius: 50%;
    width: 32px;
    height: 32px;
    min-width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.03);
    border: 0.5px solid rgba(0, 0, 0, 0.06);
    transition: background 0.15s ease, transform 0.12s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .back-btn:active {
    background: rgba(0, 0, 0, 0.08);
    transform: scale(0.92);
  }

  .preview-body {
    padding: 10px;
    perspective: 1200px;
  }

  .book-wrapper {
    padding: 10px;
    perspective: 1200px;
    width: 100%;
    height: 100%;
  }

  .flipbook {
    width: 100%;
    height: 100%;
    justify-content: center;
  }

  .book-page {
    border-radius: 4px;
  }

  .book-page::after {
    width: 12px;
  }

  .book-page-left {
    border-radius: 4px 0 0 4px;
  }

  .book-page-right {
    border-radius: 0 4px 4px 0;
  }

  .preview-footer {
    padding: 10px 12px calc(16px + env(safe-area-inset-bottom, 0px));
    gap: 8px;
  }

  .preview-controls {
    gap: 12px;
  }

  .preview-controls :deep(.el-button) {
    padding: 8px 16px;
    font-size: 14px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.03);
    border: 0.5px solid rgba(0, 0, 0, 0.08);
    transition: transform 0.12s cubic-bezier(0.32, 0.72, 0, 1),
                background 0.15s ease;
  }

  .preview-controls :deep(.el-button:active:not(:disabled)) {
    transform: scale(0.95);
    background: rgba(0, 0, 0, 0.06);
  }

  .page-indicator {
    font-size: 13px;
    padding: 5px 14px;
    border-radius: 20px;
    background: rgba(0, 0, 0, 0.04);
    color: rgba(0, 0, 0, 0.5);
  }
}
</style>