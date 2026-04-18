import { App, Form, InputNumber, Modal, Select, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { shareDatasource } from '../../api/datasourceApi'
import { useAuthStore } from '../../stores/authStore'
import { parseShareableToOptions } from '../../utils/parseShareableList'

export type DatasourceShareModalProps = {
  open: boolean
  dataSourceId: string | null
  titleLabel: string
  onClose: () => void
  onSuccess?: () => void
}

type FormValues = {
  userId: number | null
}

export function DatasourceShareModal({
  open,
  dataSourceId,
  titleLabel,
  onClose,
  onSuccess,
}: DatasourceShareModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const shareable = useAuthStore((s) => s.tokenUser?.shareable)
  const options = useMemo(() => parseShareableToOptions(shareable), [shareable])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ userId: null })
    }
  }, [form, open])

  const handleOk = useCallback(async () => {
    if (!dataSourceId) return
    try {
      const v = await form.validateFields()
      const uid = v.userId
      if (uid == null || !Number.isFinite(uid) || uid <= 0) {
        message.warning('请选择或输入有效的用户 ID')
        return
      }
      setSubmitting(true)
      try {
        await shareDatasource(dataSourceId, [{ userId: uid }])
        message.success('已提交共享')
        onClose()
        onSuccess?.()
      } catch (e) {
        message.error(e instanceof Error ? e.message : '共享失败')
      } finally {
        setSubmitting(false)
      }
    } catch {
      /* validate */
    }
  }, [dataSourceId, form, message, onClose, onSuccess])

  return (
    <Modal
      title={`共享数据源 · ${titleLabel}`}
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      okText="确定共享"
      confirmLoading={submitting}
      destroyOnClose
      width={480}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        选择或输入要共享给对方的用户。对方即可在「共享数据源」中查看该数据源。
      </Typography.Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item
          label="共享给"
          name="userId"
          rules={[{ required: true, message: '请选择或输入用户 ID' }]}
        >
          {options.length > 0 ? (
            <Select
              allowClear
              showSearch
              placeholder="选择用户"
              optionFilterProp="label"
              options={options}
            />
          ) : (
            <InputNumber min={1} step={1} placeholder="输入对方用户编号" style={{ width: '100%' }} />
          )}
        </Form.Item>
      </Form>
    </Modal>
  )
}
