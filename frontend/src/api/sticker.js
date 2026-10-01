import request from './request'

export function getStickers(category) {
  return request.get('/stickers', { params: { category } })
}

export function getAdminStickers() {
  return request.get('/admin/stickers')
}

export function addSticker(name, category, file) {
  const formData = new FormData()
  formData.append('name', name)
  formData.append('category', category)
  formData.append('file', file)
  return request.post('/admin/stickers', formData)
}

export function deleteSticker(id) {
  return request.delete(`/admin/stickers/${id}`)
}