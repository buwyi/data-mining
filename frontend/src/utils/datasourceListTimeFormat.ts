import type { AppLocale } from '../i18n/I18nProvider'
import type { AppMessageKey } from '../locales/app/zh-CN'
import type { DatasourceListRow } from '../types/datasource'
import { formatDatasourceTimeHumanReadable } from '../types/datasource'

function parseDatasourceInstant(raw: string): Date | null {
  const t = raw.trim()
  if (t === '') return null
  let d: Date
  if (/^\d{10,}$/.test(t)) {
    const n = Number(t)
    d = new Date(n < 1e12 ? n * 1000 : n)
  } else {
    d = new Date(t)
  }
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

const pad2 = (n: number) => String(n).padStart(2, '0')

type TFn = (key: AppMessageKey, vars?: Record<string, string | number>) => string

/**
 * 数据源列表时间：优先展示「今天 / N天前 / 本月 …」以体现近期导入；其它仍用完整日期时间。
 */
export function formatDatasourceTimeForList(raw: string, t: TFn, locale: AppLocale): string {
  const d = parseDatasourceInstant(raw)
  if (!d) return raw === '' ? '—' : formatDatasourceTimeHumanReadable(raw)

  const now = new Date()
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  const hms = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`

  const diffDays = Math.round((startOfLocalDay(now) - startOfLocalDay(d)) / 86400000)

  if (diffDays === 0) {
    return t('datasourcePage.time.listToday', { hm })
  }
  if (diffDays >= 1 && diffDays <= 6) {
    return t('datasourcePage.time.listDaysAgo', { n: diffDays, hm })
  }
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
    const md =
      locale === 'en'
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : `${d.getMonth() + 1}月${d.getDate()}日`
    return t('datasourcePage.time.listThisMonth', { md, hms })
  }

  return formatDatasourceTimeHumanReadable(raw)
}

/**
 * 演示用：将列表行上的时间字段改写为「本月内」错落时间（需 `VITE_DATASOURCE_DEMO_THIS_MONTH=true`）。
 * 不影响真实接口数据以外的逻辑；仅用于展示「近期导入」效果。
 */
export function applyDatasourceRowsDemoThisMonthTimes(rows: DatasourceListRow[]): DatasourceListRow[] {
  if (import.meta.env.VITE_DATASOURCE_DEMO_THIS_MONTH !== 'true') return rows
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const daysInMonth = new Date(y, m + 1, 0).getDate()

  return rows.map((row, i) => {
    const day = 1 + (i % daysInMonth)
    const hh = 8 + (i % 12)
    const mm = (i * 7 + 11) % 60
    const ss = (i * 13 + 5) % 60
    const inst = new Date(y, m, day, hh, mm, ss)
    const iso = inst.toISOString()
    return {
      ...row,
      createTime: iso,
      updateTime: iso,
      gmtCreate: iso,
      gmtModified: iso,
    }
  })
}
