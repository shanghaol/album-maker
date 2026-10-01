import { describe, it, expect } from 'vitest'
import { parsePageData, createEmptyPageData } from '../pageData'

describe('parsePageData', () => {
  it('解析合法 JSON', () => {
    const raw = JSON.stringify({
      photoZones: [{ zoneId: 1, imageUrl: '/uploads/a.png' }],
      textZones: [{ zoneId: null, content: 'hi' }],
      userStickers: []
    })
    const parsed = parsePageData(raw)
    expect(parsed.photoZones).toHaveLength(1)
    expect(parsed.textZones[0].content).toBe('hi')
  })

  it('空字符串返回空页面数据', () => {
    expect(parsePageData('')).toEqual(createEmptyPageData())
    expect(parsePageData(null)).toEqual(createEmptyPageData())
  })

  it('非法 JSON 容错返回空页面数据（不抛异常）', () => {
    expect(parsePageData('{broken json')).toEqual(createEmptyPageData())
    expect(parsePageData('undefined')).toEqual(createEmptyPageData())
  })

  it('JSON 为 null 字面量时返回空页面数据', () => {
    expect(parsePageData('null')).toEqual(createEmptyPageData())
  })
})
