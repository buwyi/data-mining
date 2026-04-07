/** 创建 FLAT 数据源时 `columns` 单项（与 api-doc / 旧版 AddFile 一致） */
export type FlatDatasourceColumnPayload = {
  name: string
  dataType: string
  comment: string
  formatter: string
  length: number
  scale: number
}

/** 上传向导中可编辑的列草稿 */
export type FlatFileColumnDraft = {
  key: string
  oldName: string
  name: string
  dataType: 'numeric' | 'text' | 'date' | 'timestamp'
  length: number
  scale: number
  comment: string
  format: string
}

export type FlatPreviewColumnTitle = {
  name: string
  key: string
}
