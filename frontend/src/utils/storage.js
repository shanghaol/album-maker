/**
 * 将资源 URL 归一化为 /uploads/ 开头的站内相对路径。
 * 后端统一返回相对路径，但历史数据可能携带完整域名前缀；
 * 编辑器与预览端（编辑器画布、H5 SPA 预览）都需要同一套归一化规则。
 */
export function normalizeStorageUrl(url) {
  if (!url) return ''
  const idx = url.indexOf('/uploads/')
  return idx >= 0 ? url.substring(idx) : url
}
