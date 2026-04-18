import { App, Modal, Spin, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchDatasourceTableStructure } from '../../api/datasourceApi'

export type DatasourceStructureModalProps = {
  open: boolean
  /** 逻辑表名，对应路径 `.../table/{table}/structure` */
  tableName: string | null
  titleLabel: string
  onClose: () => void
}

function structureToTableParts(raw: unknown): {
  columns: ColumnsType<Record<string, unknown>>
  dataSource: Record<string, unknown>[]
} | null {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    if (raw.length === 0) return { columns: [], dataSource: [] }
    const first = raw[0]
    if (first != null && typeof first === 'object' && !Array.isArray(first)) {
      const rows = raw as Record<string, unknown>[]
      const keys = Object.keys(first)
      const columns = keys.map((k) => ({
        title: k,
        dataIndex: k,
        key: k,
        ellipsis: true,
        render: (v: unknown) => (v == null ? '' : String(v)),
      }))
      return { columns, dataSource: rows }
    }
    return null
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const cols = o.columns ?? o.fields ?? o.columnList ?? o.structure
    if (Array.isArray(cols) && cols.length > 0) {
      const rows = cols.map((c, i) => {
        if (c != null && typeof c === 'object' && !Array.isArray(c)) {
          return { ...(c as Record<string, unknown>), _idx: i }
        }
        return { _idx: i, value: String(c) }
      })
      const keys = Object.keys(rows[0]!).filter((k) => k !== '_idx')
      const columns = keys.map((k) => ({
        title: k,
        dataIndex: k,
        key: k,
        ellipsis: true,
        render: (v: unknown) => (v == null ? '' : String(v)),
      }))
      return { columns, dataSource: rows }
    }
  }
  return null
}

export function DatasourceStructureModal({
  open,
  tableName,
  titleLabel,
  onClose,
}: DatasourceStructureModalProps) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [payload, setPayload] = useState<unknown>(null)

  const load = useCallback(async () => {
    if (!open || !tableName) return
    setLoading(true)
    try {
      const data = await fetchDatasourceTableStructure(tableName)
      setPayload(data)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败')
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [message, open, tableName])

  useEffect(() => {
    if (open && tableName) void load()
  }, [load, open, tableName])

  const tableParts = useMemo(() => structureToTableParts(payload), [payload])

  return (
    <Modal
      title={`表结构 · ${titleLabel}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        使用逻辑表名请求表结构（与「同步」按钮解析表名的规则一致）。返回若为表格可解析的列数组则展示为表，否则展示原始 JSON。
      </Typography.Paragraph>
      <Spin spinning={loading}>
        {tableParts && tableParts.columns.length > 0 ? (
          <Table<Record<string, unknown>>
            size="small"
            bordered
            pagination={false}
            scroll={{ x: 'max-content', y: 400 }}
            columns={tableParts.columns}
            dataSource={tableParts.dataSource}
            rowKey={(_, i) => `st-${String(i)}`}
          />
        ) : (
          <pre
            style={{
              margin: 0,
              maxHeight: 420,
              overflow: 'auto',
              fontSize: 12,
              background: 'var(--ant-color-fill-quaternary)',
              padding: 12,
              borderRadius: 8,
            }}
          >
            {payload == null && !loading ? '无数据' : JSON.stringify(payload, null, 2)}
          </pre>
        )}
      </Spin>
    </Modal>
  )
}
