import { ref } from 'vue'

export function useEditorHistory() {
  let undoStack = []
  let redoStack = []
  const historyMaxSize = 50
  const canUndo = ref(false)
  const canRedo = ref(false)
  let pushTimer = null
  const pushDebounceMs = 150

  function getCanvasFn() {
    return null
  }

  let _canvasGetter = getCanvasFn
  let _onAfterAction = null
  // 撤销/重做恢复后的对象修复钩子（如主色块条纹 Pattern 的 canvas source 无法序列化，需重建）
  let _onRestore = null

  function setCanvasGetter(fn) {
    _canvasGetter = fn
  }

  function setAfterAction(fn) {
    _onAfterAction = fn
  }

  function setRestoreHook(fn) {
    _onRestore = fn
  }

  function pushHistory() {
    if (pushTimer) {
      clearTimeout(pushTimer)
    }
    pushTimer = setTimeout(() => {
      doPushHistory()
      pushTimer = null
    }, pushDebounceMs)
  }

  function flushHistory() {
    if (pushTimer) {
      clearTimeout(pushTimer)
      pushTimer = null
      doPushHistory()
    }
  }

  const HISTORY_PROPS = ['_zoneId', '_isZoneRect', 'isSticker', 'isUserText', '_layerType', '_imageUrl', '_isMainBlock', '_isDecor', '_decorManual', '_blockData', '_decorParams', '_effects', '_baseColor']

  function doPushHistory() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const json = JSON.stringify(canvas.toJSON(HISTORY_PROPS))
    if (undoStack.length > 0 && undoStack[undoStack.length - 1] === json) return

    undoStack.push(json)
    if (undoStack.length > historyMaxSize) {
      undoStack.shift()
    }
    redoStack = []
    updateUndoRedoState()
  }

  function clearHistory() {
    undoStack = []
    redoStack = []
    updateUndoRedoState()
  }

  function updateUndoRedoState() {
    // canUndo = 栈内存在与当前状态不同的快照（即"存在可回退到的变更前状态"）
    const canvas = _canvasGetter()
    if (!canvas) {
      canUndo.value = false
      canRedo.value = false
      return
    }
    let current = null
    try {
      current = JSON.stringify(canvas.toJSON(HISTORY_PROPS))
    } catch (e) {
      return
    }
    let usable = undoStack.length
    while (usable > 0 && undoStack[usable - 1] === current) usable--
    canUndo.value = usable > 0
    canRedo.value = redoStack.length > 0
  }

  function undo() {
    flushHistory()
    const canvas = _canvasGetter()
    if (!canvas) return
    let current = null
    try {
      current = JSON.stringify(canvas.toJSON(HISTORY_PROPS))
    } catch (e) {
      return
    }
    // 语义：撤回到上一次完成变更前。
    // 先丢弃栈顶与当前相同的冗余快照（防抖/重复推送产物），再回退到最近一个不同状态
    while (undoStack.length > 0 && undoStack[undoStack.length - 1] === current) {
      undoStack.pop()
    }
    if (undoStack.length === 0) {
      // 已是最初状态，无可撤销
      updateUndoRedoState()
      return
    }
    const prev = undoStack.pop()
    redoStack.push(current)
    loadCanvasFromJSON(prev)
    updateUndoRedoState()
  }

  function redo() {
    const canvas = _canvasGetter()
    if (!canRedo.value || !canvas) return
    let current = null
    try {
      current = JSON.stringify(canvas.toJSON(HISTORY_PROPS))
    } catch (e) {
      return
    }
    const next = redoStack.pop()
    // 前滚：把撤销前的当前状态压回（与被恢复的 next 不同才压，避免冗余快照）
    if (next !== current) {
      undoStack.push(current)
    }
    loadCanvasFromJSON(next)
    updateUndoRedoState()
  }

  function loadCanvasFromJSON(json) {
    const canvas = _canvasGetter()
    if (!canvas || !json) return
    canvas.loadFromJSON(JSON.parse(json), () => {
      // 主色块条纹 Pattern 的 canvas source 无法经过 JSON 还原，按 _blockData 重建
      if (_onRestore) _onRestore()
      canvas.getObjects().forEach(obj => {
        if (obj._isZoneRect && obj._zoneId) {
          obj.set({ hasControls: false, hasBorders: false, hoverCursor: 'pointer' })
        }
      })
      const imageObjects = canvas.getObjects().filter(obj => obj.type === 'image')
      const pendingImages = imageObjects.filter(obj => !obj.isFullyLoaded())
      function finishLoad() {
        canvas.renderAll()
        if (_onAfterAction) _onAfterAction()
      }
      if (pendingImages.length === 0) {
        finishLoad()
      } else {
        let loadedCount = 0
        pendingImages.forEach(obj => {
          obj.on('loaded', () => {
            loadedCount++
            if (loadedCount >= pendingImages.length) {
              finishLoad()
            }
          })
        })
        canvas.renderAll()
        setTimeout(() => {
          canvas.renderAll()
          if (_onAfterAction && loadedCount < pendingImages.length) _onAfterAction()
        }, 3000)
      }
    })
  }

  return {
    canUndo,
    canRedo,
    setCanvasGetter,
    setAfterAction,
    setRestoreHook,
    pushHistory,
    flushHistory,
    clearHistory,
    updateUndoRedoState,
    undo,
    redo,
    loadCanvasFromJSON
  }
}