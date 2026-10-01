/**
 * Colorblocking 编辑器 — 状态模型与常量
 *
 * 坐标口径（与参考实现行为对齐）：
 *   照片空间原点 = 照片拼贴左上角；色块 (blockX/Y/W/H) 存于照片空间，
 *   可为负（越出照片）；画布 = 照片 ∪ 色块的紧致包围盒。
 *   形状/文字存于画布空间，画布原点移动时做位置补偿（engine 负责）。
 */

/** 9 预设画幅（宽,高） */
export const TEMPLATE_RATIOS = [
  [3, 4], [1, 1], [4, 5], [4, 3], [3, 5], [5, 7], [3, 2], [9, 16], [16, 9],
]

/** 形状清单：solid=实心 / stroke=描边 / text=字符形状 */
export const SHAPE_DEFS = [
  { id: 'circle',     kind: 'solid' },
  { id: 'square',     kind: 'solid' },
  { id: 'star',       kind: 'solid' },
  { id: 'triangle',   kind: 'solid' },
  { id: 'raindrop',   kind: 'solid' },
  { id: 'cloud',      kind: 'solid' },
  { id: 'star4',      kind: 'solid' },
  { id: 'pixelHeart', kind: 'solid' },
  { id: 'umbrella',   kind: 'solid' },
  { id: 'spiral',     kind: 'stroke' },
  { id: 'spinner',    kind: 'stroke' },
  { id: '<3',         kind: 'text' },
  { id: ':3',         kind: 'text' },
  { id: '♪',          kind: 'text' },
]

export const DISTRIBUTIONS = ['scatter', 'beam', 'wave', 'rain', 'grid']

/** 上传后自动搭配的固定组合（形状×填充×分布），随机选一 */
export const AUTO_COMBOS = [
  { shapes: ['circle', 'square', 'triangle'], fill: 'solid',    dist: 'scatter' },
  { shapes: ['star', 'star4'],                fill: 'dots',     dist: 'beam' },
  { shapes: ['circle', 'star', 'square'],     fill: 'halftone', dist: 'rain' },
  { shapes: ['raindrop', 'pixelHeart'],       fill: 'checker',  dist: 'scatter' },
  { shapes: ['square', 'triangle'],           fill: 'hStripe',  dist: 'grid' },
  { shapes: ['circle'],                       fill: 'wave',     dist: 'wave' },
]

/** 装饰填充样式（形状内部图案） */
export const FILL_STYLES = [
  { id: 'solid',     label: '纯色' },
  { id: 'dots',      label: '圆点' },
  { id: 'hollowDots', label: '镂点' },
  { id: 'hStripe',   label: '横纹' },
  { id: 'diagonal',  label: '斜线' },
  { id: 'vStripe',   label: '竖纹' },
  { id: 'checker',   label: '棋盘' },
  { id: 'wave',      label: '波浪' },
  { id: 'halftone',  label: '半调' },
]

/** 上传后的滑块预设表：按 (复制模式×照片方向×分布) 查默认值 */
const PRESET_TABLE = [
  ['none', 'portrait',  'scatter', 85, 22, 75],
  ['none', 'portrait',  'beam',    65, 35, 15],
  ['none', 'portrait',  'wave',    70, 15, 10],
  ['none', 'portrait',  'rain',    55, 30,  5],
  ['none', 'portrait',  'grid',    90, 16,  0],
  ['none', 'landscape', 'scatter', 60, 29, 75],
  ['none', 'landscape', 'beam',    46, 46, 15],
  ['none', 'landscape', 'wave',    49, 20, 10],
  ['none', 'landscape', 'rain',    39, 39,  5],
  ['none', 'landscape', 'grid',    63, 21,  0],
  ['vertical', 'portrait',  'scatter', 102, 33, 75],
  ['vertical', 'portrait',  'beam',     78, 53, 15],
  ['vertical', 'portrait',  'wave',     84, 23, 10],
  ['vertical', 'portrait',  'rain',     66, 45,  5],
  ['vertical', 'portrait',  'grid',    108, 24,  0],
  ['vertical', 'landscape', 'scatter',  72, 43, 75],
  ['vertical', 'landscape', 'beam',     55, 68, 15],
  ['vertical', 'landscape', 'wave',     59, 29, 10],
  ['vertical', 'landscape', 'rain',     46, 59,  5],
  ['vertical', 'landscape', 'grid',     76, 31,  0],
  ['horizontal', 'portrait',  'scatter', 77, 31, 75],
  ['horizontal', 'portrait',  'beam',    59, 49, 15],
  ['horizontal', 'portrait',  'wave',    63, 21, 10],
  ['horizontal', 'portrait',  'rain',    50, 42,  5],
  ['horizontal', 'portrait',  'grid',    81, 22,  0],
  ['horizontal', 'landscape', 'scatter', 54, 40, 75],
  ['horizontal', 'landscape', 'beam',    41, 64, 15],
  ['horizontal', 'landscape', 'wave',    44, 27, 10],
  ['horizontal', 'landscape', 'rain',    35, 55,  5],
  ['horizontal', 'landscape', 'grid',    57, 29,  0],
]

/** 查预设：copy(none/vertical/horizontal) × photo(portrait/landscape) × dist */
export function findPreset(copyMode, imageType, dist) {
  const copy = copyMode || 'none'
  const photo = imageType === 'landscape' ? 'landscape' : 'portrait'
  const d = dist || 'scatter'
  return (
    PRESET_TABLE.find(p => p[0] === copy && p[1] === photo && p[2] === d) ||
    PRESET_TABLE.find(p => p[0] === 'none' && p[1] === 'portrait' && p[2] === 'scatter')
  )
}

/** 取色失败时的回落色板 */
export const FALLBACK_PALETTE = [
  [255, 105, 130], [100, 149, 237], [255, 200, 87],
  [120, 200, 120], [186, 130, 220],
]

export function createInitialState() {
  return {
    activeTab: 'photo',
    image: null,            // HTMLImageElement
    imageDataUrl: null,     // 草稿序列化用
    imageType: 'portrait',  // portrait | landscape
    // 颜色
    candidateColors: [],
    customColors: [],
    blockColor: [255, 105, 130],
    shapeColor: [255, 105, 130],
    shapeColors: [],
    stripeBgColor: [255, 255, 255],
    uiAccent: [255, 105, 130],
    // 色块（照片空间，可负）
    blockX: 0,
    blockY: 402,
    blockW: 810,
    blockH: 358,
    blockStyle: 'solid',
    stripeDirection: 'horizontal',
    stripeDensity: 10,
    blockTexture: 'none',
    showBlock: true,
    // 照片
    photoOffset: null,      // {x,y} 照片显示偏移（照片空间）
    photoZoom: 1,
    isPhotoLocked: false,
    photoCopyMode: 'none',  // none | vertical | horizontal
    // 装饰
    shapes: [],
    selectedShapeId: null,
    shapeDist: 'scatter',
    shapeFillStyle: 'solid',
    shapeDensity: 5,
    shapeCount: 15,
    shapeSizeScale: 1,
    shapeSizeVariance: 0.5,
    tapToPlace: false,
    tapPlaceSize: 1,
    batchMoveEnabled: false,
    shapeCutout: true,
    waveRows: 3,
    spreadScale: 1,
    // 文字
    textNodes: [],
    selectedTextId: null,
    textFontFamily: 'PingFang SC',
    textFontSize: 100,
    textColor: '#FFFFFF',
    textShadow: false,
    textBold: false,
    textCutout: false,
    // 画幅
    ratioW: 3,
    ratioH: 4,
    selectedTemplateId: null,
  }
}

/** 照片基准宽（高按画幅推导） */
export const PHOTO_BASE_W = 1080
/** 色块面积上限 = 照片面积 × 9 */
export const BLOCK_AREA_FACTOR = 9
/** 默认色带：顶部 53% 照片，占余下 47% */
export const DEFAULT_BAND = { topPct: 0.53 }
