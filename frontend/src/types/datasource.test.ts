import { describe, expect, it } from 'vitest'
import {
  formatDatasourceTimeHumanReadable,
  formatStandardLocalDateTime,
  inferDatasourceOriginKind,
  isLikelyTimeFieldKeyForConnectionInfo,
  pickDatasourceDeleteId,
  pickDatasourceRowLabel,
  pickDatasourceTimeRaw,
} from './datasource'

describe('TC-D1 数据源列表辅助：行标签与时间', () => {
  it('pickDatasourceRowLabel 优先 showName', () => {
    expect(pickDatasourceRowLabel({ showName: '销售明细', tableName: 't_sales' })).toBe('销售明细')
  })

  it('pickDatasourceTimeRaw 按字段优先级取时间串', () => {
    expect(pickDatasourceTimeRaw({ updateTime: '2024-06-01T08:00:00.000Z', createTime: '2024-05-01' })).toBe(
      '2024-05-01',
    )
  })

  it('formatDatasourceTimeHumanReadable 将合法时间串格式化为中文年月日时分秒', () => {
    const s = formatDatasourceTimeHumanReadable('2024-03-15T07:30:45.000Z')
    expect(s).toMatch(/^\d{4}年\d{2}月\d{2}日 \d{2}:\d{2}:\d{2}$/)
  })

  it('formatStandardLocalDateTime 输出 YYYY-MM-DD HH:mm:ss', () => {
    const s = formatStandardLocalDateTime('1700000000000')
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('isLikelyTimeFieldKeyForConnectionInfo 识别时间相关键名', () => {
    expect(isLikelyTimeFieldKeyForConnectionInfo('gmt_create')).toBe(true)
    expect(isLikelyTimeFieldKeyForConnectionInfo('userName')).toBe(false)
  })
})

describe('TC-D1 数据源类型与删除 id 解析', () => {
  it('inferDatasourceOriginKind：含 csv/flat 线索判为 file', () => {
    expect(inferDatasourceOriginKind({ type: 'FLAT', tableName: 'demo.csv' })).toBe('file')
  })

  it('inferDatasourceOriginKind：jdbc/mysql 线索判为 database', () => {
    expect(inferDatasourceOriginKind({ engine: 'mysql', tableName: 'orders' })).toBe('database')
  })

  it('pickDatasourceDeleteId 优先数值型 tableId', () => {
    expect(pickDatasourceDeleteId({ tableId: 42, tableName: 't1' })).toBe('42')
  })
})
