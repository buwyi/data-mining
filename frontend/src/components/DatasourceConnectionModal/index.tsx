import { App, Descriptions, Empty, Modal, Spin } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { fetchDatasourceConnectionInfo } from '../../api/datasourceApi'

export type DatasourceConnectionModalProps = {
  open: boolean
  tableId: string | null
  titleLabel: string
  onClose: () => void
}

export function DatasourceConnectionModal({
  open,
  tableId,
  titleLabel,
  onClose,
}: DatasourceConnectionModalProps) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!open || !tableId) return
    setLoading(true)
    try {
      const m = await fetchDatasourceConnectionInfo(tableId)
      setEntries(m)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败')
      setEntries({})
    } finally {
      setLoading(false)
    }
  }, [message, open, tableId])

  useEffect(() => {
    void load()
  }, [load])

  const items = Object.entries(entries).map(([k, v]) => ({
    key: k,
    label: k,
    children: v || '—',
  }))

  return (
    <Modal
      title={`连接信息 · ${titleLabel}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {items.length === 0 && !loading ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无连接信息字段" />
        ) : (
          <Descriptions bordered size="small" column={1} items={items} />
        )}
      </Spin>
    </Modal>
  )
}
