/**
 * 创意装饰引擎（需求 SR-05 / FR-B2/B3）
 * ============================================================
 * 单一参数来源：编辑器（Fabric pattern）、H5 双端（CSS）都从这里
 * 获取参数 schema、分布坐标与 CSS 映射，保证三端视觉一致。
 *
 * 纯逻辑（分布坐标/参数校验/CSS 映射）与绘制（canvas pattern）
 * 分离：纯逻辑可在 Node 环境单测，绘制仅浏览器使用。
 */

// ---- 9 种填充样式（与参考站对齐，FR-B2） ----
export const FILL_STYLES = [
  'solid', 'dots', 'hollow', 'hlines', 'diag',
  'vlines', 'checker', 'wave', 'halftone'
]

// ---- 5 种分布方式（随机/光束/海浪/雨/排列） ----
export const DISTRIBUTIONS = ['random', 'beam', 'wave', 'rain', 'grid']

// ---- 内置字符形状（参考站 Mix/Aa/<3/♪/:3） ----
export const PRESET_CHARS = ['Mix', 'Aa', '<3', '♪', ':3']

export const DEFAULT_PARAMS = {
  fillStyle: 'dots',
  distribution: 'random',
  chars: ['♥'],
  count: 20,
  size: 0.03,          // 相对页面宽的基准尺寸（0-1）
  sizeVariance: 0.5,   // 大小差距 0-1
  waveRows: 3,         // 海浪/排列 行数
  rotation: 0,         // 整体角度（度）
  spread: 5,           // 离散度（光束/随机分布用）
  colors: ['#ffffff'],
  shapeCutout: false   // 形状镂空（在色块上挖洞透照片）
}

/** 参数校验与补全：非法值回退默认，不抛异常（保存数据容错） */
export function normalizeDecorParams(raw) {
  const p = { ...DEFAULT_PARAMS, ...(raw || {}) }
  if (!FILL_STYLES.includes(p.fillStyle)) p.fillStyle = DEFAULT_PARAMS.fillStyle
  if (!DISTRIBUTIONS.includes(p.distribution)) p.distribution = DEFAULT_PARAMS.distribution
  if (!Array.isArray(p.chars) || p.chars.length === 0) p.chars = DEFAULT_PARAMS.chars
  if (!Array.isArray(p.colors) || p.colors.length === 0) p.colors = DEFAULT_PARAMS.colors
  p.count = clampInt(p.count, 1, 200, DEFAULT_PARAMS.count)
  p.size = clampNum(p.size, 0.005, 0.5, DEFAULT_PARAMS.size)
  p.sizeVariance = clampNum(p.sizeVariance, 0, 1, DEFAULT_PARAMS.sizeVariance)
  p.waveRows = clampInt(p.waveRows, 1, 12, DEFAULT_PARAMS.waveRows)
  p.rotation = clampNum(p.rotation, -360, 360, 0)
  p.spread = clampInt(p.spread, 1, 10, DEFAULT_PARAMS.spread)
  p.shapeCutout = !!p.shapeCutout
  return p
}

// ---- 9 种画幅比例预设（对齐参考站 TEMPLATE_RATIOS，M2）----
export const CANVAS_RATIOS = [
  { id: '3:4', w: 1536, h: 2048 },
  { id: '1:1', w: 1536, h: 1536 },
  { id: '4:5', w: 1638, h: 2048 },
  { id: '4:3', w: 2048, h: 1536 },
  { id: '3:5', w: 1229, h: 2048 },
  { id: '5:7', w: 1463, h: 2048 },
  { id: '3:2', w: 2048, h: 1365 },
  { id: '9:16', w: 1080, h: 1920 },
  { id: '16:9', w: 1920, h: 1080 }
]

/** 宽高比吸附最接近的画幅预设（参考站 pickClosestTemplate 同款，M2） */
export function pickClosestRatio(width, height) {
  if (!width || !height) return CANVAS_RATIOS[0]
  const ratio = width / height
  let best = CANVAS_RATIOS[0]
  let bestDiff = Infinity
  for (const r of CANVAS_RATIOS) {
    const diff = Math.abs(ratio - r.w / r.h)
    if (diff < bestDiff) { best = r; bestDiff = diff }
  }
  return best
}

/**
 * 切换画幅后重排自由照片矩形：保持照片原始宽高比（用户要求"切画幅不改变图片原始比例"）。
 * 以原矩形中心为锚，按 imgAspect（照片宽高比）在新页面坐标系下重算 w/h，钳制到页面内。
 * entry 需含 x/y/w/h（页面归一化）与 ratio（照片自然宽高比 = naturalW/naturalH）。
 */
export function refitPhotoRect(entry, pageW, pageH) {
  if (!entry || !entry.ratio || !pageW || !pageH) return entry
  const pageAspect = pageW / pageH
  const imgAspect = entry.ratio
  // 页面归一化坐标（w→页宽、h→页高）：像素比例不变 ⇔ (w·pageW)/(h·pageH) = imgAspect
  let w = entry.w
  let h = (w * pageAspect) / imgAspect
  if (h > 1) {
    h = 1
    w = (h * imgAspect) / pageAspect
  }
  if (w > 1) {
    w = 1
    h = (w * pageAspect) / imgAspect
    if (h > 1) {
      h = 1
      w = (h * imgAspect) / pageAspect
    }
  }
  const cx = entry.x + entry.w / 2
  const cy = entry.y + entry.h / 2
  const clamp01 = v => Math.min(1, Math.max(0, v))
  return {
    ...entry,
    x: clamp01(cx - w / 2),
    y: clamp01(cy - h / 2),
    w,
    h
  }
}

function clampInt(v, min, max, dflt) {
  const n = Math.round(Number(v))
  if (Number.isNaN(n)) return dflt
  return Math.min(max, Math.max(min, n))
}

function clampNum(v, min, max, dflt) {
  const n = Number(v)
  if (Number.isNaN(n)) return dflt
  return Math.min(max, Math.max(min, n))
}

/** 确定性伪随机（同参数同种子 → 同布局，保证编辑器/H5/重开一致） */
export function seededRandom(seed) {
  let s = seed >>> 0
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function hashParams(p) {
  return JSON.stringify([p.fillStyle, p.distribution, p.chars, p.count, p.size, p.sizeVariance, p.waveRows, p.rotation, p.spread, p.colors])
  .split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
}

/** 从调色板取色（多色混合：顺序循环，保证分布均匀可复现） */
function pickColor(colors, i) {
  return colors[i % colors.length]
}

/**
 * 按分布方式生成装饰实例坐标（归一化 0-1，相对整页）。
 * 返回 [{x, y, size, rotation, color, char}]；不包含手动放置的形状（调用方拼接 placed）。
 */
export function generateDistribution(rawParams) {
  const p = normalizeDecorParams(rawParams)
  const rand = seededRandom(hashParams(p))
  const items = []
  const charAt = (i) => p.chars[i % p.chars.length]

  switch (p.distribution) {
    case 'grid': {
      // 排列：waveRows 行 × ceil(count/rows) 列，均匀网格
      const cols = Math.ceil(p.count / p.waveRows)
      for (let i = 0; i < p.count; i++) {
        const row = Math.floor(i / cols)
        const col = i % cols
        items.push({
          x: (col + 0.5) / cols,
          y: (row + 0.5) / p.waveRows,
          size: itemSize(p, rand),
          rotation: p.rotation,
          color: pickColor(p.colors, i),
          char: charAt(i)
        })
      }
      break
    }
    case 'wave': {
      // 海浪：按行排列，y 加正弦波动
      const cols = Math.ceil(p.count / p.waveRows)
      for (let i = 0; i < p.count; i++) {
        const row = Math.floor(i / cols)
        const col = i % cols
        const phase = (col / cols) * Math.PI * 2
        items.push({
          x: (col + 0.5) / cols,
          y: clamp01((row + 0.5) / p.waveRows + Math.sin(phase) * 0.04),
          size: itemSize(p, rand),
          rotation: p.rotation,
          color: pickColor(p.colors, i),
          char: charAt(i)
        })
      }
      break
    }
    case 'rain': {
      // 雨：x 均匀分行、y 随机（Guide：拖伞只移动分布雨滴——交互层处理，坐标同随机 y）
      for (let i = 0; i < p.count; i++) {
        items.push({
          x: clamp01(rand()),
          y: clamp01(rand()),
          size: itemSize(p, rand),
          rotation: p.rotation,
          color: pickColor(p.colors, i),
          char: charAt(i)
        })
      }
      break
    }
    case 'beam': {
      // 光束：从页面中心放射，角度均分 + spread 离散
      const cx = 0.5, cy = 0.5
      for (let i = 0; i < p.count; i++) {
        const angle = (i / p.count) * Math.PI * 2 + (rand() - 0.5) * (p.spread / 10)
        const dist = 0.18 + rand() * 0.32 * (p.spread / 5)
        items.push({
          x: clamp01(cx + Math.cos(angle) * dist),
          y: clamp01(cy + Math.sin(angle) * dist * 1.2),
          size: itemSize(p, rand),
          rotation: p.rotation + (angle * 180) / Math.PI,
          color: pickColor(p.colors, i),
          char: charAt(i)
        })
      }
      break
    }
    case 'random':
    default: {
      for (let i = 0; i < p.count; i++) {
        items.push({
          x: clamp01(rand()),
          y: clamp01(rand()),
          size: itemSize(p, rand),
          rotation: p.rotation + (rand() - 0.5) * 40 * (p.spread / 5),
          color: pickColor(p.colors, i),
          char: charAt(i)
        })
      }
      break
    }
  }
  return items
}

function itemSize(p, rand) {
  // 大小差距：variance=0 全部基准大小，=1 在 [50%, 150%] 浮动
  const factor = 1 + (rand() - 0.5) * p.sizeVariance
  return clamp01(p.size * factor)
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

/**
 * 主色块参数 schema（pageData.block，单对象，需求 SR-06/Q6）
 * x/y/w/h 相对整页 0-1；条纹参数与镂空开关。
 */
export const DEFAULT_BLOCK = {
  style: 'solid',        // solid | stripe
  color: '#ff8fab',
  color2: '#ffffff',     // 条纹第二颜色（切条纹时自动 = 照片次色，M4）
  stripeDir: 'h',        // h | v
  stripeDensity: 10,     // 条纹数（对齐参考站默认 10）
  // 默认几何 = 全宽底部色带（参考站 iOS 默认：y 53% 起、高 47%，M5）
  x: 0, y: 0.53,
  w: 1, h: 0.47,
  shapeCutout: true      // 块内装饰挖洞透照片（参考站默认 true）
}

export function normalizeBlock(raw) {
  const b = { ...DEFAULT_BLOCK, ...(raw || {}) }
  b.style = b.style === 'stripe' ? 'stripe' : 'solid'
  b.stripeDir = b.stripeDir === 'v' ? 'v' : 'h'
  b.stripeDensity = clampInt(b.stripeDensity, 2, 40, DEFAULT_BLOCK.stripeDensity)
  ;['x', 'y', 'w', 'h'].forEach(k => { b[k] = clampNum(b[k], 0, 9, DEFAULT_BLOCK[k]) })
  // 防极端值：面积 ≤ 25×页面（M1 画布=照片∪色块包围盒，色块可出照片扩展画布，仅钳制离谱值）
  if (b.w * b.h > 25) {
    const k = 5 / Math.sqrt(b.w * b.h)
    b.w *= k
    b.h *= k
  }
  b.shapeCutout = !!b.shapeCutout
  return b
}

/** 文字镂空判定：按文字中心点是否落在色块内（需求 Q9，纯几何） */
export function isTextInsideBlock(textCenterNorm, blockNorm) {
  if (!blockNorm || !textCenterNorm) return false
  return textCenterNorm.x >= blockNorm.x &&
    textCenterNorm.x <= blockNorm.x + blockNorm.w &&
    textCenterNorm.y >= blockNorm.y &&
    textCenterNorm.y <= blockNorm.y + blockNorm.h
}

/**
 * 填充样式的 CSS background 映射（H5 双端用，P1-c 消费）。
 * 与 buildPatternCanvas 的 canvas 绘制保持同一视觉语义。
 * 参数 colors：[主色, 次色]；cell：图案重复单元（px，相对页面宽的百分比字符串由调用方换算）。
 */
export function fillStyleToCss(fillStyle, colors, cellPx) {
  const [c1, c2 = 'transparent'] = colors
  const c = `${Math.round(cellPx)}px`
  const half = `${Math.round(cellPx / 2)}px`
  switch (fillStyle) {
    case 'dots':
      return `radial-gradient(${c1} ${Math.round(cellPx * 0.28)}px, transparent ${Math.round(cellPx * 0.3)}px), ${c2}`
    case 'hollow':
      return `radial-gradient(circle at center, ${c2} ${Math.round(cellPx * 0.16)}px, ${c1} ${Math.round(cellPx * 0.18)}px ${Math.round(cellPx * 0.28)}px, transparent ${Math.round(cellPx * 0.3)}px)`
    case 'hlines':
      return `repeating-linear-gradient(180deg, ${c1} 0 ${half}, transparent ${half} ${c})`
    case 'vlines':
      return `repeating-linear-gradient(90deg, ${c1} 0 ${half}, transparent ${half} ${c})`
    case 'diag':
      return `repeating-linear-gradient(45deg, ${c1} 0 ${half}, transparent ${half} ${c})`
    case 'checker':
      return `conic-gradient(${c1} 0 25%, ${c2} 0 50%, ${c1} 0 75%, ${c2} 0) 0 0 / ${c} ${c}`
    case 'wave':
      return `radial-gradient(circle at ${half} ${c}, transparent ${Math.round(cellPx * 0.48)}px, ${c1} ${Math.round(cellPx * 0.5)}px) 0 0 / ${c} ${half}, radial-gradient(circle at 0 0, transparent ${Math.round(cellPx * 0.48)}px, ${c1} ${Math.round(cellPx * 0.5)}px) 0 0 / ${c} ${half}`
    case 'halftone': {
      // 半调：单元格内圆点尺寸线性渐变（用两层错位圆点近似）
      return `radial-gradient(${c1} ${Math.round(cellPx * 0.38)}px, transparent ${Math.round(cellPx * 0.4)}px) 0 0 / ${c} ${c}, radial-gradient(${c1} ${Math.round(cellPx * 0.14)}px, transparent ${Math.round(cellPx * 0.16)}px) ${half} ${half} / ${c} ${c}`
    }
    case 'solid':
    default:
      return c1
  }
}
