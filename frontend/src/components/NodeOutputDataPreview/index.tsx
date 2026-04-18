import { Empty, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo } from 'react'
import { collectColumnKeys, extractTabularPreview } from '../../utils/extractTabularPreview'

const { Text } = Typography

function cellRender(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export type NodeOutputDataPreviewProps = {
  data: unknown
}

/** 节点「查看数据」：优先用表格展示接口返回的行数据 */
export function NodeOutputDataPreview({ data }: NodeOutputDataPreviewProps) {
  const model = useMemo(() => extractTabularPreview(data), [data])

  const columnKeys = useMemo(() => {
    if (!model?.rows.length) return []
    return collectColumnKeys(model.rows)
  }, [model])

  const columns: ColumnsType<Record<string, unknown>> = useMemo(
    () =>
      columnKeys.map((k) => ({
        title: k,
        dataIndex: k,
        key: k,
        ellipsis: { showTitle: true },
        render: (v: unknown) => cellRender(v),
      })),
    [columnKeys],
  )

  /** 加载中尚未有 payload，由外层 Spin 表现；勿显示「暂无数据」 */
  if (data === null || data === undefined) {
    return null
  }

  if (model === null) {
    return (
      <pre
        style={{
          maxHeight: 440,
          overflow: 'auto',
          margin: 0,
          fontSize: 12,
          fontFamily: 'monospace',
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    )
  }

  const { rows, totalElements, pageSize, currentPage } = model

  if (rows.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
  }

  const summaryParts: string[] = []
  if (totalElements !== undefined) summaryParts.push(`共 ${totalElements} 条`)
  if (currentPage !== undefined) summaryParts.push(`第 ${currentPage} 页`)
  if (pageSize !== undefined) summaryParts.push(`每页 ${pageSize} 条`)
  summaryParts.push(`本页 ${rows.length} 条`)

  return (
    <>
      <Table<Record<string, unknown>>
        bordered
        size="small"
        rowKey={(_, i) => String(i)}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 'max-content', y: 440 }}
        pagination={false}
      />
      <Text type="secondary" style={{ display: 'block', marginTop: 10, fontSize: 12 }}>
        {summaryParts.join(' · ')}
      </Text>
    </>
  )
}
