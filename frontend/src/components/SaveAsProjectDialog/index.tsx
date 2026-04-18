import { App, Form, Input, InputNumber, Modal, Spin, Typography } from 'antd'
import type { FormInstance } from 'antd/es/form'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProjectDetail, saveProjectAsCopy, type ProjectDetailDto } from '../../api/projectApi'
import { useProjectStore } from '../../stores/projectStore'
import { readDetailParentId } from '../../utils/projectDetailInspect'

const { Paragraph } = Typography

type SaveAsFormValues = { asName: string; parentId: number | null }

export type SaveAsProjectDialogProps = {
  open: boolean
  sourceProjectId: number | null
  /** 与 `sourceProjectId` 一致时可传入，避免重复 `GET /api/project/{id}` */
  initialDetail?: ProjectDetailDto | null
  onClose: () => void
  /** 另存成功后刷新工程树（例如从树右键打开时） */
  onSuccessRefreshTree?: () => void | Promise<void>
}

function applyFormFromDetail(form: FormInstance<SaveAsFormValues>, d: ProjectDetailDto, id: number) {
  const name = typeof d.name === 'string' ? d.name : `工程${id}`
  form.setFieldsValue({
    asName: `${name} 副本`,
    parentId: readDetailParentId(d),
  })
}

export function SaveAsProjectDialog({
  open,
  sourceProjectId,
  initialDetail,
  onClose,
  onSuccessRefreshTree,
}: SaveAsProjectDialogProps) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm<SaveAsFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadedProjectId = useProjectStore((s) => s.currentProjectId)
  const isRunning = useProjectStore((s) => s.flowData.isRunning)
  const saveCurrentFlow = useProjectStore((s) => s.saveCurrentFlow)

  const loadFormValues = useCallback(
    async (id: number) => {
    if (initialDetail && initialDetail.id === id) {
      setDetailLoading(false)
      applyFormFromDetail(form, initialDetail, id)
      return
    }
      setDetailLoading(true)
      try {
        const d = await fetchProjectDetail(id)
        applyFormFromDetail(form, d, id)
      } catch (e) {
        message.error(e instanceof Error ? e.message : '加载工程信息失败')
        onClose()
      } finally {
        setDetailLoading(false)
      }
    },
    [form, initialDetail, message, onClose],
  )

  useEffect(() => {
    if (!open || sourceProjectId == null) {
      form.resetFields()
      setDetailLoading(false)
      return
    }
    void loadFormValues(sourceProjectId)
  }, [open, sourceProjectId, form, loadFormValues])

  const submit = async () => {
    if (sourceProjectId == null) return
    if (isRunning && sourceProjectId === loadedProjectId) {
      message.warning('该工程正在运行流程，请先停止后再另存')
      return
    }
    try {
      const v = await form.validateFields()
      setSubmitting(true)
      if (sourceProjectId === loadedProjectId) {
        await saveCurrentFlow()
      }
      const parentRaw = v.parentId
      const parentResolved =
        typeof parentRaw === 'number' && Number.isFinite(parentRaw) && parentRaw >= 0 ? parentRaw : 0
      const newId = await saveProjectAsCopy(parentResolved, sourceProjectId, v.asName)
      message.success('已另存为新工程')
      form.resetFields()
      onClose()
      await onSuccessRefreshTree?.()
      if (newId != null && newId > 0) {
        void navigate(`/home/project/${newId}`)
      }
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(e instanceof Error ? e.message : '另存为工程失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="另存为新工程"
      open={open && sourceProjectId != null}
      okText="确定"
      confirmLoading={submitting}
      okButtonProps={{ disabled: detailLoading }}
      onCancel={onClose}
      onOk={() => void submit()}
      destroyOnHidden
    >
      <Spin spinning={detailLoading}>
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          若该工程正作为当前画布工程打开，将先把画布保存到服务端，再调用{' '}
          <Typography.Text code>POST …/saveAs</Typography.Text>
          复制为副本；否则按服务端已落盘内容复制。源工程 id：{sourceProjectId ?? '—'}。
        </Paragraph>
        <Form form={form} layout="vertical">
          <Form.Item name="asName" label="新工程名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input allowClear placeholder="写入 asName 查询参数" disabled={detailLoading} />
          </Form.Item>
          <Form.Item name="parentId" label="父目录 id（0 为根）">
            <InputNumber
              min={0}
              step={1}
              style={{ width: '100%' }}
              placeholder="0"
              disabled={detailLoading}
            />
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  )
}
