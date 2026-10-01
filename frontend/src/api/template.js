import request from './request'

export function getTemplates(category, type) {
  const params = {}
  if (category) params.category = category
  if (type) params.type = type
  return request.get('/templates', { params })
}

export function getTemplateById(id) {
  return request.get(`/templates/${id}`)
}

export function getTemplatePages(id) {
  return request.get(`/templates/${id}/pages`)
}

export function getTemplateZones(pageId) {
  return request.get(`/templates/pages/${pageId}/zones`)
}

export function createTemplate(data) {
  return request.post('/admin/templates', data)
}

export function createTemplateWithBackground(file, name, description, pageCount, width, height, category) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', name)
  formData.append('description', description || '')
  formData.append('pageCount', String(pageCount))
  formData.append('width', String(width))
  formData.append('height', String(height))
  if (category) formData.append('category', category)
  return request.post('/admin/templates/create', formData)
}

export function createTemplateFromPdf(file, name, description, dpi = 200, category) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', name)
  formData.append('description', description || '')
  formData.append('dpi', String(dpi))
  if (category) formData.append('category', category)
  return request.post('/admin/templates/pdf', formData)
}

export function updateTemplateCategory(id, category) {
  return request.put(`/admin/templates/${id}/category`, null, { params: { category } })
}

export function uploadTemplateCover(id, file) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(`/admin/templates/${id}/cover`, formData)
}

export function uploadPageBackground(id, pageNumber, file, width, height) {
  const formData = new FormData()
  formData.append('file', file)
  const params = new URLSearchParams()
  if (width) params.append('width', String(width))
  if (height) params.append('height', String(height))
  return request.post(`/admin/templates/${id}/pages/${pageNumber}/background?${params.toString()}`, formData)
}

export function publishTemplate(id) {
  return request.put(`/admin/templates/${id}/publish`)
}

export function disableTemplate(id) {
  return request.put(`/admin/templates/${id}/disable`)
}

export function enableTemplate(id) {
  return request.put(`/admin/templates/${id}/enable`)
}

export function deleteTemplate(id) {
  return request.delete(`/admin/templates/${id}`)
}

export function getAdminTemplates() {
  return request.get('/admin/templates')
}

export function saveTemplateZones(pageId, zones) {
  return request.put(`/admin/templates/pages/${pageId}/zones`, zones)
}

// ---- PSD 分层模板（FR-52/53，D13/D15）：图层档案与图层资产 ----
export function saveTemplateLayers(pageId, layersJson) {
  return request.put(`/admin/templates/pages/${pageId}/layers`, layersJson, {
    headers: { 'Content-Type': 'text/plain' }
  })
}

export function uploadLayerImage(pageId, file) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(`/admin/templates/pages/${pageId}/layers/images`, formData)
}