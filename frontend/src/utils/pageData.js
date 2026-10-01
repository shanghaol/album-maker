/**
 * pageData JSON 结构（与后端 project_pages.page_data 对应）：
 * {
 *   photoZones:   [{ zoneId, imageUrl, originalUrl, x, y, scaleX, scaleY, rotation }]
 *                   —— x/y/scaleX/scaleY 为相对所属模板区域(zone)的百分比
 *   textZones:    [{ zoneId?, content, fontSize, fontFamily, color, bold, italic, underline, textAlign, x?, y?, width?, height? }]
 *                   —— zoneId 为空的是自由文字，x/y/width/height 为相对整页的百分比
 *                   —— fontSize 以模板页面像素为单位（与缩放/窗口无关）
 *   userStickers: [{ stickerUrl, x, y, width, height, rotation }] —— 相对整页的百分比
 * }
 * 坐标一律 0-1 归一化存储，渲染时按页面实际尺寸换算。
 */

export function createEmptyPageData() {
  return { photoZones: [], textZones: [], userStickers: [] }
}

/**
 * 安全解析 pageData JSON，解析失败或为空时返回空页面数据（不抛异常）。
 */
export function parsePageData(pageDataStr) {
  if (!pageDataStr) return createEmptyPageData()
  try {
    const parsed = JSON.parse(pageDataStr)
    return parsed || createEmptyPageData()
  } catch (e) {
    return createEmptyPageData()
  }
}
