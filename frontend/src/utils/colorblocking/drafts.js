/**
 * Colorblocking 编辑器 — 草稿箱（localStorage，最多 5 份，变更自动保存）
 * 键：wc_drafts_index / wc_draft_<id>。刷新后不自动恢复（与参考行为一致）。
 */

const INDEX_KEY = 'wc_drafts_index'
const DRAFT_KEY = id => `wc_draft_${id}`
const MAX_DRAFTS = 5

function readIndex() {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]') } catch { return [] }
}

function writeIndex(idx) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(idx))
}

/** 序列化：与撤销快照同字段集 + 草稿元信息 */
export function serializeDraft(s) {
  return JSON.stringify({
    savedAt: Date.now(),
    state: s, // 由调用方传入快照对象（非字符串）
  })
}

export function listDrafts() {
  return readIndex().sort((a, b) => b.savedAt - a.savedAt)
}

export function saveDraft(s, name = '', thumb = null) {
  const idx = readIndex()
  const id = s.draftId || `d${Date.now().toString(36)}`
  const entry = { id, name: name || s.draftName || `草稿 ${new Date().toLocaleString()}`, savedAt: Date.now(), thumb: thumb || null }
  try {
    localStorage.setItem(DRAFT_KEY(id), serializeDraft(s))
  } catch (e) {
    return null // 存储超限（图片过大）
  }
  const without = idx.filter(e => e.id !== id)
  without.push(entry)
  while (without.length > MAX_DRAFTS) {
    const oldest = without.shift()
    localStorage.removeItem(DRAFT_KEY(oldest.id))
  }
  writeIndex(without)
  return entry
}

/** 静默自动保存：固定复用同一 draftId，不产生多条 */
export function autoSave(s, thumb = null) {
  if (!s.draftId) s.draftId = `d${Date.now().toString(36)}`
  return saveDraft(s, '自动保存', thumb)
}

export function loadDraft(id) {
  const raw = localStorage.getItem(DRAFT_KEY(id))
  if (!raw) return null
  try { return JSON.parse(raw).state } catch { return null }
}

export function deleteDraft(id) {
  localStorage.removeItem(DRAFT_KEY(id))
  writeIndex(readIndex().filter(e => e.id !== id))
}

/** 变更后防抖自动保存（由视图层在每次 capture 后调用），getThumb 返回缩略图 */
export function makeAutoSaver(s, delay = 1500, getThumb = null) {
  let timer = null
  return () => {
    clearTimeout(timer)
    timer = setTimeout(() => autoSave(s, getThumb ? getThumb() : null), delay)
  }
}
