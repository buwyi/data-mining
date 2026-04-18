import { App, Modal, Pagination, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchDatasourcePreview } from '../../api/datasourceApi'

export type DatasourcePreviewModalProps = {
  open: boolean
  /** `GET .../preview` 路径上的 tableId */
  tableId: string | null
  titleLabel: string
  onClose: () => void
}

export function DatasourcePreviewModal({ open, tableId, titleLabel, onClose }: DatasourcePreviewModalProps) {
  const { message } = App.useApp()
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (open) {
      setPageNumber(1)
    }
  }, [open, tableId])

  const load = useCallback(async () => {
    if (!open || !tableId) return
    setLoading(true)
    try {
      const p = await fetchDatasourcePreview(tableId, pageNumber, pageSize)
      setRows(p.rows)
      setTotal(p.total)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载预览失败')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [message, open, pageNumber, pageSize, tableId])

  useEffect(() => {
    void load()
  }, [load])

  const columns: ColumnsType<Record<string, unknown>> = useMemo(() => {
    if (rows.length === 0) return []
    return Object.keys(rows[0]).map((k) => ({
      title: k,
      dataIndex: k,
      key: k,
      ellipsis: true,
      render: (v: unknown) => (v == null ? '' : String(v)),
    }))
  }, [rows])

  return (
    <Modal
      title={`数据预览 · ${titleLabel}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnClose
    >
      <Table<Record<string, unknown>>
        size="small"
        bordered
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 'max-content', y: 360 }}
        rowKey={(_, i) => `pv-${String(i)}`}
      />
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Pagination
          size="small"
          current={pageNumber}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          pageSizeOptions={[10, 20, 50, 100]}
          disabled={loading || !tableId}
          showTotal={(t) => `共 ${t} 条`}
          onChange={(p, ps) => {
            setPageNumber(p)
            setPageSize(ps)
          }}
        />
      </div>
    </Modal>
  )
}
