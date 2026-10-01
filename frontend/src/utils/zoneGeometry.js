/**
 * 模板区域几何工具（纯函数，便于 vitest 单测）。
 *
 * 坐标系约定：
 * - 页面归一化坐标：x/y ∈ [0,1]，相对 template_pages.width/height。
 * - 形状 op（shapes_json 的元素）：
 *   { op: 'add'|'subtract', shape: 'rect'|'ellipse'|'polygon',
 *     x, y, w, h, angle,        // rect/ellipse：页面归一化外接框
 *     points: [[x,y],...] }     // polygon：页面归一化顶点
 * - 区域记录（template_zones 行）：shape ∈ RECT/ELLIPSE/POLYGON/COMPOUND，
 *   RECT/ELLIPSE 沿用 x/y/width/height/rotation 列；POLYGON/COMPOUND 存 shapes_json，
 *   bbox 列恒为 add 形状的并集外接框（兼容旧消费方）。
 */

export const EPS = 1e-6

// ============ 坐标换算 ============

/** layout = { offsetX, offsetY, pw, ph, scale }（fitScale × 用户缩放），页面归一化 → 画布 px */
export function pageToScreen(nx, ny, layout) {
  return {
    x: layout.offsetX + nx * layout.pw * layout.scale,
    y: layout.offsetY + ny * layout.ph * layout.scale
  }
}

/** 画布 px → 页面归一化，越界裁剪到 [0,1] */
export function screenToPage(sx, sy, layout) {
  return {
    x: clamp01((sx - layout.offsetX) / (layout.pw * layout.scale)),
    y: clamp01((sy - layout.offsetY) / (layout.ph * layout.scale))
  }
}

export function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

// ============ 折线简化（Douglas-Peucker，迭代实现避免深递归） ============

function perpDistance(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (len2 < EPS) {
    return Math.hypot(p[0] - a[0], p[1] - a[1])
  }
  // 点到线段的距离（端点投影越界时取端点距离）
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/**
 * Douglas-Peucker 简化。points: [[x,y],...]（首尾保留）。
 * closed=true 时对首尾相接的闭环按段简化（用于套索闭合轮廓）。
 */
export function simplifyPoints(points, epsilon, closed = false) {
  if (!Array.isArray(points) || points.length <= 3) {
    return (points || []).map(p => [p[0], p[1]])
  }
  if (closed) {
    // 闭环：以周长中点拆成两段分别简化，保证首尾顶点都被评估
    const half = Math.floor(points.length / 2)
    const first = simplifyOpen(points.slice(0, half + 1), epsilon)
    const second = simplifyOpen(points.slice(half).concat([points[0]]), epsilon)
    const merged = first.slice(0, -1).concat(second.slice(0, -1))
    return merged.length >= 3 ? merged : points.map(p => [p[0], p[1]])
  }
  return simplifyOpen(points, epsilon)
}

function simplifyOpen(points, epsilon) {
  if (points.length <= 2) return points.map(p => [p[0], p[1]])
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()
    let maxDist = 0
    let maxIdx = -1
    for (let i = s + 1; i < e; i++) {
      const d = perpDistance(points[i], points[s], points[e])
      if (d > maxDist) {
        maxDist = d
        maxIdx = i
      }
    }
    if (maxDist > epsilon && maxIdx > 0) {
      keep[maxIdx] = 1
      stack.push([s, maxIdx], [maxIdx, e])
    }
  }
  return points.filter((_, i) => keep[i]).map(p => [p[0], p[1]])
}

/** 自适应简化：epsilon 逐步加倍直到顶点数 ≤ maxPoints（用于魔棒轮廓收敛） */
export function simplifyAdaptive(points, maxPoints, startEpsilon = 0.002) {
  let simplified = simplifyPoints(points, startEpsilon, true)
  let epsilon = startEpsilon
  while (simplified.length > maxPoints && epsilon < 0.5) {
    epsilon *= 1.6
    simplified = simplifyPoints(points, epsilon, true)
  }
  return simplified
}

// ============ 多边形 ============

/** 归一化顶点 → 外接框 {x, y, width, height} */
export function polygonBBox(points) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** 有向面积（>0 顶点序为逆时针，标准数学坐标系） */
export function polygonSignedArea(points) {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    area += x1 * y2 - x2 * y1
  }
  return area / 2
}

/** 强制顶点绕向：clockwise=true 时统一为屏幕坐标系下的顺时针（y 向下） */
export function ensureWinding(points, clockwise) {
  const area = polygonSignedArea(points)
  // 屏幕坐标系 y 向下：有向面积 <0 即顺时针
  const isClockwise = area < 0
  if (isClockwise === clockwise) return points.map(p => [p[0], p[1]])
  return points.map(p => [p[0], p[1]]).reverse()
}

// ============ 区域 ↔ 形状 op 列表 ============

/** 区域记录（接口返回的原始字段）→ 统一的形状 op 列表。异常 JSON 回退为 bbox 矩形。 */
export function zoneToOps(zone) {
  const shape = (zone.shape || 'RECT').toUpperCase()
  if (shape === 'POLYGON' || shape === 'COMPOUND') {
    try {
      const ops = JSON.parse(zone.shapesJson || zone.shapes_json || '[]')
      if (Array.isArray(ops) && ops.length) {
        return ops
          .filter(o => o && (o.op === 'add' || o.op === 'subtract'))
          .map(normalizeOp)
      }
    } catch (e) {
      // JSON 损坏：回退 bbox 矩形，保证旧数据/脏数据可渲染
    }
  }
  const op = {
    op: 'add',
    shape: shape === 'ELLIPSE' ? 'ellipse' : 'rect',
    x: zone.x || 0,
    y: zone.y || 0,
    w: zone.width || 0,
    h: zone.height || 0,
    angle: zone.rotation || 0
  }
  return [op]
}

function normalizeOp(o) {
  const out = { op: o.op, shape: o.shape || 'polygon' }
  if (out.shape === 'polygon') {
    out.points = (o.points || []).map(p => [p[0], p[1]])
  } else {
    out.x = o.x || 0
    out.y = o.y || 0
    out.w = o.w || o.width || 0
    out.h = o.h || o.height || 0
    out.angle = o.angle || 0
  }
  return out
}

/** op 列表 → 区域 shape 类型（用于持久化时的 shape 字段判定） */
export function opsToZoneShape(ops) {
  if (ops.length === 0) return 'RECT'
  if (ops.length === 1) {
    const s = ops[0].shape
    return s === 'polygon' ? 'POLYGON' : (s === 'ellipse' ? 'ELLIPSE' : 'RECT')
  }
  return 'COMPOUND'
}

/** op 列表 → add 形状的并集外接框（区域 bbox 列，兼容旧消费方） */
export function opsBBox(ops) {
  const boxes = []
  for (const op of ops) {
    if (op.op !== 'add') continue
    if (op.shape === 'polygon') {
      boxes.push(polygonBBox(op.points))
    } else {
      boxes.push({ x: op.x, y: op.y, width: op.w, height: op.h })
    }
  }
  if (!boxes.length) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of boxes) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }
  return {
    x: clamp01(minX),
    y: clamp01(minY),
    width: Math.min(1, Math.max(0, maxX - minX)),
    height: Math.min(1, Math.max(0, maxY - minY))
  }
}

// ============ 魔棒：泛洪填充 + 轮廓跟踪 ============

/**
 * 扫线泛洪填充：从种子点选出颜色距离 ≤ tolerance*3.44 的连通区域。
 * imageData 为 getImageData 结果；返回 Uint8Array 掩码（1=选中）。
 * 未命中（种子透明等）返回 null。
 */
export function floodSelectMask(imageData, w, h, sx, sy, tolerance) {
  sx = Math.floor(sx)
  sy = Math.floor(sy)
  if (sx < 0 || sx >= w || sy < 0 || sy >= h) return null
  const data = imageData.data
  const seed = (sy * w + sx) * 4
  const sr = data[seed]
  const sg = data[seed + 1]
  const sb = data[seed + 2]
  const sa = data[seed + 3]
  if (sa === 0) return null
  const limit = tolerance * 3.44
  const limit2 = limit * limit
  const visited = new Uint8Array(w * h)
  const mask = new Uint8Array(w * h)

  const match = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false
    const i = y * w + x
    if (visited[i]) return false
    const p = i * 4
    const dr = data[p] - sr
    const dg = data[p + 1] - sg
    const db = data[p + 2] - sb
    return dr * dr + dg * dg + db * db <= limit2
  }

  const stack = [[sx, sy]]
  while (stack.length) {
    let [x, y] = stack.pop()
    if (visited[y * w + x]) continue
    while (x >= 0 && match(x, y)) x-- // 向左找出本段起点
    x++
    let spanUp = false
    let spanDown = false
    while (x < w && match(x, y)) {
      const i = y * w + x
      visited[i] = 1
      mask[i] = 1
      if (y > 0) {
        const up = match(x, y - 1)
        if (up && !spanUp) {
          stack.push([x, y - 1])
          spanUp = true
        } else if (!up) {
          spanUp = false
        }
      }
      if (y < h - 1) {
        const down = match(x, y + 1)
        if (down && !spanDown) {
          stack.push([x, y + 1])
          spanDown = true
        } else if (!down) {
          spanDown = false
        }
      }
      x++
    }
  }
  return mask
}

// Moore 邻域 8 方向（屏幕坐标系，顺时针）：E SE S SW W NW N NE
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]

/**
 * Moore 邻域边界跟踪：提取掩码最大连通区域的外轮廓（忽略内孔）。
 * 返回图像 px 顶点 [[x,y],...]；空掩码返回 []。
 */
export function traceContour(mask, w, h) {
  let start = -1
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      start = i
      break
    }
  }
  if (start < 0) return []
  const sx = start % w
  const sy = (start / w) | 0
  const isSet = (x, y) => x >= 0 && x < w && y >= 0 && y < h && mask[y * w + x] === 1

  const contour = [[sx, sy]]
  // 行主序扫描到的首个像素，其上方与左方必为空，回退方向取 W
  let b = 4
  let cx = sx
  let cy = sy
  let firstMoveDir = -1
  const maxSteps = Math.min(w * h * 4, 4_000_000)
  for (let step = 0; step < maxSteps; step++) {
    let d = -1
    for (let k = 1; k <= 8; k++) {
      const cand = (b + k) % 8
      if (isSet(cx + DIRS[cand][0], cy + DIRS[cand][1])) {
        d = cand
        break
      }
    }
    if (d < 0) break // 孤立点
    if (cx === sx && cy === sy && firstMoveDir >= 0 && d === firstMoveDir) break
    if (firstMoveDir < 0) firstMoveDir = d
    cx += DIRS[d][0]
    cy += DIRS[d][1]
    contour.push([cx, cy])
    b = (d + 4) % 8
  }
  // 收尾：回到起点时最后一点与首点重复
  const last = contour[contour.length - 1]
  if (last && last[0] === sx && last[1] === sy) contour.pop()
  return contour
}

/**
 * 魔棒管线：掩码 → 外轮廓 px 顶点 → 自适应简化闭环多边形。
 * 简化在归一化坐标系进行：调用方先用 toPage 将 px 顶点映射为归一化顶点。
 */
export function maskToPolygon(mask, w, h, { maxPoints = 300 } = {}) {
  const contour = traceContour(mask, w, h)
  if (contour.length < 3) return null
  return simplifyAdaptive(contour, maxPoints)
}

// ============ 下游 CSS 呈现（clip-path / SVG 蒙版） ============

/** 矩形外接框的 4 顶点（顺时针，支持 rotation） */
function rectCorners(op) {
  const cx = op.x + op.w / 2
  const cy = op.y + op.h / 2
  const hw = op.w / 2
  const hh = op.h / 2
  const cos = Math.cos((op.angle || 0) * Math.PI / 180)
  const sin = Math.sin((op.angle || 0) * Math.PI / 180)
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([dx, dy]) => [
    cx + dx * cos - dy * sin,
    cy + dx * sin + dy * cos
  ])
}

/** 椭圆近似多边形（页面归一化顶点，24 段） */
function ellipsePoints(op, segments = 24) {
  const cx = op.x + op.w / 2
  const cy = op.y + op.h / 2
  const rx = op.w / 2
  const ry = op.h / 2
  const rad = (op.angle || 0) * Math.PI / 180
  const pts = []
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2
    const dx = rx * Math.cos(t)
    const dy = ry * Math.sin(t)
    pts.push([cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)])
  }
  return pts
}

/** op → 页面归一化多边形顶点（rect/ellipse 取近似多边形） */
export function opToPolygonPoints(op) {
  if (op.shape === 'polygon') return op.points
  if (op.shape === 'ellipse') return ellipsePoints(op)
  return rectCorners(op)
}

/**
 * 单形状区域 → CSS clip-path（百分比相对区域自身外接框）。矩形返回 null（无需裁剪）。
 * 支持 RECT/ELLIPSE/POLYGON；COMPOUND 请用 compoundMaskStyle。
 */
export function singleShapeClipStyle(zone) {
  const shape = (zone.shape || 'RECT').toUpperCase()
  if (shape === 'ELLIPSE') {
    return { clipPath: 'ellipse(50% 50% at 50% 50%)', WebkitClipPath: 'ellipse(50% 50% at 50% 50%)' }
  }
  if (shape === 'POLYGON') {
    const ops = zoneToOps(zone)
    const pts = ops[0] && ops[0].shape === 'polygon' ? ops[0].points : null
    if (!pts || pts.length < 3) return null
    return { clipPath: pointsToClipPolygon(pts), WebkitClipPath: pointsToClipPolygon(pts) }
  }
  return null
}

/** 页面归一化顶点 → 相对自身 bbox 的 polygon() clip-path 字符串 */
export function pointsToClipPolygon(points) {
  const bbox = polygonBBox(points)
  const bw = bbox.width || 1
  const bh = bbox.height || 1
  const parts = points.map(([x, y]) => {
    const px = ((x - bbox.x) / bw) * 100
    const py = ((y - bbox.y) / bh) * 100
    return `${px.toFixed(3)}% ${py.toFixed(3)}%`
  })
  return `polygon(${parts.join(', ')})`
}

/**
 * 复合区域 → alpha SVG 蒙版 data-URI（白=可见）。
 * 布尔运算在 SVG 内部用 luminance mask 完成：add 形状白色、subtract 形状黑色
 * 后绘覆盖，外层 CSS mask 无需 mask-mode，全现代浏览器兼容。
 * 返回 style 对象；无 subtract 且仅矩形时返回 null（无需蒙版）。
 */
export function compoundMaskStyle(zone) {
  const shape = (zone.shape || 'RECT').toUpperCase()
  if (shape !== 'COMPOUND') return null
  const ops = zoneToOps(zone)
  const hasSubtract = ops.some(o => o.op === 'subtract')
  const onlyRectAdds = ops.every(o => o.op === 'add' && o.shape === 'rect' && !o.angle)
  if (!hasSubtract && onlyRectAdds) return null // 纯矩形并集与 bbox 同形，跳过

  const bbox = opsBBox(ops)
  const W = 1000
  const H = Math.max(1, Math.round(W * (bbox.height || 1) / (bbox.width || 1)))
  const toLocal = ([x, y]) => `${(((x - bbox.x) / (bbox.width || 1)) * W).toFixed(2)},${(((y - bbox.y) / (bbox.height || 1)) * H).toFixed(2)}`

  const shapeEl = (op, fill) => {
    if (op.shape === 'polygon') {
      return `<polygon fill="${fill}" points="${op.points.map(toLocal).join(' ')}"/>`
    }
    if (op.shape === 'ellipse') {
      return `<ellipse fill="${fill}" cx="${((op.x + op.w / 2 - bbox.x) / (bbox.width || 1) * W).toFixed(2)}" cy="${((op.y + op.h / 2 - bbox.y) / (bbox.height || 1) * H).toFixed(2)}" rx="${(op.w / 2 / (bbox.width || 1) * W).toFixed(2)}" ry="${(op.h / 2 / (bbox.height || 1) * H).toFixed(2)}"/>`
    }
    return `<polygon fill="${fill}" points="${rectCorners(op).map(toLocal).join(' ')}"/>`
  }

  const inner = ops.map(o => shapeEl(o, o.op === 'add' ? '#fff' : '#000')).join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">` +
    `<defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="#000"/>${inner}</mask></defs>` +
    `<rect width="${W}" height="${H}" fill="#fff" mask="url(#m)"/></svg>`
  const uri = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  return {
    WebkitMaskImage: uri,
    maskImage: uri,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat'
  }
}
