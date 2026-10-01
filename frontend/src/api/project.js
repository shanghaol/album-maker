import request from './request'

export function createProject(data) {
  return request.post('/projects', data)
}

export function getCurrentProject() {
  return request.get('/projects/current')
}

export function getProjects() {
  return request.get('/projects')
}

export function getProjectById(id) {
  return request.get(`/projects/${id}`)
}

export function getProjectPages(id) {
  return request.get(`/projects/${id}/pages`)
}

export function saveProjectPage(id, data) {
  return request.post(`/projects/${id}/pages`, data)
}

export function submitProject(id, data) {
  return request.post(`/projects/${id}/submit`, data)
}

export function abandonProject(id) {
  return request.delete(`/projects/${id}`)
}

// 重新编辑：从已提交作品复制出新草稿（创意单页迭代）
export function copyProject(id) {
  return request.post(`/projects/${id}/copy`)
}

export function getAdminProjects(params) {
  return request.get('/admin/projects', { params })
}

export function getAdminProjectPages(id) {
  return request.get(`/admin/projects/${id}/pages`)
}

export function deleteAdminProject(id) {
  return request.delete(`/admin/projects/${id}`)
}