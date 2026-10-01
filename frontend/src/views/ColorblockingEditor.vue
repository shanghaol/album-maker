<template>
  <div class="wc-app">
    <!-- 顶部工具栏（macOS 统一工具栏 / 移动端 iOS 磨砂） -->
    <header class="wc-toolbar">
      <button class="wc-circle-btn" @click="$router.back()" title="返回">
        <span class="wc-tbtn-icon">✕</span>
      </button>
      <div class="wc-toolbar-title">colorblocking</div>
      <button class="wc-pill-btn" @click="draftsOpen = true" title="草稿箱">🗂</button>
      <div class="wc-export-wrap">
        <button class="wc-pill-btn wc-export-btn" @click.stop="exportOpen = !exportOpen" title="导出">
          <Share :size="15" />
        </button>
        <div v-if="exportOpen" class="wc-export-menu" @click.stop>
          <button @click="onExportPNG">导出 PNG</button>
        </div>
      </div>
    </header>

    <!-- 画布预览区 -->
    <div class="wc-preview" ref="previewEl">
      <div class="wc-canvas-frame" ref="frameEl" :style="frameStyle">
        <canvas
          ref="canvasEl"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @wheel.prevent="onWheel"
        />
        <!-- 悬浮于画布左上角的撤销/重做（iOS 状态栏磨砂按钮） -->
        <div class="wc-canvas-tools">
          <button class="wc-float-btn" :disabled="!canUndo" @click="doUndo" title="撤销">↩</button>
          <button class="wc-float-btn" :disabled="!canRedo" @click="doRedo" title="重做">↪</button>
        </div>
        <div v-if="!s.image" class="wc-empty" @click="$refs.fileInput.click()">
          <ImagePlus :size="44" :stroke-width="1.4" />
          <p>点击上传照片开始</p>
          <p class="wc-empty-sub">上传后自动匹配画幅并生成配色</p>
        </div>
      </div>
      <input
        ref="fileInput" type="file" accept="image/*" class="wc-file-input"
        @change="onFileChange"
      />
    </div>

    <!-- 底部页签 + 面板 -->
    <div class="wc-panel-wrap">
      <div class="wc-tabs">
        <button
          v-for="t in TABS" :key="t.id"
          class="wc-tab" :class="{ active: activeTab === t.id }"
          @click="switchTab(t.id)"
        >{{ t.label }}</button>
      </div>

      <div class="wc-panel" v-show="activeTab === 'photo'">
        <div class="wc-row">
          <span class="wc-row-label">画幅</span>
          <div class="wc-chip-row">
            <button
              v-for="[rw, rh] in TEMPLATE_RATIOS" :key="rw + ':' + rh"
              class="wc-chip" :class="{ active: s.ratioW === rw && s.ratioH === rh }"
              @click="setRatio(rw, rh)"
            >{{ rw }}:{{ rh }}</button>
          </div>
        </div>
        <div class="wc-row">
          <span class="wc-row-label">拼贴</span>
          <div class="wc-chip-row">
            <button class="wc-chip" :class="{ active: s.photoCopyMode === 'none' }" @click="setCopyMode('none')">单张</button>
            <button class="wc-chip" :class="{ active: s.photoCopyMode === 'vertical' }" @click="setCopyMode('vertical')">上下</button>
            <button class="wc-chip" :class="{ active: s.photoCopyMode === 'horizontal' }" @click="setCopyMode('horizontal')">左右</button>
          </div>
        </div>
        <div class="wc-row">
          <span class="wc-row-label">缩放</span>
          <input type="range" min="50" max="400" :value="Math.round(s.photoZoom * 100)" @input="onZoomInput" class="wc-slider" />
        </div>
        <div class="wc-row">
          <span class="wc-row-label">拖动照片调整位置</span>
          <label class="wc-switch">
            <input type="checkbox" :checked="!s.isPhotoLocked" @change="s.isPhotoLocked = !s.isPhotoLocked" />
            <span class="wc-switch-ui" />
          </label>
        </div>
        <div v-if="!s.image" class="wc-row">
          <button class="wc-btn-primary" @click="$refs.fileInput.click()">上传照片</button>
        </div>
      </div>

      <div class="wc-panel" v-show="activeTab === 'block'">
        <div class="wc-row">
          <span class="wc-row-label">色块颜色</span>
          <div class="wc-swatch-row">
            <button
              v-for="(c, i) in swatchColors" :key="i"
              class="wc-swatch" :class="{ active: rgbEq(s.blockColor, c) }"
              :style="{ background: rgbToCss(c) }"
              @click="pickColor('block', c)"
            />
            <input type="color" class="wc-color-input" :value="rgbToHex(s.blockColor)" @input="pickColor('block', hexToRgb($event.target.value))" />
          </div>
        </div>
        <div class="wc-row">
          <span class="wc-row-label">样式</span>
          <div class="wc-chip-row">
            <button class="wc-chip" :class="{ active: s.blockStyle === 'solid' }" @click="setBlockStyle('solid')">纯色</button>
            <button class="wc-chip" :class="{ active: s.blockStyle === 'stripe' }" @click="setBlockStyle('stripe')">条纹</button>
          </div>
        </div>
        <template v-if="s.blockStyle === 'stripe'">
          <div class="wc-row">
            <span class="wc-row-label">方向</span>
            <div class="wc-chip-row">
              <button class="wc-chip" :class="{ active: s.stripeDirection === 'horizontal' }" @click="setStripe('horizontal')">横向</button>
              <button class="wc-chip" :class="{ active: s.stripeDirection === 'vertical' }" @click="setStripe('vertical')">纵向</button>
            </div>
          </div>
          <div class="wc-row">
            <span class="wc-row-label">密度</span>
            <input type="range" min="2" max="30" :value="s.stripeDensity" @input="onStripeDensity" class="wc-slider" />
          </div>
          <div class="wc-row">
            <span class="wc-row-label">条纹底色</span>
            <div class="wc-swatch-row">
              <button
                v-for="(c, i) in swatchColors" :key="i"
                class="wc-swatch" :class="{ active: rgbEq(s.stripeBgColor, c) }"
                :style="{ background: rgbToCss(c) }"
                @click="pickColor('stripeBg', c)"
              />
            </div>
          </div>
        </template>
        <div class="wc-row">
          <span class="wc-row-label">纸纹</span>
          <div class="wc-chip-row">
            <button
              v-for="tx in TEXTURES" :key="tx.value"
              class="wc-chip" :class="{ active: s.blockTexture === tx.value }"
              @click="setTexture(tx.value)"
            >{{ tx.label }}</button>
          </div>
        </div>
        <div class="wc-row">
          <span class="wc-row-label">显示色块</span>
          <label class="wc-switch">
            <input type="checkbox" :checked="s.showBlock" @change="toggleShowBlock" />
            <span class="wc-switch-ui" />
          </label>
        </div>
        <p class="wc-hint">在画布上拖动色块调整位置，拖动四角调整大小（自动吸附照片边缘）</p>
      </div>

      <div class="wc-panel" v-show="activeTab === 'decorate'">
        <div class="wc-row">
          <span class="wc-row-label">形状</span>
          <div class="wc-chip-row">
            <button
              v-for="sd in SHAPE_DEFS" :key="sd.id"
              class="wc-shape-btn" :class="{ active: pickedTypes.includes(sd.id) }"
              :title="sd.id"
              @click="togglePickedType(sd.id)"
            >
              <span v-if="sd.kind === 'text'" class="wc-shape-glyph">{{ sd.id }}</span>
              <canvas v-else width="28" height="28" :data-shape="sd.id" />
            </button>
          </div>
        </div>
        <div class="wc-row">
          <span class="wc-row-label">分布</span>
          <div class="wc-chip-row">
            <button
              v-for="d in DISTRIBUTIONS" :key="d"
              class="wc-chip" :class="{ active: s.shapeDist === d }"
              @click="setDist(d)"
            >{{ DIST_LABELS[d] }}</button>
          </div>
        </div>
        <div class="wc-row">
          <span class="wc-row-label">填充</span>
          <div class="wc-chip-row">
            <button
              v-for="fs in FILL_STYLES" :key="fs.id"
              class="wc-chip" :class="{ active: s.shapeFillStyle === fs.id }"
              @click="setFill(fs.id)"
            >{{ fs.label }}</button>
          </div>
        </div>
        <div class="wc-row">
          <span class="wc-row-label">形状颜色</span>
          <div class="wc-swatch-row">
            <button
              v-for="(c, i) in swatchColors" :key="i"
              class="wc-swatch" :class="{ active: rgbEq(s.shapeColor, c) }"
              :style="{ background: rgbToCss(c) }"
              @click="pickColor('shape', c)"
            />
            <input type="color" class="wc-color-input" :value="rgbToHex(s.shapeColor)" @input="pickColor('shape', hexToRgb($event.target.value))" />
          </div>
        </div>
        <div class="wc-row"><span class="wc-row-label">数量</span><input type="range" min="1" max="80" :value="s.shapeCount" @input="onShapeCount" class="wc-slider" /></div>
        <div class="wc-row"><span class="wc-row-label">大小</span><input type="range" min="30" max="200" :value="Math.round(s.shapeSizeScale * 100)" @input="onShapeSize" class="wc-slider" /></div>
        <div class="wc-row"><span class="wc-row-label">尺寸抖动</span><input type="range" min="0" max="100" :value="Math.round(s.shapeSizeVariance * 100)" @input="onShapeVariance" class="wc-slider" /></div>
        <div class="wc-row"><span class="wc-row-label">散布范围</span><input type="range" min="30" max="200" :value="Math.round(s.spreadScale * 100)" @input="onSpread" class="wc-slider" /></div>
        <div class="wc-row"><span class="wc-row-label">波浪行数</span><input type="range" min="1" max="8" :value="s.waveRows" @input="onWaveRows" class="wc-slider" /></div>
        <div class="wc-row">
          <span class="wc-row-label">点击画布放置</span>
          <label class="wc-switch">
            <input type="checkbox" :checked="s.tapToPlace" @change="s.tapToPlace = !s.tapToPlace" />
            <span class="wc-switch-ui" />
          </label>
        </div>
        <div class="wc-row">
          <span class="wc-row-label">块内装饰镂空</span>
          <label class="wc-switch">
            <input type="checkbox" :checked="s.shapeCutout" @change="toggleShapeCutout" />
            <span class="wc-switch-ui" />
          </label>
        </div>
        <div class="wc-btn-row">
          <button class="wc-btn-primary" @click="onGenerate">生成</button>
          <button class="wc-btn" @click="onShuffle">换一换</button>
          <button class="wc-btn" @click="onClearShapes">清除</button>
        </div>
        <p class="wc-hint">装饰页签下可拖动单个装饰，按 Delete 删除选中项</p>
      </div>

      <div class="wc-panel" v-show="activeTab === 'text'">
        <div class="wc-row">
          <input
            v-model="textInput" class="wc-text-input" placeholder="输入文字，回车添加"
            @keydown.enter="addText"
          />
          <button class="wc-btn-primary" @click="addText">添加</button>
        </div>
        <div class="wc-row">
          <span class="wc-row-label">字体</span>
          <select class="wc-select" :value="s.textFontFamily" @change="setTextFont($event.target.value)">
            <option v-for="f in FONTS" :key="f.value" :value="f.value" :style="{ fontFamily: f.value }">{{ f.label }}</option>
          </select>
        </div>
        <div class="wc-row">
          <span class="wc-row-label">字号</span>
          <input type="range" min="30" max="260" :value="s.textFontSize" @input="onTextSize" class="wc-slider" />
        </div>
        <div class="wc-row">
          <span class="wc-row-label">颜色</span>
          <div class="wc-swatch-row">
            <button
              v-for="c in TEXT_COLORS" :key="c"
              class="wc-swatch" :class="{ active: s.textColor === c }"
              :style="{ background: c }"
              @click="setTextColor(c)"
            />
            <input type="color" class="wc-color-input" :value="s.textColor" @input="setTextColor($event.target.value)" />
          </div>
        </div>
        <div class="wc-row">
          <span class="wc-row-label">加粗</span>
          <label class="wc-switch"><input type="checkbox" :checked="s.textBold" @change="toggleTextBold" /><span class="wc-switch-ui" /></label>
        </div>
        <div class="wc-row">
          <span class="wc-row-label">阴影</span>
          <label class="wc-switch"><input type="checkbox" :checked="s.textShadow" @change="toggleTextShadow" /><span class="wc-switch-ui" /></label>
        </div>
        <div class="wc-row">
          <span class="wc-row-label">文字镂空</span>
          <label class="wc-switch"><input type="checkbox" :checked="s.textCutout" @change="toggleTextCutout" /><span class="wc-switch-ui" /></label>
        </div>
        <p class="wc-hint">文字页签下可拖动文字位置，按 Delete 删除选中项</p>
      </div>
    </div>

    <!-- 草稿箱弹层 -->
    <div v-if="draftsOpen" class="wc-modal-mask" @click.self="draftsOpen = false">
      <div class="wc-modal">
        <div class="wc-modal-head">
          <h3>草稿箱</h3>
          <button class="wc-circle-btn" @click="draftsOpen = false">✕</button>
        </div>
        <button class="wc-btn-primary wc-modal-save" @click="onSaveDraft">保存当前为草稿</button>
        <div v-if="draftList.length === 0" class="wc-empty-drafts">暂无草稿</div>
        <div v-for="d in draftList" :key="d.id" class="wc-draft-row">
          <span class="wc-draft-name">{{ d.name }}</span>
          <div class="wc-draft-ops">
            <button class="wc-btn" @click="onLoadDraft(d.id)">载入</button>
            <button class="wc-btn wc-btn-danger" @click="onDeleteDraft(d.id)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="wc-toast">{{ toast }}</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Share, ImagePlus } from '@lucide/vue'
import {
  createInitialState, TEMPLATE_RATIOS, SHAPE_DEFS, DISTRIBUTIONS,
  AUTO_COMBOS, FILL_STYLES, findPreset, FALLBACK_PALETTE,
} from '@/utils/colorblocking/state'
import {
  buildShapePath, shapeKind,
} from '@/utils/colorblocking/engine'
import {
  extractPalette, rgbToCss, rgbToHex, hexToRgb,
} from '@/utils/colorblocking/palette'
import {
  photoW, photoH, canvasBox, blockRectCanvas, photoRectCanvas, photoPanRange,
  applyRatio, applyCopyMode, clampBlockArea, snapBlock, pickClosestRatio,
  generateShapes, renderScene, renderForExport, exportPNG,
  hitShape, hitText, hitBlock,
} from '@/utils/colorblocking/engine'
import { createHistory } from '@/utils/colorblocking/history'
import { listDrafts, saveDraft, loadDraft, deleteDraft, makeAutoSaver } from '@/utils/colorblocking/drafts'

const router = useRouter()
const route = useRoute()

const TABS = [
  { id: 'photo', label: '照片' },
  { id: 'block', label: '色块' },
  { id: 'decorate', label: '装饰' },
  { id: 'text', label: '文字' },
]
const DIST_LABELS = { scatter: '散布', beam: '光束', wave: '波浪', rain: '雨落', grid: '网格' }
const TEXTURES = [
  { value: 'none', label: '无' },
  { value: 'paper-watercolor', label: '水彩纸' },
  { value: 'paper-kraft', label: '牛皮纸' },
  { value: 'paper-rice', label: '宣纸' },
  { value: 'paper-card', label: '卡纸' },
]
const FONTS = [
  { label: '系统默认', value: 'system-ui' },
  { label: '苹方', value: 'PingFang SC' },
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: '宋体', value: 'SimSun' },
  { label: '黑体', value: 'SimHei' },
  { label: '楷体', value: 'KaiTi' },
  { label: '仿宋', value: 'FangSong' },
  { label: '隶书', value: 'LiSu' },
  { label: '幼圆', value: 'YouYuan' },
  { label: '华文行楷', value: 'STXingkai' },
  { label: '华文琥珀', value: 'STHupo' },
  { label: '华文彩云', value: 'STCaiyun' },
  { label: '方正舒体', value: 'FZShuTi' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Impact', value: 'Impact' },
  { label: '衬线体', value: 'serif' },
  { label: '手写体', value: 'cursive' },
  { label: '等宽体', value: 'monospace' },
]
const TEXT_COLORS = ['#FFFFFF', '#1d1d1f', '#6366f1', '#ff8fab', '#fbbf24', '#34c759']

// ── 状态 ──
const s = reactive(createInitialState())
const hist = createHistory(s)
const autoSave = makeAutoSaver(s, 1500, makeThumb)

/** 草稿缩略图：整场景渲染后缩到 160px 宽的 JPEG */
function makeThumb() {
  if (!s.image) return null
  try {
    const src = renderForExport(s)
    const w = 160
    const h = Math.max(1, Math.round(src.height * w / src.width))
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    cv.getContext('2d').drawImage(src, 0, 0, w, h)
    return cv.toDataURL('image/jpeg', 0.6)
  } catch (e) {
    return null
  }
}

const activeTab = ref('photo')
const textInput = ref('')
const pickedTypes = ref(['circle', 'star'])
const toast = ref('')
const exportOpen = ref(false)
const draftsOpen = ref(false)
const draftList = ref([])
const frameStyle = reactive({ width: '320px', height: '420px' })
const view = reactive({ scale: 0.3 })

const previewEl = ref(null)
const frameEl = ref(null)
const canvasEl = ref(null)
let ctx = null

const canUndo = ref(false)
const canRedo = ref(false)
function syncHistBtns() {
  canUndo.value = hist.canUndo()
  canRedo.value = hist.canRedo()
}
function capture() {
  hist.capture()
  syncHistBtns()
}
function clearHist() {
  hist.clear()
  syncHistBtns()
}
const swatchColors = computed(() => {
  const seen = new Set()
  const all = [...s.candidateColors, ...s.customColors, ...FALLBACK_PALETTE]
  return all.filter(c => {
    const k = c.join(',')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
})

function showToast(msg, duration = 2400) {
  toast.value = msg
  clearTimeout(showToast._t)
  showToast._t = setTimeout(() => (toast.value = ''), duration)
}

// ── 渲染 ──
function refitDisplay() {
  const box = canvasBox(s)
  const el = previewEl.value
  let pw = el ? el.clientWidth - 24 : 360
  let ph = el ? el.clientHeight - 24 : 480
  if (pw < 10) pw = 360
  if (ph < 10) ph = 480
  const target = pw * (box.h / box.w)
  let w, h
  if (target > ph) { h = ph; w = Math.round(ph * (box.w / box.h)) }
  else { w = pw; h = Math.round(target) }
  frameStyle.width = w + 'px'
  frameStyle.height = h + 'px'
  view.scale = w / box.w
  render()
}

function render() {
  if (!ctx) return
  const cv = canvasEl.value
  const box = canvasBox(s)
  cv.width = Math.round(box.w * view.scale)
  cv.height = Math.round(box.h * view.scale)
  ctx.clearRect(0, 0, cv.width, cv.height)
  renderScene(ctx, s, view.scale)
  drawSelection(ctx)
}

function drawSelection(ctx) {
  ctx.save()
  ctx.scale(view.scale, view.scale)
  const box = canvasBox(s)
  ctx.translate(-box.ox, -box.oy)
  ctx.strokeStyle = '#6366f1'
  ctx.lineWidth = 3 / view.scale
  if (activeTab.value === 'decorate' && s.selectedShapeId) {
    const sh = s.shapes.find(x => x.id === s.selectedShapeId)
    if (sh) {
      ctx.beginPath()
      ctx.arc(sh.x, sh.y, sh.size / 2 + 8, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  if (activeTab.value === 'text' && s.selectedTextId) {
    const n = s.textNodes.find(x => x.id === s.selectedTextId)
    if (n) {
      const w = measureText(n)
      ctx.strokeRect(n.x - w.w / 2 - 10, n.y - w.h / 2 - 6, w.w + 20, w.h + 12)
    }
  }
  if (activeTab.value === 'block' && s.showBlock) {
    const br = blockRectCanvas(s)
    const hs = 14 / view.scale
    ctx.strokeRect(br.x, br.y, br.w, br.h)
    ctx.fillStyle = '#ffffff'
    for (const [hx, hy] of [[br.x, br.y], [br.x + br.w, br.y], [br.x, br.y + br.h], [br.x + br.w, br.y + br.h]]) {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs)
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs)
    }
  }
  ctx.restore()
}

function measureText(n) {
  if (!ctx) return { w: 100, h: n.fontSize }
  ctx.save()
  ctx.font = `${n.bold ? '700' : '400'} ${n.fontSize}px ${n.fontFamily}, system-ui, sans-serif`
  const m = ctx.measureText(n.content || '')
  ctx.restore()
  return { w: m.width, h: n.fontSize * 1.1 }
}

// ── 上传与自动搭配 ──
function onFileChange(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => loadImage(reader.result)
  reader.readAsDataURL(file)
}

function loadImage(dataUrl) {
  const img = new Image()
  img.onload = () => {
    capture()
    s.image = img
    s.imageDataUrl = dataUrl
    const iw = img.naturalWidth, ih = img.naturalHeight
    s.imageType = iw >= ih && iw / ih > 1.05 ? 'landscape' : 'portrait'
    const [rw, rh] = pickClosestRatio(iw, ih)
    applyRatio(s, rw, rh)

    // 取色 → 色槽位
    const palette = extractPalette(img) || FALLBACK_PALETTE.map(c => c.slice())
    s.candidateColors = palette
    s.blockColor = (palette[0] || FALLBACK_PALETTE[0]).slice()
    s.shapeColor = (palette[1] || palette[0] || FALLBACK_PALETTE[1]).slice()
    s.stripeBgColor = (palette[2] || [255, 255, 255]).slice()
    s.uiAccent = (palette[0] || FALLBACK_PALETTE[0]).slice()

    // 自动搭配：随机组合 + 滑块预设
    const combo = AUTO_COMBOS[Math.floor(Math.random() * AUTO_COMBOS.length)]
    const preset = findPreset(s.photoCopyMode, s.imageType, combo.dist)
    s.shapeDist = combo.dist
    s.shapeFillStyle = combo.fill
    s.shapeCount = preset[4]
    s.shapeSizeVariance = preset[5] / 100
    s.shapeSizeScale = 1 * (preset[3] / 100)
    pickedTypes.value = [...combo.shapes]
    const colorPool = palette.slice(1, 5).map(c => rgbToCss(c))
    s.shapes = generateShapes(s, {
      types: combo.shapes, dist: combo.dist, fillStyle: s.shapeFillStyle, colorPool,
    })
    s.selectedShapeId = null
    clearHist()
    refitDisplay()
    autoSave()
    showToast('已按照片自动生成配色与装饰')
  }
  img.src = dataUrl
}

// ── 照片页签 ──
function setRatio(rw, rh) {
  capture()
  applyRatio(s, rw, rh)
  refitDisplay()
  autoSave()
}
function setCopyMode(m) {
  capture()
  applyCopyMode(s, m)
  refitDisplay()
  autoSave()
}
function onZoomInput(e) {
  s.photoZoom = Math.max(0.5, Math.min(4, +e.target.value / 100))
  render()
  autoSave()
}

// ── 色块页签 ──
function pickColor(role, c) {
  capture()
  const rgb = Array.isArray(c) ? c.slice() : c
  if (role === 'block') s.blockColor = rgb
  if (role === 'shape') s.shapeColor = rgb
  if (role === 'stripeBg') s.stripeBgColor = rgb
  render()
  autoSave()
}
function setBlockStyle(v) { capture(); s.blockStyle = v; render(); autoSave() }
function setStripe(d) { capture(); s.stripeDirection = d; render(); autoSave() }
function onStripeDensity(e) { s.stripeDensity = +e.target.value; render(); autoSave() }
function setTexture(v) { capture(); s.blockTexture = v; render(); autoSave() }
function toggleShowBlock() { capture(); s.showBlock = !s.showBlock; render(); autoSave() }
function toggleShapeCutout() { capture(); s.shapeCutout = !s.shapeCutout; render(); autoSave() }

// ── 装饰页签 ──
function togglePickedType(id) {
  const i = pickedTypes.value.indexOf(id)
  if (i >= 0) { if (pickedTypes.value.length > 1) pickedTypes.value.splice(i, 1) }
  else pickedTypes.value.push(id)
}
function setDist(d) { capture(); s.shapeDist = d; render(); autoSave() }
function setFill(v) { capture(); s.shapeFillStyle = v; render(); autoSave() }
function onShapeCount(e) { s.shapeCount = +e.target.value; render(); autoSave() }
function onShapeSize(e) { s.shapeSizeScale = +e.target.value / 100; render(); autoSave() }
function onShapeVariance(e) { s.shapeSizeVariance = +e.target.value / 100; render(); autoSave() }
function onSpread(e) { s.spreadScale = +e.target.value / 100; render(); autoSave() }
function onWaveRows(e) { s.waveRows = +e.target.value; render(); autoSave() }

function colorPoolFor() {
  const pool = swatchColors.value.filter(c => !rgbEq(c, s.stripeBgColor))
  const list = pool.map(rgbToCss)
  return list.length ? list : [rgbToCss(s.shapeColor)]
}

function onGenerate() {
  capture()
  const types = pickedTypes.value.length ? pickedTypes.value : ['circle']
  s.shapes = generateShapes(s, {
    types, dist: s.shapeDist, fillStyle: s.shapeFillStyle, colorPool: colorPoolFor(),
  })
  s.selectedShapeId = null
  render()
  autoSave()
}
function onShuffle() {
  capture()
  const regen = generateShapes(s, {
    types: pickedTypes.value, dist: s.shapeDist, fillStyle: s.shapeFillStyle, colorPool: colorPoolFor(),
  })
  // 换一换只重排位置/尺寸，保留数量与类型构成
  s.shapes = regen
  render()
  autoSave()
}
function onClearShapes() {
  if (!s.shapes.length) return
  capture()
  s.shapes = []
  s.selectedShapeId = null
  render()
  autoSave()
}

// ── 文字页签 ──
function addText() {
  const content = (textInput.value || '').trim()
  if (!content) return
  capture()
  const pr = photoRectCanvas(s)
  s.textNodes.push({
    id: `tx-${Date.now()}`,
    content,
    x: Math.round(pr.x + pr.w / 2),
    y: Math.round(pr.y + pr.h / 2),
    fontFamily: s.textFontFamily,
    fontSize: s.textFontSize,
    color: s.textColor,
    bold: s.textBold,
    shadow: s.textShadow,
  })
  s.selectedTextId = s.textNodes[s.textNodes.length - 1].id
  textInput.value = ''
  render()
  autoSave()
}
function setTextFont(f) { capture(); s.textFontFamily = f; syncSelectedText('fontFamily', f); render(); autoSave() }
function onTextSize(e) { s.textFontSize = +e.target.value; syncSelectedText('fontSize', s.textFontSize); render(); autoSave() }
function setTextColor(c) { capture(); s.textColor = c; syncSelectedText('color', c); render(); autoSave() }
function toggleTextBold() { capture(); s.textBold = !s.textBold; syncSelectedText('bold', s.textBold); render(); autoSave() }
function toggleTextShadow() { capture(); s.textShadow = !s.textShadow; syncSelectedText('shadow', s.textShadow); render(); autoSave() }
function toggleTextCutout() { capture(); s.textCutout = !s.textCutout; render(); autoSave() }
function syncSelectedText(key, val) {
  const n = s.textNodes.find(x => x.id === s.selectedTextId)
  if (n) n[key] = val
}

// ── 画布交互 ──
let drag = null // { mode, id, start, orig }

function toCanvasPoint(e) {
  const box = canvasBox(s)
  const rect = canvasEl.value.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / view.scale) + box.ox,
    y: ((e.clientY - rect.top) / view.scale) + box.oy,
  }
}

function onPointerDown(e) {
  if (!s.image) return
  canvasEl.value.setPointerCapture(e.pointerId)
  const p = toCanvasPoint(e)

  if (activeTab.value === 'photo') {
    if (s.isPhotoLocked) return
    drag = {
      mode: 'photo',
      start: { x: e.clientX, y: e.clientY },
      orig: { ...(s.photoOffset || { x: 0, y: 0 }) },
    }
    return
  }

  if (activeTab.value === 'block') {
    const hit = hitBlock(s, p.x, p.y)
    if (!hit) return
    drag = {
      mode: hit === 'move' ? 'block-move' : `block-resize-${hit}`,
      start: p,
      orig: { x: s.blockX, y: s.blockY, w: s.blockW, h: s.blockH },
    }
    return
  }

  if (activeTab.value === 'decorate') {
    const sh = hitShape(s, p.x, p.y)
    if (sh) {
      s.selectedShapeId = sh.id
      drag = { mode: 'shape', id: sh.id, start: p, orig: { x: sh.x, y: sh.y } }
      render()
    } else if (s.tapToPlace) {
      capture()
      const size = Math.max(18, 108 * s.shapeSizeScale * s.tapPlaceSize)
      s.shapes.push({
        id: `sh-${Date.now()}`, type: pickedTypes.value[0] || 'circle',
        kind: 'solid', x: Math.round(p.x), y: Math.round(p.y),
        size: Math.round(size), color: rgbToCss(s.shapeColor), dist: 'manual',
      })
      render()
      autoSave()
    } else {
      s.selectedShapeId = null
      render()
    }
    return
  }

  if (activeTab.value === 'text') {
    const n = hitText(s, p.x, p.y, measureText)
    if (n) {
      s.selectedTextId = n.id
      drag = { mode: 'text', id: n.id, start: p, orig: { x: n.x, y: n.y } }
    } else {
      s.selectedTextId = null
    }
    render()
  }
}

function onPointerMove(e) {
  if (!drag) return
  if (drag.mode === 'photo') {
    const dx = (e.clientX - drag.start.x) / view.scale
    const dy = (e.clientY - drag.start.y) / view.scale
    if (!drag.captured) {
      if ((Math.abs(dx) + Math.abs(dy)) * view.scale < 6) return
      capture()
      drag.captured = true
    }
    s.photoOffset = { x: Math.round(drag.orig.x + dx), y: Math.round(drag.orig.y + dy) }
    render()
    return
  }
  const p = toCanvasPoint(e)
  if (!drag.captured) {
    capture()
    drag.captured = true
  }
  if (drag.mode === 'shape') {
    const sh = s.shapes.find(x => x.id === drag.id)
    if (sh) { sh.x = Math.round(drag.orig.x + p.x - drag.start.x); sh.y = Math.round(drag.orig.y + p.y - drag.start.y); render() }
  } else if (drag.mode === 'text') {
    const n = s.textNodes.find(x => x.id === drag.id)
    if (n) { n.x = Math.round(drag.orig.x + p.x - drag.start.x); n.y = Math.round(drag.orig.y + p.y - drag.start.y); render() }
  } else if (drag.mode === 'block-move') {
    s.blockX = Math.round(drag.orig.x + p.x - drag.start.x)
    s.blockY = Math.round(drag.orig.y + p.y - drag.start.y)
    render()
  } else if (drag.mode.startsWith('block-resize')) {
    const corner = drag.mode.replace('block-resize-', '')
    const o = drag.orig
    let { x, y, w, h } = o
    const dx = p.x - drag.start.x
    const dy = p.y - drag.start.y
    if (corner.includes('w')) { x = o.x + dx; w = o.w - dx }
    if (corner.includes('e')) { w = o.w + dx }
    if (corner.includes('n')) { y = o.y + dy; h = o.h - dy }
    if (corner.includes('s')) { h = o.h + dy }
    s.blockX = Math.round(x); s.blockY = Math.round(y)
    s.blockW = Math.max(40, Math.round(w)); s.blockH = Math.max(40, Math.round(h))
    render()
  }
}

function onPointerUp() {
  if (!drag) return
  const d = drag
  drag = null
  if (d.captured && d.mode === 'photo') {
    // 两轴都无溢出 = 当前缩放下没有可平移余量，提示用户先放大
    const { maxX, maxY } = photoPanRange(s)
    if (maxX <= 0 && maxY <= 0) {
      s.photoOffset = null
      showToast('当前缩放下照片已铺满画幅，放大后即可拖动调整位置')
    }
  }
  if (d.captured && d.mode.startsWith('block')) {
    snapBlock(s)
    clampBlockArea(s)
    refitDisplay()
  }
  if (d.captured) {
    render()
    autoSave()
  }
}

function onWheel(e) {
  if (activeTab.value !== 'photo' || !s.image || s.isPhotoLocked) return
  const next = Math.max(0.5, Math.min(4, s.photoZoom * (e.deltaY < 0 ? 1.08 : 0.93)))
  s.photoZoom = next
  render()
  autoSave()
}

// ── 撤销 / 重做 ──
function doUndo() {
  if (hist.undo()) { showToast('已撤销') }
  syncHistBtns()
  refitDisplay()
  autoSave()
}
function doRedo() {
  if (hist.redo()) { showToast('已重做') }
  syncHistBtns()
  refitDisplay()
  autoSave()
}

// ── 导出 / 草稿 ──
async function onExportPNG() {
  exportOpen.value = false
  if (!s.image) { showToast('请先上传照片'); return }
  await exportPNG(s)
  showToast('已导出 PNG')
}
function refreshDrafts() { draftList.value = listDrafts() }
function onSaveDraft() {
  const entry = saveDraft({ ...snapState(), draftId: s.draftId, draftName: undefined }, `草稿 ${new Date().toLocaleString()}`, makeThumb())
  if (entry) { showToast('草稿已保存'); refreshDrafts() }
  else showToast('保存失败（存储空间不足）')
}
function onLoadDraft(id) {
  const st = loadDraft(id)
  if (!st) return
  Object.assign(s, st)
  if (s.imageDataUrl) loadImageSilent(s.imageDataUrl)
  draftsOpen.value = false
  showToast('草稿已载入')
}
function onDeleteDraft(id) {
  deleteDraft(id)
  refreshDrafts()
}
function snapState() {
  const { image, ...rest } = s
  void image
  return JSON.parse(JSON.stringify(rest))
}
function loadImageSilent(dataUrl) {
  const img = new Image()
  img.onload = () => { s.image = img; clearHist(); refitDisplay() }
  img.src = dataUrl
}

// ── 键盘 ──
function onKeydown(e) {
  const tag = (e.target?.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return
  const cmd = e.metaKey || e.ctrlKey
  if (cmd && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    e.shiftKey ? doRedo() : doUndo()
  } else if (cmd && e.key.toLowerCase() === 'y') {
    e.preventDefault(); doRedo()
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (s.selectedShapeId) { e.preventDefault(); deleteSelectedShape() }
    else if (s.selectedTextId) { e.preventDefault(); deleteSelectedText() }
  } else if (e.key === 'Escape') {
    s.selectedShapeId = null; s.selectedTextId = null; render()
  }
}
function deleteSelectedShape() {
  capture()
  s.shapes = s.shapes.filter(x => x.id !== s.selectedShapeId)
  s.selectedShapeId = null
  render(); autoSave()
}
function deleteSelectedText() {
  capture()
  s.textNodes = s.textNodes.filter(x => x.id !== s.selectedTextId)
  s.selectedTextId = null
  render(); autoSave()
}

function switchTab(id) {
  activeTab.value = id
  s.activeTab = id
  render()
}
function rgbEq(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

function onResize() { refitDisplay() }
function onDocClick() {
  exportOpen.value = false
}

onMounted(() => {
  ctx = canvasEl.value.getContext('2d')
  refitDisplay()
  refreshDrafts()
  drawShapeIcons()
  // 从个人主页草稿进入：载入指定草稿
  const qid = route.query.draft
  if (qid) {
    const st = loadDraft(String(qid))
    if (st) {
      Object.assign(s, st)
      s.draftId = String(qid)
      if (s.imageDataUrl) {
        const img = new Image()
        img.onload = () => { s.image = img; clearHist(); refitDisplay() }
        img.src = s.imageDataUrl
      }
      showToast('草稿已载入')
    }
  }
  window.addEventListener('resize', onResize)
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onDocClick)
  nextTick(refitDisplay)
})

// 形状按钮图标：用引擎的同款路径绘制，随形状颜色联动
function drawShapeIcons() {
  document.querySelectorAll('canvas[data-shape]').forEach(cv => {
    const size = cv.width
    const c2 = cv.getContext('2d')
    c2.clearRect(0, 0, size, size)
    c2.save()
    c2.translate(size / 2, size / 2)
    c2.fillStyle = '#3a3a3c'
    c2.strokeStyle = '#3a3a3c'
    c2.lineWidth = 2.2
    c2.lineCap = 'round'
    c2.lineJoin = 'round'
    buildShapePath(c2, cv.dataset.shape, Math.round(size * 0.64))
    if (shapeKind(cv.dataset.shape) === 'stroke') c2.stroke()
    else c2.fill()
    c2.restore()
  })
}
watch(() => s.shapeColor, () => nextTick(drawShapeIcons))
watch(() => s.shapeFillStyle, () => nextTick(drawShapeIcons))
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onDocClick)
})
</script>

<style scoped>
.wc-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f7;
  color: #1d1d1f;
  font-family: -apple-system, 'PingFang SC', system-ui, sans-serif;
  overflow: hidden;
}
.wc-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 16px;
  padding-top: env(safe-area-inset-top, 0px);
  background: linear-gradient(
    180deg,
    rgba(245, 245, 247, 0.88) 0%,
    rgba(245, 245, 247, 0.74) 100%
  );
  backdrop-filter: saturate(210%) blur(24px);
  -webkit-backdrop-filter: saturate(210%) blur(24px);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 -1px 0 rgba(0, 0, 0, 0.03) inset;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  z-index: 20;
  position: relative;
}
.wc-toolbar-title {
  flex: 1;
  text-align: center;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: -0.02em;
  color: #1d1d1f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 圆形磨砂按钮（返回）——与主编辑器 back-btn 同款 */
.wc-circle-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}
.wc-circle-btn:hover {
  background: rgba(255, 255, 255, 0.75);
  border-color: rgba(0, 0, 0, 0.16);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transform: scale(1.08);
}
.wc-circle-btn:active { transform: scale(0.94); transition: transform 0.1s ease; }
/* 分段药丸按钮组（macOS segmented control） */
.wc-pill-btn {
  width: 30px;
  min-width: 30px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.6);
  cursor: pointer;
  border-radius: 7px;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.wc-pill-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(0, 0, 0, 0.16);
  color: #1d1d1f;
  transform: scale(1.06);
  z-index: 1;
}
.wc-pill-btn:active:not(:disabled) { transform: scale(0.94); transition: transform 0.08s ease; }
.wc-pill-btn:disabled {
  background: transparent;
  border-color: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.2);
  cursor: default;
}
/* 悬浮于画布左上角的撤销/重做（iOS 状态栏磨砂按钮） */
.wc-canvas-tools {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 8px;
  z-index: 6;
}
.wc-float-btn {
  width: 36px;
  height: 36px;
  border-radius: 18px;
  border: 0.5px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 2px 8px rgba(0, 0, 0, 0.1);
  color: #1d1d1f;
  font-size: 15px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    background 0.2s ease,
    box-shadow 0.2s ease;
}
.wc-float-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.8);
  transform: scale(1.08);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
}
.wc-float-btn:active:not(:disabled) { transform: scale(0.94); transition: transform 0.1s ease; }
.wc-float-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.wc-export-wrap { position: relative; }
.wc-export-menu {
  position: absolute; right: 0; top: 40px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  overflow: hidden;
  min-width: 170px;
  z-index: 30;
}
.wc-export-menu button {
  display: block; width: 100%;
  padding: 12px 16px;
  border: none; background: none;
  text-align: left; font-size: 14px;
  cursor: pointer;
}
.wc-export-menu button:hover { background: rgba(0, 0, 0, 0.04); }
.wc-export-menu button:disabled { color: rgba(0, 0, 0, 0.3); }

.wc-preview {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  padding: 12px;
  min-height: 0;
  position: relative;
}
.wc-canvas-frame {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.14),
    0 2px 8px rgba(0, 0, 0, 0.08),
    0 1px 0 rgba(255, 255, 255, 0.6) inset;
}
.wc-canvas-frame canvas { display: block; touch-action: none; }
.wc-empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
  color: rgba(0, 0, 0, 0.3);
  cursor: pointer;
  background: #fbfbfd;
}
.wc-empty p { margin: 0; font-size: 14px; }
.wc-empty-sub { font-size: 12px !important; color: rgba(0, 0, 0, 0.22); }
.wc-file-input { display: none; }

.wc-panel-wrap {
  background: rgba(248, 248, 248, 0.72);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-top: 0.5px solid rgba(0, 0, 0, 0.1);
  max-height: 42vh;
  display: flex; flex-direction: column;
  z-index: 15;
}
.wc-tabs {
  display: flex;
  gap: 4px;
  margin: 10px 16px 2px;
  padding: 3px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 10px;
}
.wc-tab {
  flex: 1;
  padding: 7px 0 6px;
  border: none; background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.5);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
.wc-tab.active {
  background: #ffffff;
  color: #1d1d1f;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 0 rgba(255, 255, 255, 0.7) inset;
}
.wc-panel {
  padding: 12px 16px 18px;
  overflow-y: auto;
}
.wc-row {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 12px;
}
.wc-row-label {
  flex-shrink: 0;
  width: 92px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.55);
}
.wc-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.wc-chip {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  color: rgba(0, 0, 0, 0.7);
}
.wc-chip.active {
  background: #6366f1;
  border-color: #6366f1;
  color: #ffffff;
  font-weight: 600;
}
.wc-shape-btn {
  width: 40px; height: 40px;
  border-radius: 11px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: border-color 0.15s, background 0.15s;
}
.wc-shape-btn.active {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.08);
}
.wc-shape-btn--sm {
  width: 32px; height: 32px;
  border-radius: 9px;
}
.wc-shape-glyph {
  font-size: 17px;
  font-weight: 700;
  color: #3a3a3c;
}
.wc-slider { flex: 1; accent-color: #6366f1; }
.wc-switch { position: relative; display: inline-block; width: 46px; height: 28px; }
.wc-switch input { opacity: 0; width: 0; height: 0; }
.wc-switch-ui {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 999px;
  transition: background 0.2s;
}
.wc-switch-ui::after {
  content: '';
  position: absolute;
  top: 2px; left: 2px;
  width: 24px; height: 24px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s;
}
.wc-switch input:checked + .wc-switch-ui { background: #34c759; }
.wc-switch input:checked + .wc-switch-ui::after { transform: translateX(18px); }
.wc-swatch-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.wc-swatch {
  width: 30px; height: 30px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
  cursor: pointer;
}
.wc-swatch.active { box-shadow: 0 0 0 2.5px #6366f1; }
.wc-color-input { width: 30px; height: 30px; border: none; padding: 0; background: none; cursor: pointer; }
.wc-btn-row { display: flex; gap: 10px; margin-top: 4px; }
.wc-btn, .wc-btn-primary {
  flex: 1;
  padding: 11px 0;
  border-radius: 7px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.wc-btn {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.6);
}
.wc-btn:hover { background: rgba(255, 255, 255, 0.8); border-color: rgba(0, 0, 0, 0.16); color: #1d1d1f; transform: scale(1.03); }
.wc-btn-danger { color: #ff3b30; }
.wc-btn-primary {
  background: #6366f1;
  color: #ffffff;
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(99, 102, 241, 0.2), 0 1px 0 rgba(255, 255, 255, 0.15) inset;
}
.wc-btn-primary:hover {
  background: #5558e6;
  transform: scale(1.03);
  box-shadow: 0 3px 12px rgba(99, 102, 241, 0.3), 0 1px 0 rgba(255, 255, 255, 0.2) inset;
}
.wc-btn:active, .wc-btn-primary:active { transform: scale(0.97); transition: transform 0.08s ease; }
.wc-text-input {
  flex: 1;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  font-size: 14px;
}
.wc-select {
  flex: 1;
  padding: 9px 10px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  font-size: 13px;
  background: #fff;
}
.wc-hint {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
  margin: 4px 0 0;
}
.wc-modal-mask {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex; align-items: center; justify-content: center;
  z-index: 50;
}
.wc-modal {
  width: min(420px, 88vw);
  max-height: 70vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 18px;
  padding: 18px;
}
.wc-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.wc-modal-head h3 { margin: 0; font-size: 17px; }
.wc-modal-save { width: 100%; margin-bottom: 12px; }
.wc-empty-drafts { text-align: center; color: rgba(0, 0, 0, 0.3); padding: 24px 0; font-size: 14px; }
.wc-draft-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}
.wc-draft-name { font-size: 13px; color: rgba(0, 0, 0, 0.7); }
.wc-draft-ops { display: flex; gap: 8px; }
.wc-draft-ops .wc-btn { padding: 7px 14px; flex: none; }
.wc-toast {
  position: fixed;
  bottom: calc(42vh + 20px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 30, 32, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  color: #fff;
  font-size: 13px;
  padding: 10px 18px;
  border-radius: 999px;
  border: 0.5px solid rgba(255, 255, 255, 0.12);
  z-index: 60;
  pointer-events: none;
}
/* ============================================ */
/* Responsive — 桌面 / 平板 / 手机 三端          */
/* ============================================ */

/* 平板：收紧工具栏与面板留白 */
@media (max-width: 1024px) {
  .wc-toolbar { padding: 0 12px; }
  .wc-panel { padding: 10px 14px 16px; }
}

/* 手机：iOS 状态栏安全区 + 磨砂工具栏 */
@media (max-width: 768px) {
  .wc-toolbar {
    height: 50px;
    padding: 0 12px;
    padding-top: env(safe-area-inset-top, 0px);
    gap: 8px;
    background: rgba(248, 248, 248, 0.72);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
  }
  .wc-toolbar-title { font-size: 15px; text-align: left; }
  .wc-panel-wrap { max-height: 46vh; }
  .wc-row-label { width: 80px; font-size: 12px; }
  .wc-float-btn { width: 32px; height: 32px; border-radius: 16px; font-size: 14px; }
}

@media (max-width: 640px) {
  .wc-canvas-frame { border-radius: 8px; }
  .wc-preview { padding: 10px; }
  .wc-panel { padding: 10px 12px 14px; }
  .wc-tabs { margin: 8px 12px 2px; }
}
</style>
