/**
 * Colorblocking 编辑器 — 统一撤销/重做栈
 * 快照覆盖全部可编辑字段；图片以 dataUrl 引用（同串不重复深拷贝）。
 */
import { createInitialState } from './state'

const MAX_DEPTH = 50

const SNAPSHOT_KEYS = [
  'imageDataUrl', 'imageType',
  'blockColor', 'shapeColor', 'shapeColors', 'stripeBgColor',
  'blockX', 'blockY', 'blockW', 'blockH', 'blockStyle',
  'stripeDirection', 'stripeDensity', 'blockTexture', 'showBlock',
  'photoOffset', 'photoOffsetBottom', 'photoZoom', 'photoCopyMode',
  'shapes', 'shapeDist', 'shapeFillStyle', 'shapeDensity', 'shapeCount',
  'shapeSizeScale', 'shapeSizeVariance', 'waveRows', 'spreadScale',
  'shapeCutout', 'selectedShapeId',
  'textNodes', 'selectedTextId', 'textFontFamily', 'textFontSize',
  'textColor', 'textShadow', 'textBold', 'textCutout',
  'ratioW', 'ratioH', 'candidateColors',
]

export function createHistory(s) {
  const undoStack = []
  const redoStack = []

  function snapshot() {
    const snap = {}
    for (const k of SNAPSHOT_KEYS) snap[k] = s[k]
    return JSON.stringify(snap)
  }

  function capture() {
    undoStack.push(snapshot())
    if (undoStack.length > MAX_DEPTH) undoStack.shift()
    redoStack.length = 0
  }

  function apply(json) {
    const snap = JSON.parse(json)
    for (const k of SNAPSHOT_KEYS) s[k] = snap[k]
  }

  return {
    capture,
    canUndo() { return undoStack.length > 0 },
    canRedo() { return redoStack.length > 0 },
    undo() {
      if (!undoStack.length) return false
      redoStack.push(snapshot())
      apply(undoStack.pop())
      return true
    },
    redo() {
      if (!redoStack.length) return false
      undoStack.push(snapshot())
      apply(redoStack.pop())
      return true
    },
    clear() {
      undoStack.length = 0
      redoStack.length = 0
    },
  }
}
