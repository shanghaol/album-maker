/**
 * Colorblocking 编辑器 — 取色与颜色工具
 * 行为：缩采样图 → RGB 量化分桶 → 按占比取 5 色（去近似色）→ 提饱和度。
 */

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      default: h = ((r - g) / d + 4) / 6
    }
    h *= 360
  }
  return [h, s, l]
}

export function hslToRgb(h, s, l) {
  h /= 360
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r, g, b
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

export function boostSaturation(rgb, amount = 0.1) {
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  return hslToRgb(h, Math.min(1, s + amount), l)
}

export function rgbToCss(c) {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

export function rgbToHex(c) {
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')
}

export function hexToRgb(hex) {
  const m = hex.replace('#', '')
  const v = m.length === 3 ? m.split('').map(x => x + x).join('') : m
  const n = parseInt(v, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

/**
 * 从图片提取 5 主色。缩到 ~72px 采样，RGB 每通道 5 位量化分桶，
 * 占比Top 桶按最小色距 6000 过滤近似色。
 */
export function extractPalette(img, want = 5) {
  const tw = 72
  const th = Math.max(1, Math.round((img.naturalHeight || img.height) * tw / (img.naturalWidth || img.width)))
  const cv = document.createElement('canvas')
  cv.width = tw; cv.height = th
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, tw, th)
  let data
  try {
    data = ctx.getImageData(0, 0, tw, th).data
  } catch (e) {
    return null // 跨域污染等情况
  }
  const buckets = new Map()
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 125) continue
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    const e = buckets.get(key)
    if (e) { e.n++; e.r += r; e.g += g; e.b += b }
    else buckets.set(key, { n: 1, r, g, b })
  }
  const sorted = [...buckets.values()].sort((x, y) => y.n - x.n)
  const picked = []
  for (const e of sorted) {
    const c = [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)]
    if (picked.every(p => dist2(p, c) > 6000)) picked.push(c)
    if (picked.length >= want) break
  }
  return picked.length ? picked.map(c => boostSaturation(c)) : null
}

/** 相对亮度 / 对比度 → 决定 UI 强调色上用黑字还是白字 */
export function relativeLuminance(c) {
  const f = v => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}

export function isLightColor(c) {
  return relativeLuminance(c) > 0.55
}
