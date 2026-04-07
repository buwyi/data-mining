import type { FlatFileColumnDraft, FlatPreviewColumnTitle } from '../types/datasource'

export type CsvDelimiterKey = 'comma' | 'semicolon'

export type ParseCsvPreviewResult = {
  dataColumnName: FlatFileColumnDraft[]
  dataListTitle: FlatPreviewColumnTitle[]
  dataList: Record<string, string>[]
}

export function inferDataType(value: string | undefined, enableInference: boolean): FlatFileColumnDraft['dataType'] {
  if (!enableInference) return 'text'
  if (value === undefined || value === '' || value.toUpperCase() === 'NULL') return 'text'

  try {
    if (!Number.isNaN(Number(value)) && value.trim() !== '') {
      const asDate = new Date(value)
      if (Number.isNaN(asDate.getTime())) {
        return 'numeric'
      }
      return value.length > 10 ? 'timestamp' : 'numeric'
    }
    const asDate = new Date(value)
    if (Number.isNaN(asDate.getTime())) {
      return 'text'
    }
    return 'date'
  } catch {
    return 'text'
  }
}

function padRow(row: string[], len: number): string[] {
  const next = row.slice(0, len).map((c) => c ?? '')
  while (next.length < len) next.push('')
  return next
}

/**
 * 将 Papa Parse 得到的二维表转为向导所需的列草稿与预览行（与旧版 parseUploadData 语义对齐）。
 */
export function buildPreviewFromMatrix(
  rows: string[][],
  firstRowAsColumnName: boolean,
  enableTypeInference: boolean,
): ParseCsvPreviewResult {
  const nonEmpty = rows.filter((r) => r.some((c) => c !== ''))
  if (nonEmpty.length < 1) {
    throw new Error('数据异常或换行异常，无法解析预览')
  }

  const firstRow = nonEmpty[0].map((c) => (c == null ? '' : String(c)))
  const colCount = firstRow.length
  if (colCount < 1) {
    throw new Error('数据异常或换行异常，无法解析预览')
  }

  const secondSource = nonEmpty.length > 1 ? nonEmpty[1] : firstRow.map(() => '')
  const secondRow = padRow(
    secondSource.map((c) => (c == null ? '' : String(c))),
    colCount,
  )

  const restRows = nonEmpty.slice(1)

  const columnDrafts: FlatFileColumnDraft[] = firstRow.map((cell, i) => {
    const displayName = firstRowAsColumnName ? cell.replace(/\./g, '_') : `field${String(i)}`
    const dataType = inferDataType(secondRow[i], enableTypeInference)
    const key = `index${String(i)}`
    return {
      key,
      oldName: displayName,
      name: displayName.toLowerCase(),
      dataType,
      format: '',
      length: 255,
      scale: 0,
      comment: '',
    }
  })

  const dataListTitle: FlatPreviewColumnTitle[] = columnDrafts.map((c) => ({
    name: c.oldName,
    key: c.key,
  }))

  const dataList: Record<string, string>[] = []
  for (const raw of restRows) {
    const rowData = padRow(
      raw.map((c) => (c == null ? '' : String(c))),
      colCount,
    )
    const rowObj: Record<string, string> = {}
    for (let k = 0; k < columnDrafts.length; k++) {
      rowObj[columnDrafts[k].key] = rowData[k] ?? ''
    }
    dataList.push(rowObj)
  }

  return {
    dataColumnName: columnDrafts,
    dataListTitle,
    dataList,
  }
}
