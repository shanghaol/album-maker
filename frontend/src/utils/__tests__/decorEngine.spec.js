import { describe, it, expect } from 'vitest'
import {
  generateDistribution, normalizeDecorParams, normalizeBlock,
  isTextInsideBlock, fillStyleToCss, seededRandom,
  pickClosestRatio, CANVAS_RATIOS, refitPhotoRect,
  FILL_STYLES, DISTRIBUTIONS, DEFAULT_PARAMS
} from '../decorEngine'

describe('pickClosestRatio（M2 画幅吸附）', () => {
  it('横图吸附 4:3', () => {
    expect(pickClosestRatio(800, 600).id).toBe('4:3')
  })
  it('竖图吸附 3:4', () => {
    expect(pickClosestRatio(600, 800).id).toBe('3:4')
  })
  it('正方形吸附 1:1', () => {
    expect(pickClosestRatio(1000, 1000).id).toBe('1:1')
  })
  it('手机竖屏吸附 9:16', () => {
    expect(pickClosestRatio(1080, 1920).id).toBe('9:16')
  })
  it('非法输入回落首预设', () => {
    expect(pickClosestRatio(0, 0).id).toBe(CANVAS_RATIOS[0].id)
  })
})

describe('normalizeDecorParams', () => {
  it('非法值回退默认', () => {
    const p = normalizeDecorParams({ fillStyle: 'bad', distribution: 'bad', count: -5, size: 99 })
    expect(p.fillStyle).toBe(DEFAULT_PARAMS.fillStyle)
    expect(p.distribution).toBe(DEFAULT_PARAMS.distribution)
    expect(p.count).toBe(1)
    expect(p.size).toBe(0.5)
  })

  it('空入参返回默认', () => {
    const p = normalizeDecorParams(null)
    expect(p.count).toBe(DEFAULT_PARAMS.count)
    expect(p.shapeCutout).toBe(false)
  })
})

describe('generateDistribution', () => {
  it('同参数生成可复现（确定性随机）', () => {
    const params = { distribution: 'random', count: 30, colors: ['#fff', '#000'], chars: ['♥', '♪'] }
    const a = generateDistribution(params)
    const b = generateDistribution(params)
    expect(a).toEqual(b)
  })

  it('五种分布都生成指定数量且坐标在 0-1', () => {
    for (const distribution of DISTRIBUTIONS) {
      const items = generateDistribution({ distribution, count: 24, waveRows: 3 })
      expect(items.length).toBe(24)
      for (const it of items) {
        expect(it.x).toBeGreaterThanOrEqual(0)
        expect(it.x).toBeLessThanOrEqual(1)
        expect(it.y).toBeGreaterThanOrEqual(0)
        expect(it.y).toBeLessThanOrEqual(1)
      }
    }
  })

  it('多色调色板循环取色', () => {
    const items = generateDistribution({ distribution: 'grid', count: 4, waveRows: 2, colors: ['#a', '#b'] })
    expect(items.map(i => i.color)).toEqual(['#a', '#b', '#a', '#b'])
  })

  it('字符集循环分配', () => {
    const items = generateDistribution({ distribution: 'grid', count: 3, waveRows: 1, chars: ['x', 'y'] })
    expect(items.map(i => i.char)).toEqual(['x', 'y', 'x'])
  })

  it('grid 分布行数正确', () => {
    const items = generateDistribution({ distribution: 'grid', count: 6, waveRows: 2 })
    const ys = [...new Set(items.map(i => i.y.toFixed(3)))]
    expect(ys.length).toBe(2)
  })
})

describe('normalizeBlock', () => {
  it('防极端值：面积超 25× 等比收缩（M1 画布扩展模型，仅钳制离谱值）', () => {
    const b = normalizeBlock({ w: 8, h: 8 }) // 64 > 25
    expect(b.w * b.h).toBeCloseTo(25, 5)
  })

  it('默认几何 = 全宽底部色带（M5）', () => {
    const b = normalizeBlock({})
    expect(b.x).toBe(0)
    expect(b.y).toBeCloseTo(0.53, 5)
    expect(b.w).toBe(1)
    expect(b.h).toBeCloseTo(0.47, 5)
    expect(b.stripeDensity).toBe(10)
    expect(b.shapeCutout).toBe(true)
  })

  it('合法值保持不变', () => {
    const b = normalizeBlock({ w: 0.5, h: 0.5, style: 'stripe', stripeDir: 'v' })
    expect(b.w).toBe(0.5)
    expect(b.style).toBe('stripe')
    expect(b.stripeDir).toBe('v')
  })

  it('非法样式回退', () => {
    const b = normalizeBlock({ style: 'gradient', stripeDir: 'x', stripeDensity: 999 })
    expect(b.style).toBe('solid')
    expect(b.stripeDir).toBe('h')
    expect(b.stripeDensity).toBe(40)
  })
})

describe('isTextInsideBlock', () => {
  const block = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }
  it('中心在块内', () => {
    expect(isTextInsideBlock({ x: 0.35, y: 0.35 }, block)).toBe(true)
  })
  it('中心在块外', () => {
    expect(isTextInsideBlock({ x: 0.9, y: 0.9 }, block)).toBe(false)
  })
  it('空块返回 false', () => {
    expect(isTextInsideBlock({ x: 0.3, y: 0.3 }, null)).toBe(false)
  })
})

describe('fillStyleToCss', () => {
  it('solid 返回纯色', () => {
    expect(fillStyleToCss('solid', ['#ff0000'], 20)).toBe('#ff0000')
  })

  it('每种图案样式返回含 gradient 的 CSS', () => {
    for (const fs of FILL_STYLES.filter(f => f !== 'solid')) {
      const css = fillStyleToCss(fs, ['#000', '#fff'], 20)
      expect(css).toMatch(/gradient/)
    }
  })
})

describe('seededRandom', () => {
  it('同种子序列一致，值域 0-1', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    for (let i = 0; i < 10; i++) {
      const va = a(), vb = b()
      expect(va).toBe(vb)
      expect(va).toBeGreaterThanOrEqual(0)
      expect(va).toBeLessThan(1)
    }
  })
})

describe('refitPhotoRect（切画幅保持照片原始比例）', () => {
  it('4:3 照片在 9:16 画布上保持比例、锚定中心', () => {
    const r = refitPhotoRect({ x: 0, y: 0, w: 1, h: 1, ratio: 4 / 3 }, 1080, 1920)
    // 归一化坐标（w→页宽、h→页高）：像素宽 = w×1080，像素高 = h×1920
    expect((r.w * 1080) / (r.h * 1920)).toBeCloseTo(4 / 3, 5)
    expect(r.w).toBeLessThanOrEqual(1)
    expect(r.h).toBeLessThanOrEqual(1)
    // 中心锚定
    expect(r.x + r.w / 2).toBeCloseTo(0.5, 5)
    expect(r.y + r.h / 2).toBeCloseTo(0.5, 5)
  })
  it('9:16 照片在 4:3 画布上走高度钳制分支仍保持比例', () => {
    const r = refitPhotoRect({ x: 0, y: 0, w: 1, h: 1, ratio: 9 / 16 }, 1920, 1440)
    expect(r.h).toBeCloseTo(1, 5)
    expect((r.w * 1920) / (r.h * 1440)).toBeCloseTo(9 / 16, 5)
    expect(r.x + r.w / 2).toBeCloseTo(0.5, 5)
    expect(r.y + r.h / 2).toBeCloseTo(0.5, 5)
  })
  it('比例已匹配时不变形', () => {
    const r = refitPhotoRect({ x: 0, y: 0, w: 1, h: 1, ratio: 9 / 16 }, 1080, 1920)
    expect(r.w).toBe(1)
    expect(r.h).toBe(1)
  })
  it('无 ratio 时原样返回（存量数据兼容）', () => {
    const e = { x: 0.1, y: 0.2, w: 0.5, h: 0.5 }
    expect(refitPhotoRect(e, 1080, 1920)).toEqual(e)
  })
})
