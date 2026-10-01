import { describe, it, expect } from 'vitest'
import {
  pageToScreen, screenToPage, clamp01,
  simplifyPoints, simplifyAdaptive,
  polygonBBox, polygonSignedArea, ensureWinding,
  zoneToOps, opsToZoneShape, opsBBox,
  floodSelectMask, traceContour, maskToPolygon,
  singleShapeClipStyle, pointsToClipPolygon, compoundMaskStyle
} from '../zoneGeometry'

const LAYOUT = { offsetX: 100, offsetY: 50, pw: 2480, ph: 3508, scale: 0.1 }

describe('坐标换算', () => {
  it('pageToScreen 往返可逆', () => {
    const s = pageToScreen(0.25, 0.75, LAYOUT)
    const p = screenToPage(s.x, s.y, LAYOUT)
    expect(p.x).toBeCloseTo(0.25, 6)
    expect(p.y).toBeCloseTo(0.75, 6)
  })

  it('screenToPage 越界裁剪到 [0,1]', () => {
    const p = screenToPage(-999, 99999, LAYOUT)
    expect(p.x).toBe(0)
    expect(p.y).toBe(1)
  })

  it('clamp01 边界值', () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(1.5)).toBe(1)
  })
})

describe('Douglas-Peucker 简化', () => {
  it('直线退化为两端点', () => {
    const line = [[0, 0], [0.1, 0.001], [0.2, 0], [0.3, 0.001], [0.4, 0]]
    const simplified = simplifyPoints(line, 0.01)
    expect(simplified).toEqual([[0, 0], [0.4, 0]])
  })

  it('保留显著拐点', () => {
    const v = [[0, 0], [0.5, 0.5], [1, 0]]
    const simplified = simplifyPoints(v, 0.01)
    expect(simplified.length).toBe(3)
  })

  it('闭环简化不坍缩', () => {
    const square = [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5], [0, 0]]
    const simplified = simplifyPoints(square, 0.001, true)
    expect(simplified.length).toBeGreaterThanOrEqual(4)
  })

  it('simplifyAdaptive 收敛到 maxPoints 以内', () => {
    const circle = []
    for (let i = 0; i < 500; i++) {
      const t = (i / 500) * Math.PI * 2
      circle.push([0.5 + 0.4 * Math.cos(t), 0.5 + 0.4 * Math.sin(t)])
    }
    const simplified = simplifyAdaptive(circle, 40)
    expect(simplified.length).toBeLessThanOrEqual(40)
    expect(simplified.length).toBeGreaterThanOrEqual(3)
  })
})

describe('多边形几何', () => {
  it('polygonBBox 计算外接框', () => {
    const bbox = polygonBBox([[0.1, 0.2], [0.5, 0.8], [0.3, 0.4]])
    expect(bbox.x).toBeCloseTo(0.1)
    expect(bbox.y).toBeCloseTo(0.2)
    expect(bbox.width).toBeCloseTo(0.4)
    expect(bbox.height).toBeCloseTo(0.6)
  })

  it('ensureWinding 统一绕向', () => {
    const cw = [[0, 0], [0, 1], [1, 1], [1, 0]] // 屏幕系顺时针（面积<0）
    const forced = ensureWinding(cw, true)
    expect(polygonSignedArea(forced)).toBeLessThan(0)
    const flipped = ensureWinding(cw, false)
    expect(polygonSignedArea(flipped)).toBeGreaterThan(0)
  })
})

describe('区域 ↔ 形状 op', () => {
  it('旧数据（无 shape）回退 RECT op', () => {
    const ops = zoneToOps({ x: 0.1, y: 0.2, width: 0.3, height: 0.4, rotation: 0 })
    expect(ops).toEqual([{ op: 'add', shape: 'rect', x: 0.1, y: 0.2, w: 0.3, h: 0.4, angle: 0 }])
    expect(opsToZoneShape(ops)).toBe('RECT')
  })

  it('ELLIPSE 复用 bbox 列', () => {
    const ops = zoneToOps({ shape: 'ELLIPSE', x: 0.1, y: 0.1, width: 0.2, height: 0.3, rotation: 45 })
    expect(ops[0].shape).toBe('ellipse')
    expect(ops[0].angle).toBe(45)
    expect(opsToZoneShape(ops)).toBe('ELLIPSE')
  })

  it('POLYGON 解析 shapesJson', () => {
    const points = [[0, 0], [0.5, 0], [0.5, 0.5]]
    const zone = { shape: 'POLYGON', shapesJson: JSON.stringify([{ op: 'add', shape: 'polygon', points }]) }
    const ops = zoneToOps(zone)
    expect(ops[0].shape).toBe('polygon')
    expect(ops[0].points).toEqual(points)
  })

  it('损坏的 shapesJson 回退 bbox 矩形', () => {
    const ops = zoneToOps({ shape: 'POLYGON', shapesJson: '{not json', x: 0.1, y: 0.1, width: 0.2, height: 0.2 })
    expect(ops[0].shape).toBe('rect')
  })

  it('COMPOUND bbox 为 add 形状并集（忽略 subtract）', () => {
    const ops = [
      { op: 'add', shape: 'rect', x: 0.1, y: 0.1, w: 0.3, h: 0.3, angle: 0 },
      { op: 'subtract', shape: 'rect', x: 0.5, y: 0.5, w: 0.4, h: 0.4, angle: 0 },
      { op: 'add', shape: 'rect', x: 0.2, y: 0.2, w: 0.2, h: 0.2, angle: 0 }
    ]
    const bbox = opsBBox(ops)
    expect(bbox.x).toBeCloseTo(0.1)
    expect(bbox.y).toBeCloseTo(0.1)
    expect(bbox.width).toBeCloseTo(0.3)
    expect(bbox.height).toBeCloseTo(0.3)
    expect(opsToZoneShape(ops)).toBe('COMPOUND')
  })
})

describe('魔棒：泛洪 + 轮廓', () => {
  // 构造 10×10 白底图，中央 4×4 红色方块
  function makeImageData() {
    const w = 10
    const h = 10
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const red = x >= 3 && x <= 6 && y >= 3 && y <= 6
        data[i] = red ? 220 : 255
        data[i + 1] = red ? 30 : 255
        data[i + 2] = red ? 30 : 255
        data[i + 3] = 255
      }
    }
    return { data, width: w, height: h }
  }

  it('floodSelectMask 只选中同色连通区域', () => {
    const img = makeImageData()
    const mask = floodSelectMask(img, 10, 10, 4, 4, 20)
    let count = 0
    for (let i = 0; i < mask.length; i++) count += mask[i]
    expect(count).toBe(16) // 4×4 红块
    expect(mask[0]).toBe(0) // 左上角白色未选中
    expect(mask[4 * 10 + 4]).toBe(1)
  })

  it('traceContour 沿方块边界输出顶点', () => {
    const img = makeImageData()
    const mask = floodSelectMask(img, 10, 10, 4, 4, 20)
    const contour = traceContour(mask, 10, 10)
    expect(contour.length).toBeGreaterThanOrEqual(4)
    // 轮廓顶点都位于红块边界行列
    contour.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(3)
      expect(x).toBeLessThanOrEqual(6)
      expect(y).toBeGreaterThanOrEqual(3)
      expect(y).toBeLessThanOrEqual(6)
    })
  })

  it('maskToPolygon 空掩码返回 null', () => {
    const blank = { data: new Uint8ClampedArray(100 * 4), width: 10, height: 10 }
    const mask = floodSelectMask(blank, 10, 10, 0, 0, 20)
    // 全同色 → mask 全 1，不会是 null；改测孤立点
    const img = makeImageData()
    const tiny = traceContour(new Uint8Array(100), 10, 10)
    expect(tiny).toEqual([])
    expect(floodSelectMask(img, 10, 10, -1, -1, 20)).toBeNull()
    expect(maskToPolygon(tiny, 10, 10)).toBeNull()
  })
})

describe('下游 CSS 呈现', () => {
  it('RECT 无需裁剪', () => {
    expect(singleShapeClipStyle({ shape: 'RECT', x: 0, y: 0, width: 0.5, height: 0.5 })).toBeNull()
  })

  it('ELLIPSE 输出椭圆 clip-path', () => {
    const style = singleShapeClipStyle({ shape: 'ELLIPSE', x: 0.1, y: 0.1, width: 0.2, height: 0.2 })
    expect(style.clipPath).toContain('ellipse(50% 50%')
  })

  it('POLYGON 输出相对自身 bbox 的百分比顶点', () => {
    const points = [[0.1, 0.1], [0.3, 0.1], [0.2, 0.3]]
    const style = singleShapeClipStyle({
      shape: 'POLYGON',
      shapesJson: JSON.stringify([{ op: 'add', shape: 'polygon', points }])
    })
    expect(style.clipPath).toContain('polygon(')
    expect(style.clipPath).toContain('0.000% 0.000%')
    expect(style.clipPath).toContain('100.000% 0.000%')
  })

  it('pointsToClipPolygon 首点映射到原点', () => {
    const str = pointsToClipPolygon([[0.2, 0.2], [0.4, 0.2], [0.4, 0.4]])
    expect(str).toContain('0.000% 0.000%')
  })

  it('纯矩形并集的 COMPOUND 不生成蒙版', () => {
    const style = compoundMaskStyle({
      shape: 'COMPOUND',
      shapesJson: JSON.stringify([
        { op: 'add', shape: 'rect', x: 0.1, y: 0.1, w: 0.3, h: 0.3, angle: 0 },
        { op: 'add', shape: 'rect', x: 0.2, y: 0.2, w: 0.2, h: 0.2, angle: 0 }
      ])
    })
    expect(style).toBeNull()
  })

  it('含 subtract 的 COMPOUND 生成 SVG 蒙版 data-URI', () => {
    const style = compoundMaskStyle({
      shape: 'COMPOUND',
      shapesJson: JSON.stringify([
        { op: 'add', shape: 'rect', x: 0.1, y: 0.1, w: 0.3, h: 0.3, angle: 0 },
        { op: 'subtract', shape: 'rect', x: 0.15, y: 0.15, w: 0.1, h: 0.1, angle: 0 }
      ])
    })
    expect(style).toBeTruthy()
    expect(style.maskImage).toContain('data:image/svg+xml')
    const svg = decodeURIComponent(style.maskImage.match(/data:image\/svg\+xml,(.+)"\)/)[1])
    expect(svg).toContain('<mask')
    expect(svg).toContain('fill="#fff"')
    expect(svg).toContain('fill="#000"')
  })
})
