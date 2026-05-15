import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppMessageKey } from '../locales/app/zh-CN'
import { applyDatasourceRowsDemoThisMonthTimes, formatDatasourceTimeForList } from './datasourceListTimeFormat'

function mockT(key: AppMessageKey, vars?: Record<string, string | number>): string {
  if (key === 'datasourcePage.time.listToday') return `今天 ${String(vars?.hm ?? '')}`
  if (key === 'datasourcePage.time.listDaysAgo') return `${String(vars?.n ?? '')}天前 ${String(vars?.hm ?? '')}`
  if (key === 'datasourcePage.time.listThisMonth')
    return `本月 ${String(vars?.md ?? '')} ${String(vars?.hms ?? '')}`
  return key
}

describe('TC-D1 列表时间展示（相对今天/本月）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('同一天显示「今天」与时刻', () => {
    vi.setSystemTime(new Date('2025-06-15T14:00:00'))
    const raw = '2025-06-15T06:30:00.000Z'
    const out = formatDatasourceTimeForList(raw, mockT, 'zh-CN')
    expect(out).toMatch(/^今天 \d{1,2}:\d{2}$/)
  })

  it('1～6 天内显示「N天前」', () => {
    vi.setSystemTime(new Date('2025-06-15T12:00:00'))
    const raw = '2025-06-10T10:00:00.000Z'
    const out = formatDatasourceTimeForList(raw, mockT, 'zh-CN')
    expect(out).toContain('天前')
  })

  it('非法时间串回退为易读格式或原样', () => {
    vi.setSystemTime(new Date('2025-06-15T12:00:00'))
    const out = formatDatasourceTimeForList('not-a-date', mockT, 'zh-CN')
    expect(out).toBe('not-a-date')
  })
})

describe('演示模式 applyDatasourceRowsDemoThisMonthTimes', () => {
  it('未开启 VITE_DATASOURCE_DEMO_THIS_MONTH 时原样返回', async () => {
    vi.stubEnv('VITE_DATASOURCE_DEMO_THIS_MONTH', '')
    vi.resetModules()
    const { applyDatasourceRowsDemoThisMonthTimes: applyDemo } = await import('./datasourceListTimeFormat')
    const rows = [{ id: 1, createTime: '2020-01-01' }]
    expect(applyDemo(rows)).toEqual(rows)
  })
})
