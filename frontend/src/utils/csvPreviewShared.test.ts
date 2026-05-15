import { describe, expect, it } from 'vitest'
import { buildPreviewFromMatrix, inferDataType } from './csvPreviewShared'

/** 论文/实验用例：小型商品样例表（两行数据 + 表头） */
export const SAMPLE_PRODUCT_MATRIX: string[][] = [
  ['sku', 'qty', 'price', 'note'],
  ['A001', '12', '19.9', ''],
  ['A002', '3', '8', '促销'],
]

describe('TC-D3 平面文件预览：类型推断', () => {
  it('inferDataType 关闭推断时均为 text', () => {
    expect(inferDataType('123', false)).toBe('text')
  })

  it('inferDataType 纯数字为 numeric', () => {
    expect(inferDataType('42', true)).toBe('numeric')
  })

  it('inferDataType 可解析日期短串为 date', () => {
    expect(inferDataType('2024-01-01', true)).toBe('date')
  })
})

describe('TC-D3 buildPreviewFromMatrix', () => {
  it('首行作列名时生成列草稿与预览行', () => {
    const r = buildPreviewFromMatrix(SAMPLE_PRODUCT_MATRIX, true, true)
    expect(r.dataColumnName.map((c) => c.oldName)).toEqual(['sku', 'qty', 'price', 'note'])
    expect(r.dataList).toHaveLength(2)
    expect(r.dataList[0].index0).toBe('A001')
    expect(r.dataList[1].index3).toBe('促销')
  })

  it('数据为空或无法解析时抛出可读错误', () => {
    expect(() => buildPreviewFromMatrix([[]], true, true)).toThrow(/数据异常/)
  })
})
