import { App, Form, Input, Modal } from 'antd'
import { useEffect, useState } from 'react'
import { fetchComponentDefinition, updateComponentDefinition } from '../../api/componentApi'
import type { ComponentDefinitionDto } from '../../types/component'

export type ComponentScriptModalProps = {
  open: boolean
  componentId: number | null
  onClose: () => void
  onSaved?: () => void
}

export function ComponentScriptModal({ open, componentId, onClose, onSaved }: ComponentScriptModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<{ main: string }>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [snapshot, setSnapshot] = useState<ComponentDefinitionDto | null>(null)

  useEffect(() => {
    if (!open || componentId == null) {
      setSnapshot(null)
      form.resetFields()
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchComponentDefinition(componentId)
      .then((dto) => {
        if (cancelled) return
        setSnapshot(dto)
        const main =
          dto.script && typeof dto.script === 'object' && typeof dto.script.MAIN === 'string'
            ? dto.script.MAIN
            : ''
        form.setFieldsValue({ main })
      })
      .catch((e: unknown) => {
        if (!cancelled) message.error(e instanceof Error ? e.message : '加载组件失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, componentId, form, message])

  const handleOk = async () => {
    if (componentId == null || !snapshot) return
    const main = form.getFieldValue('main') as string | undefined
    try {
      setSaving(true)
      const next: ComponentDefinitionDto = {
        ...snapshot,
        script: {
          ...(typeof snapshot.script === 'object' && snapshot.script !== null ? snapshot.script : {}),
          MAIN: main ?? '',
        },
      }
      await updateComponentDefinition(componentId, next)
      message.success('脚本已保存')
      onSaved?.()
      onClose()
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="编辑脚本（MAIN）"
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      okText="保存"
      confirmLoading={saving}
      width="min(900px, 94vw)"
      destroyOnHidden
      afterOpenChange={(o) => {
        if (!o) {
          setSnapshot(null)
          form.resetFields()
        }
      }}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Form.Item
          name="main"
          label="script.MAIN"
          extra="保存时将连同当前组件其它字段一并提交（先 GET 再 PUT，与旧版一致）。"
        >
          <Input.TextArea
            rows={16}
            placeholder="组件主脚本内容"
            disabled={loading || componentId == null}
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
