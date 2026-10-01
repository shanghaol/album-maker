import { ref } from 'vue'
import { fabric } from 'fabric'

export function useEditorActions() {
  const textFormatState = ref({
    bold: false,
    italic: false,
    underline: false,
    textAlign: 'left',
    fontFamily: 'Microsoft YaHei',
    fontSize: 24,
    fill: '#333333'
  })
  const showTextFormatBar = ref(false)

  const fontList = [
    // 系统默认
    { label: '系统默认', value: 'system-ui' },
    { label: '苹果方', value: 'PingFang SC' },
    { label: '微软雅黑', value: 'Microsoft YaHei' },
    // 中文常用
    { label: '宋体', value: 'SimSun' },
    { label: '黑体', value: 'SimHei' },
    { label: '楷体', value: 'KaiTi' },
    { label: '仿宋', value: 'FangSong' },
    { label: '隶书', value: 'LiSu' },
    { label: '幼圆', value: 'YouYuan' },
    // 中文装饰（华文系列）
    { label: '华文行楷', value: 'STXingkai' },
    { label: '华文楷体', value: 'STKaiti' },
    { label: '华文宋体', value: 'STSong' },
    { label: '华文仿宋', value: 'STFangsong' },
    { label: '华文中宋', value: 'STZhongsong' },
    { label: '华文隶书', value: 'STLiti' },
    { label: '华文琥珀', value: 'STHupo' },
    { label: '华文彩云', value: 'STCaiyun' },
    { label: '华文新魏', value: 'STXinwei' },
    { label: '方正舒体', value: 'FZShuTi' },
    // 西文常用
    { label: 'Arial', value: 'Arial' },
    { label: 'Verdana', value: 'Verdana' },
    { label: 'Times New Roman', value: 'Times New Roman' },
    { label: 'Georgia', value: 'Georgia' },
    { label: 'Courier New', value: 'Courier New' },
    { label: 'Impact', value: 'Impact' },
    { label: 'Comic Sans MS', value: 'Comic Sans MS' },
    { label: 'Trebuchet MS', value: 'Trebuchet MS' },
    // 通用风格
    { label: '衬线体', value: 'serif' },
    { label: '手写体', value: 'cursive' },
    { label: '等宽体', value: 'monospace' },
    { label: '艺术体', value: 'fantasy' }
  ]

  let _clipboard = null
  let _copyPending = false

  let _canvasGetter = () => null
  let _getPageOffset = () => ({ pageOffsetX: 0, pageOffsetY: 0 })
  let _getPageScale = () => 1
  let _getPageDimensions = () => ({ pageW: 2480, pageH: 3508 })
  let _getCurrentZones = () => []
  let _onAfterAction = null
  let _removePhotoFromZoneFn = null

  function setCanvasGetter(fn) { _canvasGetter = fn }
  function setPageOffsetGetter(fn) { _getPageOffset = fn }
  function setPageScaleGetter(fn) { _getPageScale = fn }
  function setPageDimensionsGetter(fn) { _getPageDimensions = fn }
  function setCurrentZonesGetter(fn) { _getCurrentZones = fn }
  function setAfterAction(fn) { _onAfterAction = fn }
  function setRemovePhotoFromZone(fn) { _removePhotoFromZoneFn = fn }

  function afterAction() {
    if (_onAfterAction) _onAfterAction()
  }

  function deleteSelected() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) return
    if (active.type === 'activeselection') {
      active.getObjects().forEach(obj => {
        if (obj._zoneId && obj.type === 'image' && !obj.isSticker && _removePhotoFromZoneFn) {
          _removePhotoFromZoneFn(obj._zoneId)
        }
        canvas.remove(obj)
      })
      canvas.discardActiveObject()
    } else {
      if (active._zoneId && active.type === 'image' && !active.isSticker && _removePhotoFromZoneFn) {
        _removePhotoFromZoneFn(active._zoneId)
      }
      canvas.remove(active)
      canvas.discardActiveObject()
    }
    canvas.renderAll()
    afterAction()
  }

  function copySelected() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) {
      _clipboard = null
      _copyPending = false
      return
    }
    _copyPending = true
    active.clone((cloned) => {
      _clipboard = cloned
      _copyPending = false
    })
  }

  function pasteSelected() {
    const canvas = _canvasGetter()
    if (!canvas || !_clipboard || _copyPending) return
    _clipboard.clone((cloned) => {
      cloned.set({
        left: _clipboard.left + 30,
        top: _clipboard.top + 30,
        evented: true
      })
      if (cloned._zoneId) {
        cloned._zoneId = null
        if (cloned.type === 'image' && !cloned.isSticker) {
          cloned.isSticker = true
          cloned._layerType = 'sticker'
        }
      }
      if (cloned.isSticker) {
        cloned.isSticker = true
        cloned._layerType = 'sticker'
      }
      if (cloned.isUserText) {
        cloned.isUserText = true
        cloned._layerType = 'userText'
      }
      canvas.add(cloned)
      canvas.setActiveObject(cloned)
      canvas.renderAll()
      afterAction()
    })
  }

  function bringForward() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) return
    canvas.bringForward(active)
    canvas.renderAll()
    afterAction()
  }

  function sendBackward() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) return
    canvas.sendBackward(active)
    canvas.renderAll()
    afterAction()
  }

  function bringToFront() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) return
    canvas.bringToFront(active)
    canvas.renderAll()
    afterAction()
  }

  function sendToBack() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) return
    canvas.sendToBack(active)
    canvas.renderAll()
    afterAction()
  }

  function alignObjects(direction) {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) return

    const { pageOffsetX, pageOffsetY } = _getPageOffset()
    const pageScale = _getPageScale()
    const { pageW, pageH } = _getPageDimensions()
    const currentZones = _getCurrentZones()

    const objects = active.type === 'activeselection' ? active.getObjects() : [active]
    if (objects.length < 2 && active.type !== 'activeselection') {
      const obj = active
      const objW = (obj.width || 1) * (obj.scaleX || 1)
      const objH = (obj.height || 1) * (obj.scaleY || 1)

      let boundaryLeft = pageOffsetX
      let boundaryTop = pageOffsetY
      let boundaryRight = pageOffsetX + pageW * pageScale
      let boundaryBottom = pageOffsetY + pageH * pageScale

      if (obj._zoneId) {
        const zone = currentZones.find(z => z.id === obj._zoneId)
        if (zone) {
          boundaryLeft = pageOffsetX + zone.x * pageW * pageScale
          boundaryTop = pageOffsetY + zone.y * pageH * pageScale
          boundaryRight = boundaryLeft + zone.width * pageW * pageScale
          boundaryBottom = boundaryTop + zone.height * pageH * pageScale
        }
      }

      const pageCenterX = boundaryLeft + (boundaryRight - boundaryLeft) / 2
      const pageCenterY = boundaryTop + (boundaryBottom - boundaryTop) / 2

      switch (direction) {
        case 'left': obj.set({ left: boundaryLeft }); break
        case 'center': obj.set({ left: pageCenterX - objW / 2 }); break
        case 'right': obj.set({ left: boundaryRight - objW }); break
        case 'top': obj.set({ top: boundaryTop }); break
        case 'middle': obj.set({ top: pageCenterY - objH / 2 }); break
        case 'bottom': obj.set({ top: boundaryBottom - objH }); break
      }
      obj.setCoords()
      canvas.renderAll()
      afterAction()
      return
    }

    let groupLeft = Infinity, groupTop = Infinity
    let groupRight = -Infinity, groupBottom = -Infinity
    let groupCenterX, groupCenterY

    objects.forEach(obj => {
      const l = obj.left
      const t = obj.top
      const w = (obj.width || 1) * (obj.scaleX || 1)
      const h = (obj.height || 1) * (obj.scaleY || 1)
      if (l < groupLeft) groupLeft = l
      if (t < groupTop) groupTop = t
      if (l + w > groupRight) groupRight = l + w
      if (t + h > groupBottom) groupBottom = t + h
    })

    groupCenterX = (groupLeft + groupRight) / 2
    groupCenterY = (groupTop + groupBottom) / 2

    objects.forEach(obj => {
      const objW = (obj.width || 1) * (obj.scaleX || 1)
      const objH = (obj.height || 1) * (obj.scaleY || 1)
      switch (direction) {
        case 'left': obj.set({ left: groupLeft }); break
        case 'center': obj.set({ left: groupCenterX - objW / 2 }); break
        case 'right': obj.set({ left: groupRight - objW }); break
        case 'top': obj.set({ top: groupTop }); break
        case 'middle': obj.set({ top: groupCenterY - objH / 2 }); break
        case 'bottom': obj.set({ top: groupBottom - objH }); break
      }
      obj.setCoords()
    })

    canvas.renderAll()
    afterAction()
  }

  function getActiveTextObject() {
    const canvas = _canvasGetter()
    if (!canvas) return null
    const active = canvas.getActiveObject()
    if (!active) return null
    if (active.type === 'textbox' || active.type === 'text' || active.type === 'i-text') return active
    return null
  }

  function toggleTextBold() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = getActiveTextObject()
    if (!active) return
    const isBold = active.fontWeight === 'bold'
    active.set({ fontWeight: isBold ? 'normal' : 'bold' })
    textFormatState.value.bold = !isBold
    canvas.renderAll()
    afterAction()
  }

  function toggleTextItalic() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = getActiveTextObject()
    if (!active) return
    const isItalic = active.fontStyle === 'italic'
    active.set({ fontStyle: isItalic ? 'normal' : 'italic' })
    textFormatState.value.italic = !isItalic
    canvas.renderAll()
    afterAction()
  }

  function toggleTextUnderline() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = getActiveTextObject()
    if (!active) return
    const hasUnderline = active.underline || false
    active.set({ underline: !hasUnderline })
    textFormatState.value.underline = !hasUnderline
    canvas.renderAll()
    afterAction()
  }

  /** 阴影特效（需求 FR-B4） */
  function toggleTextShadow() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = getActiveTextObject()
    if (!active) return
    const fx = { ...(active._effects || {}) }
    fx.shadow = !fx.shadow
    active._effects = fx
    _applyEffects(active)
    textFormatState.value = { ...textFormatState.value, shadow: fx.shadow }
    canvas.renderAll()
    afterAction()
  }

  /** 文字镂空（挖洞透照片，需求 Q9；依赖 core 的 applyTextEffects） */
  let _applyEffectsFn = null
  function setApplyEffectsFn(fn) { _applyEffectsFn = fn }
  function _applyEffects(obj) {
    if (_applyEffectsFn) _applyEffectsFn(obj)
  }

  function toggleTextCutout() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = getActiveTextObject()
    if (!active) return
    const fx = { ...(active._effects || {}) }
    fx.textCutout = !fx.textCutout
    active._effects = fx
    _applyEffects(active)
    textFormatState.value = { ...textFormatState.value, textCutout: fx.textCutout }
    canvas.renderAll()
    afterAction()
  }

  function setTextAlign(align) {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = getActiveTextObject()
    if (!active) return
    active.set({ textAlign: align })
    textFormatState.value.textAlign = align
    canvas.renderAll()
    afterAction()
  }

  function updateTextFontFamily(val) {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = getActiveTextObject()
    if (!active) return
    active.set({ fontFamily: val })
    textFormatState.value.fontFamily = val
    canvas.renderAll()
    afterAction()
  }

  function updateTextColor(val) {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = getActiveTextObject()
    if (!active) return
    active.set({ fill: val })
    // 镂空文字记录原始色：恢复/关闭镂空时使用，避免把 Pattern 对象存成颜色
    active._baseColor = val
    textFormatState.value.fill = val
    canvas.renderAll()
    afterAction()
  }

  function updateTextFontSize(val) {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = getActiveTextObject()
    if (!active) return
    active.set({ fontSize: val })
    textFormatState.value.fontSize = val
    canvas.renderAll()
    afterAction()
  }

  function updateTextFormatState() {
    const active = getActiveTextObject()
    if (active) {
      showTextFormatBar.value = true
      textFormatState.value = {
        bold: active.fontWeight === 'bold',
        italic: active.fontStyle === 'italic',
        underline: active.underline || false,
        textAlign: active.textAlign || 'left',
        fontFamily: active.fontFamily || 'Microsoft YaHei',
        fontSize: active.fontSize || 24,
        fill: active._baseColor || active.fill || '#333333',
        shadow: !!(active._effects && active._effects.shadow),
        textCutout: !!(active._effects && active._effects.textCutout)
      }
    } else {
      showTextFormatBar.value = false
    }
  }

  function resetTextFormatState() {
    showTextFormatBar.value = false
    textFormatState.value = {
      bold: false, italic: false, underline: false,
      textAlign: 'center', fontFamily: 'Microsoft YaHei',
      fontSize: 20, fill: '#333'
    }
  }

  function updateImageFilter(filterType, value) {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active || active.type !== 'image') return
    if (active._layerType !== 'photo' && active._layerType !== 'freePhoto' && active._layerType !== 'sticker' && !active.isSticker) return

    const img = active
    if (!img.filters) img.filters = []

    let filter
    switch (filterType) {
      case 'brightness':
        filter = img.filters.find(f => f.type === 'Brightness')
        if (!filter) {
          filter = new fabric.Image.filters.Brightness({ brightness: value / 100 })
          img.filters.push(filter)
        } else {
          filter.brightness = value / 100
        }
        break
      case 'contrast':
        filter = img.filters.find(f => f.type === 'Contrast')
        if (!filter) {
          filter = new fabric.Image.filters.Contrast({ contrast: value / 100 })
          img.filters.push(filter)
        } else {
          filter.contrast = value / 100
        }
        break
      case 'saturation':
        filter = img.filters.find(f => f.type === 'Saturation')
        if (!filter) {
          filter = new fabric.Image.filters.Saturation({ saturation: value / 100 })
          img.filters.push(filter)
        } else {
          filter.saturation = value / 100
        }
        break
    }

    img.applyFilters()
    canvas.renderAll()
    afterAction()
  }

  function resetImageFilters() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active || active.type !== 'image' || (active._layerType !== 'photo' && active._layerType !== 'freePhoto')) return

    active.filters = []
    active.applyFilters()
    canvas.renderAll()
    afterAction()
  }

  function handleKeyDown(e, callbacks) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return

    const canvas = _canvasGetter()

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      if (callbacks.undo) callbacks.undo()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault()
      if (callbacks.redo) callbacks.redo()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault()
      copySelected()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault()
      pasteSelected()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault()
      if (!canvas) return
      const objs = canvas.getObjects().filter(o => o.selectable !== false && o.evented !== false)
      if (objs.length) {
        const sel = new fabric.ActiveSelection(objs, { canvas })
        canvas.setActiveObject(sel)
        canvas.renderAll()
        if (callbacks.onSelectionChange) callbacks.onSelectionChange()
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (callbacks.saveDraft) callbacks.saveDraft()
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      deleteSelected()
    } else if (e.key === 'Escape') {
      if (!canvas) return
      canvas.discardActiveObject()
      canvas.renderAll()
      if (callbacks.onSelectionClear) callbacks.onSelectionClear()
    }
  }

  return {
    textFormatState,
    showTextFormatBar,
    fontList,
    setCanvasGetter,
    setPageOffsetGetter,
    setPageScaleGetter,
    setPageDimensionsGetter,
    setCurrentZonesGetter,
    setAfterAction,
    setRemovePhotoFromZone,
    setApplyEffectsFn,
    deleteSelected,
    copySelected,
    pasteSelected,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    alignObjects,
    toggleTextBold,
    toggleTextItalic,
    toggleTextUnderline,
    toggleTextShadow,
    toggleTextCutout,
    setTextAlign,
    updateTextFontFamily,
    updateTextFontSize,
    updateTextColor,
    updateTextFormatState,
    resetTextFormatState,
    getActiveTextObject,
    updateImageFilter,
    resetImageFilters,
    handleKeyDown
  }
}