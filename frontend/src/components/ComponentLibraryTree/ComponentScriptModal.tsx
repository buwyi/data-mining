import { App, Form, Input, Modal } from 'antd'
import { useEffect, useState } from 'react'
import { fetchComponentDefinition, updateComponentDefinition } from '../../api/componentApi'
import { useI18n } from '../../i18n/I18nProvider'
import type { ComponentDefinitionDto } from '../../types/component'

export type ComponentScriptModalProps = {
  open: boolean
  componentId: number | null
  onClose: () => void
  onSaved?: () => void
}

export function ComponentScriptModal({ open, componentId, onClose, onSaved }: ComponentScriptModalProps) {
  const { t } = useI18n()
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
        if (!cancelled) message.error(e instanceof Error ? e.message : t('scriptModal.msg.loadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, componentId, form, message, t])

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
      message.success(t('scriptModal.msg.saved'))
      onSaved?.()
      onClose()
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('scriptModal.msg.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={t('componentsPage.btn.scriptMain')}
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      okText={t('scriptModal.okSave')}
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
        <Form.Item name="main" label={t('scriptModal.fieldLabel')} extra={t('scriptModal.extra')}>
          <Input.TextArea
            rows={16}
            placeholder={t('scriptModal.placeholder')}
            disabled={loading || componentId == null}
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
