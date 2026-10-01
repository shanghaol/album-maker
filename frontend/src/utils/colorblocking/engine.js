/**
 * Colorblocking 编辑器 — 渲染与几何引擎（自研实现）
 *
 * 职责：画布包围盒计算、色块吸附/钳制、装饰分布生成、整场景渲染
 * （照片平铺 → 色块镂空合成 → 装饰 → 文字）、命中检测、PNG 导出。
 * 交互（指针事件）由视图层驱动，引擎只提供查询与变更函数。
 */
import {
  PHOTO_BASE_W, BLOCK_AREA_FACTOR, DEFAULT_BAND, TEMPLATE_RATIOS,
} from './state'

// ── 几何 ──────────────────────────────────────────────────────────────

export function photoBaseH(s) {
  let h = Math.round(PHOTO_BASE_W * s.ratioH / s.ratioW)
  if (h % 2 !== 0) h += 1
  return h
}
export function copyCols(s) { return s.photoCopyMode === 'horizontal' ? 2 : 1 }
export function copyRows(s) { return s.photoCopyMode === 'vertical' ? 2 : 1 }
export function photoW(s) { return PHOTO_BASE_W * copyCols(s) }
export function photoH(s) { return photoBaseH(s) * copyRows(s) }

/** 画布 = 照片 ∪ 色块 紧致包围盒（照片空间原点可负） */
export function canvasBox(s) {
  const ox = Math.min(0, s.blockX)
  const oy = Math.min(0, s.blockY)
  const w = Math.max(photoW(s), s.blockX + s.blockW) - ox
  const h = Math.max(photoH(s), s.blockY + s.blockH) - oy
  return { ox, oy, w, h }
}

export function blockRectCanvas(s) {
  const { ox, oy } = canvasBox(s)
  return { x: s.blockX - ox, y: s.blockY - oy, w: s.blockW, h: s.blockH }
}

export function photoRectCanvas(s) {
  const { ox, oy } = canvasBox(s)
  return { x: -ox, y: -oy, w: photoW(s), h: photoH(s) }
}

/** 默认色带：全宽，照片底部 47% */
export function defaultBlock(s) {
  const pw = photoW(s), ph = photoH(s)
  return {
    blockX: 0,
    blockY: Math.round(ph * DEFAULT_BAND.topPct),
    blockW: pw,
    blockH: Math.round(ph * (1 - DEFAULT_BAND.topPct)),
  }
}

export function applyRatio(s, w, h) {
  s.ratioW = w; s.ratioH = h
  Object.assign(s, defaultBlock(s))
  s.photoOffset = null
  s.photoZoom = 1
}

export function applyCopyMode(s, mode) {
  s.photoCopyMode = mode === 'vertical' || mode === 'horizontal' ? mode : 'none'
  Object.assign(s, defaultBlock(s))
  s.photoOffset = null
  s.photoZoom = 1
}

/** 面积钳制：色块 ≤ 照片面积×9 */
export function clampBlockArea(s) {
  const max = photoW(s) * photoH(s) * BLOCK_AREA_FACTOR
  const area = s.blockW * s.blockH
  if (area <= max) return false
  const k = Math.sqrt(max / area)
  s.blockW = Math.round(s.blockW * k)
  s.blockH = Math.round(s.blockH * k)
  return true
}

/** 色块边缘吸附：照片边/中线/复制缝，阈值 20px */
export function snapBlock(s, threshold = 20) {
  const pw = photoW(s), ph = photoH(s)
  const bw = PHOTO_BASE_W, bh = photoBaseH(s)
  let { blockX: bx, blockY: by, blockW: bW, blockH: bH } = s
  let hit = false
  const near = (v, t) => Math.abs(v - t) < threshold
  for (const a of [0, pw / 2, pw, -pw]) if (near(bx, a)) { bx = a; hit = true; break }
  for (const a of [0, pw / 2, pw, pw * 2]) if (near(bx + bW, a)) { bW = a - bx; hit = true; break }
  for (const a of [0, ph / 2, ph, -ph]) if (near(by, a)) { by = a; hit = true; break }
  for (const a of [0, ph / 2, ph, ph * 2]) if (near(by + bH, a)) { bH = a - by; hit = true; break }
  if (near(bW, pw)) { bW = pw; hit = true }
  if (near(bW, pw / 2)) { bW = pw / 2; hit = true }
  if (near(bH, ph)) { bH = ph; hit = true }
  if (near(bH, ph / 2)) { bH = ph / 2; hit = true }
  if (s.photoCopyMode === 'vertical' && near(by, bh)) { by = bh; hit = true }
  if (s.photoCopyMode === 'horizontal' && near(bx, bw)) { bx = bw; hit = true }
  if (hit) {
    s.blockX = Math.round(bx); s.blockY = Math.round(by)
    s.blockW = Math.max(40, Math.round(bW)); s.blockH = Math.max(40, Math.round(bH))
  }
  return hit
}

/** 最接近画幅预设：|ratio - 预设| 最小者 */
export function pickClosestRatio(w, h) {
  const r = w / h
  let best = TEMPLATE_RATIOS[0], bestD = Infinity
  for (const [rw, rh] of TEMPLATE_RATIOS) {
    const d = Math.abs(r - rw / rh)
    if (d < bestD) { bestD = d; best = [rw, rh] }
  }
  return best
}

// ── 形状绘制（自绘路径） ─────────────────────────────────────────────

export function buildShapePath(ctx, type, size) {
  const r = size / 2
  ctx.beginPath()
  switch (type) {
    case 'circle':
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      break
    case 'square':
      ctx.rect(-r, -r, size, size)
      break
    case 'triangle':
      ctx.moveTo(0, -r)
      ctx.lineTo(r * 0.95, r * 0.75)
      ctx.lineTo(-r * 0.95, r * 0.75)
      ctx.closePath()
      break
    case 'star': {
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const fn = i === 0 ? 'moveTo' : 'lineTo'
        ctx[fn](Math.cos(a) * rad, Math.sin(a) * rad)
      }
      ctx.closePath()
      break
    }
    case 'star4': {
      for (let i = 0; i < 8; i++) {
        const rad = i % 2 === 0 ? r : r * 0.38
        const a = -Math.PI / 2 + (i * Math.PI) / 4
        const fn = i === 0 ? 'moveTo' : 'lineTo'
        ctx[fn](Math.cos(a) * rad, Math.sin(a) * rad)
      }
      ctx.closePath()
      break
    }
    case 'raindrop':
      ctx.moveTo(0, -r)
      ctx.bezierCurveTo(r * 0.9, -r * 0.15, r * 0.72, r * 0.55, 0, r * 0.95)
      ctx.bezierCurveTo(-r * 0.72, r * 0.55, -r * 0.9, -r * 0.15, 0, -r)
      break
    case 'cloud':
      ctx.arc(-r * 0.45, r * 0.12, r * 0.42, 0, Math.PI * 2)
      ctx.arc(0, -r * 0.22, r * 0.52, 0, Math.PI * 2)
      ctx.arc(r * 0.5, r * 0.1, r * 0.4, 0, Math.PI * 2)
      ctx.rect(-r * 0.5, r * 0.05, r, r * 0.45)
      break
    case 'pixelHeart': {
      const u = size / 7
      const rows = [
        [1, 0, 1, 1, 0, 1, 1],
        [1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 0],
        [0, 0, 1, 1, 1, 0, 0],
        [0, 0, 0, 1, 0, 0, 0],
      ]
      rows.forEach((row, ry) => row.forEach((v, rx) => {
        if (v) ctx.rect((rx - 3.5) * u, (ry - 3) * u, u + 0.5, u + 0.5)
      }))
      break
    }
    case 'umbrella':
      ctx.arc(0, -r * 0.15, r, Math.PI, 0)
      ctx.rect(-r * 0.06, -r * 0.15, r * 0.12, r * 1.05)
      ctx.arc(r * 0.25, r * 0.95, r * 0.25, 0, Math.PI, true)
      break
    case 'spiral': {
      const turns = 3
      ctx.moveTo(0, 0)
      for (let a = 0; a <= turns * Math.PI * 2; a += 0.2) {
        const rad = (a / (turns * Math.PI * 2)) * r
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
      }
      break
    }
    case 'spinner': {
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
        ctx.arc(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, r * 0.16, 0, Math.PI * 2)
      }
      break
    }
    default:
      ctx.rect(-r, -r, size, size)
  }
}

const TEXT_SHAPE_FONT = {
  '<3': '❤', ':3': ':3', '♪': '♪',
}

function drawShape(ctx, shape, fillMode, fillStyle) {
  if (shape.kind === 'text') {
    ctx.save()
    ctx.font = `700 ${shape.size}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = fillMode === 'hole' ? '#000' : shape.color
    ctx.fillText(TEXT_SHAPE_FONT[shape.type] || shape.type, shape.x, shape.y)
    ctx.restore()
    return
  }
  ctx.save()
  ctx.translate(shape.x, shape.y)
  buildShapePath(ctx, shape.type, shape.size)
  if (shape.kind === 'stroke' || fillMode === 'stroke') {
    ctx.strokeStyle = fillMode === 'hole' ? '#000' : shape.color
    ctx.lineWidth = Math.max(2, shape.size * 0.09)
    ctx.lineCap = 'round'
    ctx.stroke()
  } else if (fillMode === 'hole' || !fillStyle || fillStyle === 'solid') {
    ctx.fillStyle = fillMode === 'hole' ? '#000' : shape.color
    ctx.fill()
  } else {
    // 图案填充：形状内部以对应纹样贴图平铺
    const tile = getFillTile(fillStyle, shape.color)
    if (tile) {
      ctx.fillStyle = ctx.createPattern(tile, 'repeat')
      ctx.fill()
    } else {
      ctx.fillStyle = shape.color
      ctx.fill()
    }
  }
  ctx.restore()
}

/**
 * 填充纹样贴图（按 样式+颜色 缓存），26px 可平铺，形状颜色绘制、底透明。
 * 样式：dots 圆点 / hollowDots 镂点 / hStripe 横纹 / diagonal 斜线 /
 *       vStripe 竖纹 / checker 棋盘 / wave 波浪 / halftone 半调
 */
const fillTileCache = {}
export function getFillTile(style, color) {
  const key = style + '|' + color
  if (fillTileCache[key]) return fillTileCache[key]
  const T = 26
  const t = document.createElement('canvas')
  t.width = T
  t.height = T
  const c = t.getContext('2d')
  c.fillStyle = color
  c.strokeStyle = color
  c.lineWidth = 1.8
  const dot = (x, y, r, hollow) => {
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    hollow ? c.stroke() : c.fill()
  }
  switch (style) {
    case 'dots':
      dot(6.5, 6.5, 5); dot(19.5, 6.5, 5); dot(6.5, 19.5, 5); dot(19.5, 19.5, 5)
      break
    case 'hollowDots':
      c.lineWidth = 2
      dot(6.5, 6.5, 4.6, true); dot(19.5, 6.5, 4.6, true); dot(6.5, 19.5, 4.6, true); dot(19.5, 19.5, 4.6, true)
      break
    case 'hStripe':
      c.fillRect(0, 0, T, 8)
      c.fillRect(0, 13, T, 8)
      break
    case 'vStripe':
      c.fillRect(0, 0, 8, T)
      c.fillRect(13, 0, 8, T)
      break
    case 'diagonal':
      c.lineWidth = 4.5
      for (let o = -T; o <= T * 2; o += 13) {
        c.beginPath()
        c.moveTo(o - 6, T + 6)
        c.lineTo(o + T + 6, -6)
        c.stroke()
      }
      break
    case 'checker':
      c.fillRect(0, 0, 13, 13)
      c.fillRect(13, 13, 13, 13)
      break
    case 'wave':
      c.lineWidth = 3.4
      for (const y0 of [6.5, 19.5]) {
        c.beginPath()
        for (let x = -2; x <= T + 2; x += 2) {
          const y = y0 + Math.sin((x / T) * Math.PI * 4) * 3.6
          x === -2 ? c.moveTo(x, y) : c.lineTo(x, y)
        }
        c.stroke()
      }
      break
    case 'halftone': {
      const cols = [6.2, 5, 3.8, 2.8]
      for (let i = 0; i < cols.length; i++) {
        const x = 3.25 + i * 6.5
        const r = cols[i]
        dot(x, 6.5, r); dot(x, 19.5, r)
      }
      break
    }
    default:
      return null
  }
  fillTileCache[key] = t
  return t
}

// ── 分布生成 ─────────────────────────────────────────────────────────

const rand = (min, max) => Math.random() * (max - min) + min

function calcSize(base, variance) {
  return base * (1 + (Math.random() * 2 - 1) * variance)
}

/**
 * 在 photoRect（画布空间）上按分布生成形状。
 * density 决定散布带宽度；count 数量；sizeScale×基础尺寸；variance 尺寸抖动。
 */
export function generateShapes(s, { types, dist, fillStyle, colorPool }) {
  const pr = photoRectCanvas(s)
  const base = 108
  const scale = s.shapeSizeScale
  const count = Math.max(1, Math.round(s.shapeCount))
  const variance = s.shapeSizeVariance
  const shapes = []
  const midY = pr.y + pr.h / 2
  const spread = pr.h * 0.5 * s.spreadScale

  const pickColor = i => colorPool.length ? colorPool[i % colorPool.length] : s.shapeColor

  for (let i = 0; i < count; i++) {
    let x, y
    switch (dist) {
      case 'beam': { // 对角光束带
        const t = i / count
        x = pr.x + t * pr.w * 1.1 - pr.w * 0.05
        y = midY + Math.sin(t * Math.PI * 2) * spread * 0.45 + rand(-30, 30)
        break
      }
      case 'wave': { // 多行正弦
        const rows = Math.max(1, s.waveRows)
        const row = i % rows
        const t = Math.floor(i / rows) / Math.ceil(count / rows)
        x = pr.x + t * pr.w
        y = pr.y + pr.h * ((row + 1) / (rows + 1)) + Math.sin(t * Math.PI * 3) * 26
        break
      }
      case 'rain': { // 竖直雨列
        const cols = Math.max(3, Math.round(s.shapeDensity + 3))
        const col = i % cols
        x = pr.x + ((col + 0.5) / cols) * pr.w
        y = pr.y + ((Math.floor(i / cols) + 0.5) / Math.ceil(count / cols)) * pr.h
        break
      }
      case 'grid': { // 网格
        const cols = Math.max(2, Math.round(Math.sqrt(count * pr.w / pr.h)))
        const rows = Math.ceil(count / cols)
        const c = i % cols, r2 = Math.floor(i / cols)
        x = pr.x + ((c + 0.5) / cols) * pr.w
        y = pr.y + ((r2 + 0.5) / rows) * pr.h
        break
      }
      default: { // scatter 随机散布
        x = rand(pr.x, pr.x + pr.w)
        y = rand(pr.y, pr.y + pr.h)
      }
    }
    const type = types[i % types.length]
    const size = Math.max(18, calcSize(base * scale, variance))
    const color = pickColor(0)
    shapes.push({
      id: `sh-${Date.now()}-${i}-${Math.floor(Math.random() * 1e4)}`,
      type,
      kind: shapeKind(type),
      x: Math.round(x), y: Math.round(y), size: Math.round(size),
      color, dist,
    })
  }
  return shapes
}

export function shapeKind(type) {
  if (['<3', ':3', '♪'].includes(type)) return 'text'
  return ['spiral', 'spinner'].includes(type) ? 'stroke' : 'solid'
}

// ── 照片绘制 ─────────────────────────────────────────────────────────

/** 单块照片绘制：cover 适配（保持原始比例），缩放/拖拽均以瓦片中心为轴 */
function drawPhotoTile(ctx, img, dx, dy, dw, dh, zoom, offset) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return
  const k = Math.max(dw / iw, dh / ih) * zoom
  const drawW = iw * k
  const drawH = ih * k
  const maxX = Math.max(0, (drawW - dw) / 2)
  const maxY = Math.max(0, (drawH - dh) / 2)
  const ox = Math.max(-maxX, Math.min(maxX, (offset?.x || 0)))
  const oy = Math.max(-maxY, Math.min(maxY, (offset?.y || 0)))
  ctx.drawImage(img, dx + (dw - drawW) / 2 + ox, dy + (dh - drawH) / 2 + oy, drawW, drawH)
}

/** 照片当前可平移的余量（画布空间像素）；两轴均为 0 表示拖不动 */
export function photoPanRange(s) {
  if (!s.image) return { maxX: 0, maxY: 0 }
  const iw = s.image.naturalWidth || s.image.width
  const ih = s.image.naturalHeight || s.image.height
  const dw = photoW(s), dh = photoBaseH(s)
  const k = Math.max(dw / iw, dh / ih) * (s.photoZoom || 1)
  return {
    maxX: Math.max(0, (iw * k - dw) / 2),
    maxY: Math.max(0, (ih * k - dh) / 2),
  }
}

function renderPhoto(ctx, s) {
  if (!s.image) return
  const { ox, oy } = canvasBox(s)
  const bw = PHOTO_BASE_W, bh = photoBaseH(s)
  const tiles = []
  const mode = s.photoCopyMode
  if (mode === 'vertical') {
    tiles.push([0, 0, s.photoOffset], [0, bh, s.photoOffsetBottom || s.photoOffset])
  } else if (mode === 'horizontal') {
    tiles.push([0, 0, s.photoOffset], [bw, 0, s.photoOffsetBottom || s.photoOffset])
  } else {
    tiles.push([0, 0, s.photoOffset])
  }
  for (const [tx, ty, off] of tiles) {
    drawPhotoTile(ctx, s.image, tx - ox, ty - oy, bw, bh, s.photoZoom || 1, off)
  }
}

// ── 色块渲染 + 镂空合成 ──────────────────────────────────────────────

function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h
}

/** 渲染色块到离屏 canvas：填充 + 镂空（形状/文字按开关与位置判定） */
function renderBlockComposite(s, br) {
  const off = document.createElement('canvas')
  off.width = Math.max(1, Math.round(br.w))
  off.height = Math.max(1, Math.round(br.h))
  const ctx = off.getContext('2d')

  // 填充：纯色 / 条纹 / 纸纹叠加
  if (s.blockStyle === 'stripe') {
    ctx.fillStyle = rgbCss(s.stripeBgColor)
    ctx.fillRect(0, 0, br.w, br.h)
    const stripes = Math.max(2, Math.round(s.stripeDensity))
    const vertical = s.stripeDirection === 'vertical'
    const band = (vertical ? br.w : br.h) / (stripes * 2)
    ctx.fillStyle = rgbCss(s.blockColor)
    for (let i = 0; i < stripes; i++) {
      if (vertical) ctx.fillRect(i * band * 2, 0, band, br.h)
      else ctx.fillRect(0, i * band * 2, br.w, band)
    }
  } else {
    ctx.fillStyle = rgbCss(s.blockColor)
    ctx.fillRect(0, 0, br.w, br.h)
  }
  if (s.blockTexture !== 'none') {
    const tex = getTexture(s.blockTexture)
    if (tex) {
      const p = ctx.createPattern(tex, 'repeat')
      ctx.fillStyle = p
      ctx.fillRect(0, 0, br.w, br.h)
    }
  }

  // 镂空：块内装饰（shapeCutout）+ 块内文字（textCutout）
  ctx.globalCompositeOperation = 'destination-out'
  if (s.shapeCutout) {
    for (const sh of s.shapes) {
      if (pointInRect(sh.x, sh.y, br)) drawShapeAt(ctx, sh, -br.x, -br.y, 'hole')
    }
  }
  if (s.textCutout) {
    for (const n of s.textNodes) {
      if (pointInRect(n.x, n.y, br)) drawTextAt(ctx, n, -br.x, -br.y, true)
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  return off
}

function drawShapeAt(ctx, sh, dx, dy, fillMode) {
  const copy = { ...sh, x: sh.x + dx, y: sh.y + dy }
  drawShape(ctx, copy, fillMode)
}

function drawTextAt(ctx, n, dx, dy, hole) {
  ctx.save()
  ctx.font = `${n.bold ? '700' : '400'} ${n.fontSize}px ${n.fontFamily}, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (n.shadow && !hole) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = n.fontSize * 0.12
    ctx.shadowOffsetY = n.fontSize * 0.05
  }
  ctx.fillStyle = hole ? '#000' : n.color
  ctx.fillText(n.content, n.x + dx, n.y + dy)
  ctx.restore()
}

function rgbCss(c) { return `rgb(${c[0]}, ${c[1]}, ${c[2]})` }

// 纸纹理（轻量实现：颗粒 + 纤维，400×400 可平铺）
const texCache = {}
export function getTexture(type) {
  if (type === 'none' || !type) return null
  if (texCache[type]) return texCache[type]
  const cv = document.createElement('canvas')
  cv.width = 400; cv.height = 400
  const ctx = cv.getContext('2d')
  const grain = (base, amp, alpha) => {
    const im = ctx.createImageData(400, 400)
    const d = im.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amp
      d[i] = base + n; d[i + 1] = base + n; d[i + 2] = base + n; d[i + 3] = alpha
    }
    ctx.putImageData(im, 0, 0)
  }
  if (type === 'paper-watercolor') { grain(128, 18, 12) }
  else if (type === 'paper-kraft') {
    const im = ctx.createImageData(400, 400); const d = im.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 22
      d[i] = 155 + n; d[i + 1] = 135 + n; d[i + 2] = 105 + n; d[i + 3] = 14
    }
    ctx.putImageData(im, 0, 0)
  } else if (type === 'paper-rice') { grain(128, 10, 8) }
  else if (type === 'paper-card') { grain(128, 8, 6) }
  texCache[type] = cv
  return cv
}

// ── 整场景渲染 ───────────────────────────────────────────────────────

/** 把整个场景画到指定 ctx（已按 view.scale 变换），用于预览与导出共用 */
export function renderScene(ctx, s, viewScale) {
  const box = canvasBox(s)
  ctx.save()
  ctx.scale(viewScale, viewScale)
  ctx.translate(-box.ox, -box.oy)

  // 画布底：先铺白，避免透明区
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(box.ox, box.oy, box.w, box.h)

  renderPhoto(ctx, s)

  if (s.showBlock) {
    const br = blockRectCanvas(s)
    const comp = blockCompositeCanvas(s, br)
    ctx.drawImage(comp, br.x, br.y)
  }

  // 块外装饰保持彩色（块内的已成洞，跳过）
  const br = blockRectCanvas(s)
  for (const sh of s.shapes) {
    if (s.shapeCutout && pointInRect(sh.x, sh.y, br)) continue
    drawShape(ctx, sh, 'normal', s.shapeFillStyle)
  }
  for (const n of s.textNodes) {
    if (s.textCutout && pointInRect(n.x, n.y, br)) continue
    drawTextAt(ctx, n, 0, 0, false)
  }
  ctx.restore()
}

/** 色块离屏合成（供渲染/导出复用）；br 为画布空间矩形 */
function blockCompositeCanvas(s, br) {
  // 合成在"块自身局部空间"进行，输出 br.w×br.h
  return renderBlockComposite(s, br)
}

// ── 命中检测 ─────────────────────────────────────────────────────────

export function hitShape(s, x, y) {
  for (let i = s.shapes.length - 1; i >= 0; i--) {
    const sh = s.shapes[i]
    const r = sh.size / 2 + 6
    if ((x - sh.x) ** 2 + (y - sh.y) ** 2 <= r * r) return sh
  }
  return null
}

export function hitText(s, x, y, measure) {
  for (let i = s.textNodes.length - 1; i >= 0; i--) {
    const n = s.textNodes[i]
    const m = measure(n)
    if (x >= n.x - m.w / 2 && x <= n.x + m.w / 2 && y >= n.y - m.h / 2 && y <= n.y + m.h / 2) return n
  }
  return null
}

/** 色块命中：返回 handle 方位或 move/null（画布空间坐标） */
export function hitBlock(s, x, y, handleSize = 26) {
  if (!s.showBlock) return null
  const br = blockRectCanvas(s)
  const corners = {
    nw: [br.x, br.y], ne: [br.x + br.w, br.y],
    sw: [br.x, br.y + br.h], se: [br.x + br.w, br.y + br.h],
  }
  for (const [k, [hx, hy]] of Object.entries(corners)) {
    if (Math.abs(x - hx) <= handleSize && Math.abs(y - hy) <= handleSize) return k
  }
  if (pointInRect(x, y, br)) return 'move'
  return null
}

// ── 导出 ─────────────────────────────────────────────────────────────

/** 按照片空间原分辨率渲染整场景，返回 canvas */
export function renderForExport(s) {
  const box = canvasBox(s)
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(box.w))
  cv.height = Math.max(1, Math.round(box.h))
  const ctx = cv.getContext('2d')
  renderScene(ctx, s, 1)
  return cv
}

export async function exportPNG(s) {
  const cv = renderForExport(s)
  const blob = await new Promise(res => cv.toBlob(res, 'image/png'))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `colorblocking-${Date.now()}.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
