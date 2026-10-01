import request from './request'

export function createExport(projectIds) {
  return request.post('/admin/export', { projectIds })
}

export function getExportStatus(taskId) {
  return request.get(`/admin/export/status/${taskId}`)
}

export function uploadFile(file, subDir) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('subDir', subDir)
  return request.post('/files/upload', formData)
}