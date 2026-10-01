import { ref } from 'vue'
import { saveProjectPage } from '@/api/project'
import { uploadFile } from '@/api/export'
import { ElMessage, ElMessageBox } from 'element-plus'

export function useEditorUI() {
  const selectedObjectInfo = ref(null)
  const contextMenu = ref({ visible: false, x: 0, y: 0 })
  const layerItems = ref([])
  const autoSaveStatus = ref('')
  const saving = ref(false)
  const submitting = ref(false)
  const activePanel = ref('photo')
  const propCollapseActive = ref(['basic'])

  let isDirty = false
  let autoSaveTimer = null
  let autoSaveRetryCount = 0
  const autoSaveMaxRetry = 3

  let _canvasGetter = () => null
  let _getTemplateBackground = () => null
  let _saveCurrentPageFn = null
  let _collectPageDataFn = null
  let _getProjectId = () => null
  let _getCurrentPageNumber = () => 1
  let _getProjectPagesMap = () => ({})
  let _onAfterAction = null
  let _onRenderPage = null
  let _getThumbnailFileFn = null

  function setCanvasGetter(fn) { _canvasGetter = fn }
  function setTemplateBackgroundGetter(fn) { _getTemplateBackground = fn }
  function setSaveCurrentPageFn(fn) { _saveCurrentPageFn = fn }
  function setCollectPageDataFn(fn) { _collectPageDataFn = fn }
  function setProjectIdGetter(fn) { _getProjectId = fn }
  function setCurrentPageNumberGetter(fn) { _getCurrentPageNumber = fn }
  function setProjectPagesMapGetter(fn) { _getProjectPagesMap = fn }
  function setAfterAction(fn) { _onAfterAction = fn }
  function setRenderPageFn(fn) { _onRenderPage = fn }
  function setThumbnailGetter(fn) { _getThumbnailFileFn = fn }

  function markDirty() {
    isDirty = true
  }

  function clearDirty() {
    isDirty = false
  }

  function getIsDirty() {
    return isDirty
  }

  function updateLayerList() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const templateBackground = _getTemplateBackground()
    const objs = canvas.getObjects()
    const active = canvas.getActiveObject()
    const items = []
    objs.forEach((obj) => {
      if (obj === templateBackground) return
      if (obj._layerType === 'zoneBorder') return
      let icon = '🖼'
      let name = '对象'
      if (obj._layerType === 'photo' || (obj._zoneId && obj.type === 'image' && !obj.isSticker)) {
        icon = '🖼'
        name = '照片'
      } else if (obj._layerType === 'text' || obj._layerType === 'userText' || (obj.type === 'textbox')) {
        icon = '📝'
        name = obj.text ? (obj.text.substring(0, 10) + (obj.text.length > 10 ? '...' : '')) : '文字'
      } else if (obj._layerType === 'sticker' || obj.isSticker) {
        icon = '⭐'
        name = '贴纸'
      } else if (obj._isZoneRect) {
        icon = '⬜'
        name = '照片区域'
      }
      items.push({
        fabricObj: obj,
        icon,
        name,
        selected: active === obj || (active && active.type === 'activeselection' && active.getObjects().includes(obj)),
        locked: !!obj.lockMovementX
      })
    })
    layerItems.value = items.reverse()
  }

  function selectLayer(item) {
    const canvas = _canvasGetter()
    if (!item.fabricObj || !canvas) return
    canvas.setActiveObject(item.fabricObj)
    canvas.renderAll()
    updateSelectedInfo()
  }

  function toggleLayerLock(item) {
    if (!item.fabricObj) return
    const canvas = _canvasGetter()
    if (!canvas) return
    const locked = !item.locked
    item.fabricObj.set({
      lockMovementX: locked,
      lockMovementY: locked,
      lockRotation: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      selectable: !locked,
      evented: !locked
    })
    canvas.renderAll()
    updateLayerList()
    if (_onAfterAction) _onAfterAction()
  }

  function updateSelectedInfo() {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active || active.type === 'activeselection') {
      selectedObjectInfo.value = null
      return
    }

    const type = active.type === 'textbox' ? '文字' : (active.isSticker ? '贴纸' : ((active._zoneId || active._isFreePhoto) ? '照片' : '对象'))

    if (!selectedObjectInfo.value) {
      selectedObjectInfo.value = {}
    }
    const info = selectedObjectInfo.value
    info.type = type
    info.left = Math.round(active.left)
    info.top = Math.round(active.top)
    info.width = Math.round(active.width * (active.scaleX || 1))
    info.height = Math.round(active.height * (active.scaleY || 1))
    info.angle = Math.round(active.angle || 0)
    info.opacity = Math.round((active.opacity || 1) * 100)
    info.text = active.text || ''
    info.fontSize = active.fontSize || 20
    info.fontFamily = active.fontFamily || 'Microsoft YaHei'
    info.fill = active._baseColor || active.fill || '#333'
    info._fabricObj = active
    // 文字特效状态（属性面板开关回显）
    info.shadow = !!(active._effects && active._effects.shadow)
    info.textCutout = !!(active._effects && active._effects.textCutout)

    if ((type === '照片' || type === '贴纸') && active.filters) {
      const bf = active.filters.find(f => f.type === 'Brightness')
      const cf = active.filters.find(f => f.type === 'Contrast')
      const sf = active.filters.find(f => f.type === 'Saturation')
      info.brightness = bf ? Math.round(bf.brightness * 100) : 0
      info.contrast = cf ? Math.round(cf.contrast * 100) : 0
      info.saturation = sf ? Math.round(sf.saturation * 100) : 0
    } else {
      info.brightness = 0
      info.contrast = 0
      info.saturation = 0
    }
  }

  function updateSelectedProp(prop, value) {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = selectedObjectInfo.value?._fabricObj
    if (!active) return

    switch (prop) {
      case 'left': active.set({ left: value }); selectedObjectInfo.value.left = value; break
      case 'top': active.set({ top: value }); selectedObjectInfo.value.top = value; break
      case 'width': active.set({ scaleX: value / active.width }); selectedObjectInfo.value.width = value; break
      case 'height': active.set({ scaleY: value / active.height }); selectedObjectInfo.value.height = value; break
      case 'angle': active.set({ angle: value }); selectedObjectInfo.value.angle = value; break
      case 'opacity': active.set({ opacity: value / 100 }); selectedObjectInfo.value.opacity = value; break
      case 'text': active.set({ text: value }); selectedObjectInfo.value.text = value; break
      case 'fontSize': active.set({ fontSize: value }); selectedObjectInfo.value.fontSize = value; break
      case 'fontFamily': active.set({ fontFamily: value }); selectedObjectInfo.value.fontFamily = value; break
      case 'fill': active.set({ fill: value }); selectedObjectInfo.value.fill = value; break
    }
    canvas.renderAll()
  }

  function onContextMenu(e, canvasWrapperEl) {
    const canvas = _canvasGetter()
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active) {
      contextMenu.value.visible = false
      return
    }
    const rect = canvasWrapperEl.getBoundingClientRect()
    const menuW = 130
    const menuH = 180
    let x = e.clientX - rect.left
    let y = e.clientY - rect.top
    if (x + menuW > rect.width) x = rect.width - menuW - 4
    if (y + menuH > rect.height) y = rect.height - menuH - 4
    if (x < 0) x = 4
    if (y < 0) y = 4
    contextMenu.value = {
      visible: true,
      x,
      y
    }
  }

  function hideContextMenu() {
    contextMenu.value.visible = false
  }

  function startAutoSave(projectId) {
    autoSaveTimer = setInterval(async () => {
      if (isDirty && !saving.value) {
        autoSaveStatus.value = '自动保存中...'
        try {
          const savedPageNumber = _getCurrentPageNumber()
          if (_saveCurrentPageFn) _saveCurrentPageFn()
          const pageData = _collectPageDataFn ? _collectPageDataFn() : null
          if (!pageData) return
          await saveProjectPage(projectId, {
            pageNumber: savedPageNumber,
            pageData: JSON.stringify(pageData)
          })
          isDirty = false
          autoSaveRetryCount = 0
          autoSaveStatus.value = '已自动保存'
          setTimeout(() => { if (!isDirty) autoSaveStatus.value = '' }, 3000)
        } catch (e) {
          autoSaveRetryCount++
          if (autoSaveRetryCount >= autoSaveMaxRetry) {
            autoSaveStatus.value = '自动保存失败'
            autoSaveRetryCount = 0
          } else {
            autoSaveStatus.value = `保存失败，将重试(${autoSaveRetryCount}/${autoSaveMaxRetry})`
            isDirty = true
          }
          setTimeout(() => { if (isDirty) autoSaveStatus.value = '未保存' }, 5000)
        }
      }
    }, 30000)
  }

  function stopAutoSave() {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer)
      autoSaveTimer = null
    }
  }

  async function switchPageWithSave(newPageNumber, callbacks) {
    if (!callbacks || !callbacks.loading) return
    callbacks.loading.value = true
    try {
      if (isDirty) {
        autoSaveStatus.value = '正在保存上一页…'
        if (_saveCurrentPageFn) _saveCurrentPageFn()
        const pageData = _collectPageDataFn ? _collectPageDataFn() : null
        if (pageData) {
          const projectId = _getProjectId()
          await saveProjectPage(projectId, {
            pageNumber: _getCurrentPageNumber(),
            pageData: JSON.stringify(pageData)
          })
          isDirty = false
          autoSaveStatus.value = '已保存'
          setTimeout(() => { if (!isDirty) autoSaveStatus.value = '' }, 2000)
        }
      }
      if (callbacks.onSwitchPage) callbacks.onSwitchPage(newPageNumber)
      if (callbacks.onResetTextFormat) callbacks.onResetTextFormat()
      if (callbacks.onClearHistory) callbacks.onClearHistory()
      if (callbacks.onRenderPage) await callbacks.onRenderPage()
    } catch (e) {
      console.error('[Editor] 切页保存失败:', e)
      ElMessage.warning('上一页保存失败，修改可能丢失')
    } finally {
      callbacks.loading.value = false
    }
  }

  async function saveDraftWithUI(projectId) {
    saving.value = true
    const canvas = _canvasGetter()
    if (canvas) canvas.selection = false
    try {
      if (_saveCurrentPageFn) _saveCurrentPageFn()
      const pageData = _collectPageDataFn ? _collectPageDataFn() : null
      if (!pageData) {
        ElMessage.warning('没有可保存的数据')
        saving.value = false
        if (canvas) canvas.selection = true
        return
      }
      await saveProjectPage(projectId, {
        pageNumber: _getCurrentPageNumber(),
        pageData: JSON.stringify(pageData)
      })
      isDirty = false
      autoSaveStatus.value = '已保存'
      setTimeout(() => { if (!isDirty) autoSaveStatus.value = '' }, 2000)
      ElMessage.success('草稿已保存')
    } catch (e) {
      ElMessage.error('保存失败，请重试')
    } finally {
      saving.value = false
      const c = _canvasGetter()
      if (c) c.selection = true
    }
  }

  async function submitProjectWithUI(projectId, submitFn, router) {
    submitting.value = true
    const canvas = _canvasGetter()
    if (canvas) canvas.selection = false
    try {
      if (_saveCurrentPageFn) _saveCurrentPageFn()
      // FR-D7：提交时生成当前页缩略图并上传（失败降级为无缩略图提交，不阻断流程）
      let thumbnailUrl = null
      try {
        if (_getThumbnailFileFn) {
          const file = await _getThumbnailFileFn()
          if (file) {
            const upRes = await uploadFile(file, `photos/previews/${projectId}`)
            thumbnailUrl = upRes.data.data
          }
        }
      } catch (e) {
        console.error('[Editor] 缩略图上传失败，降级无缩略图提交:', e)
      }
      const projectPagesMap = _getProjectPagesMap()
      const allPageNumbers = Object.keys(projectPagesMap.value || {}).map(Number)
      const currentPageNumber = _getCurrentPageNumber()
      for (const pageNum of allPageNumbers) {
        const pageData = projectPagesMap.value[pageNum]
        if (pageData) {
          await saveProjectPage(projectId, {
            pageNumber: pageNum,
            pageData: JSON.stringify(pageData),
            // 仅当前页写入缩略图（单页创意作品即首页；多页相册从哪页提交就用哪页）
            previewUrl: pageNum === currentPageNumber ? thumbnailUrl : undefined
          })
        }
      }
      if (submitFn) await submitFn(projectId)
      isDirty = false
      ElMessage.success('作品已提交！')
      router.push('/profile')
    } catch (e) {
      console.error('[Editor] 提交项目失败:', e)
      ElMessage.error('提交失败，请重试')
    } finally {
      submitting.value = false
      const c = _canvasGetter()
      if (c) c.selection = true
    }
  }

  async function goBackWithConfirm(router) {
    if (isDirty) {
      try {
        await ElMessageBox.confirm(
          '当前页面有未保存的修改，是否保存？',
          '提示',
          {
            confirmButtonText: '保存并返回',
            cancelButtonText: '不保存返回',
            distinguishCancelAndClose: true,
            type: 'warning'
          }
        )
        const projectId = _getProjectId()
        await saveDraftWithUI(projectId)
        router.back()
      } catch (action) {
        if (action === 'cancel') {
          isDirty = false
          router.back()
        }
      }
    } else {
      router.back()
    }
  }

  return {
    selectedObjectInfo,
    contextMenu,
    layerItems,
    autoSaveStatus,
    saving,
    submitting,
    activePanel,
    propCollapseActive,
    isDirty,
    markDirty,
    clearDirty,
    getIsDirty,
    setCanvasGetter,
    setTemplateBackgroundGetter,
    setSaveCurrentPageFn,
    setCollectPageDataFn,
    setProjectIdGetter,
    setCurrentPageNumberGetter,
    setProjectPagesMapGetter,
    setAfterAction,
    setRenderPageFn,
    setThumbnailGetter,
    updateLayerList,
    selectLayer,
    toggleLayerLock,
    updateSelectedInfo,
    updateSelectedProp,
    onContextMenu,
    hideContextMenu,
    startAutoSave,
    stopAutoSave,
    switchPageWithSave,
    saveDraftWithUI,
    submitProjectWithUI,
    goBackWithConfirm
  }
}