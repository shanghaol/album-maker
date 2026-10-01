import { describe, it, expect } from 'vitest'
import { normalizeStorageUrl } from '../storage'

describe('normalizeStorageUrl', () => {
  it('保留标准的 /uploads/ 相对路径', () => {
    expect(normalizeStorageUrl('/uploads/photos/1/x.png')).toBe('/uploads/photos/1/x.png')
  })

  it('剥离历史遗留的完整域名前缀', () => {
    expect(normalizeStorageUrl('http://example.com/uploads/photos/1/x.png'))
      .toBe('/uploads/photos/1/x.png')
    expect(normalizeStorageUrl('https://example.com/uploads/stickers/s.png'))
      .toBe('/uploads/stickers/s.png')
  })

  it('非 uploads 路径原样返回', () => {
    expect(normalizeStorageUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA')
    expect(normalizeStorageUrl('/videos/bg.mp4')).toBe('/videos/bg.mp4')
  })

  it('空值返回空字符串', () => {
    expect(normalizeStorageUrl('')).toBe('')
    expect(normalizeStorageUrl(null)).toBe('')
    expect(normalizeStorageUrl(undefined)).toBe('')
  })
})
