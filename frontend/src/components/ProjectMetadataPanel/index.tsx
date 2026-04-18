import {
  CopyOutlined,
  EyeOutlined,
  FileAddOutlined,
  HistoryOutlined,
  ReloadOutlined,
  RollbackOutlined,
} from '@ant-design/icons'
import { App, Button, Descriptions, Form, Input, Modal, Space, Spin, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useMemo, useState } from 'react'
import {
  createProjectHistoryVersion,
  deleteProjectVersion,
  fetchProjectVersionDetail,
  recoverProjectVersion,
  saveProjectAsTemplate,
  type ProjectDetailDto,
  type ProjectVersionMeta,
} from '../../api/projectApi'
import { SaveAsProjectDialog } from '../SaveAsProjectDialog'
import { useProjectStore } from '../../stores/projectStore'

const { Text, Paragraph } = Typography

function formatFlowJsonField(jsonField: unknown): string {
  if (jsonField == null) return '（无 json 字段）'
  if (typeof jsonField === 'string') {
    const t = jsonField.trim()
    if (!t) return '（空字符串）'
    try {
      return JSON.stringify(JSON.parse(t), null, 2)
    } catch {
      return jsonField
    }
  }
  try {
    return JSON.stringify(jsonField, null, 2)
  } catch {
    return String(jsonField)
  }
}

type VersionRow = {
  key: string
  meta: ProjectVersionMeta
}

export function ProjectMetadataPanel() {
  const { message, modal } = App.useApp()
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const detail = useProjectStore((s) => s.flowData.currentProjectDetail)
  const isRunning = useProjectStore((s) => s.flowData.isRunning)
  const saveCurrentFlow = useProjectStore((s) => s.saveCurrentFlow)
  const loadProjectFlow = useProjectStore((s) => s.loadProjectFlow)
  const refreshProjectMetadata = useProjectStore((s) => s.refreshProjectMetadata)

  const [refreshing, setRefreshing] = useState(false)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [rowLoadingKey, setRowLoadingKey] = useState<string | null>(null)
  const [tplModalOpen, setTplModalOpen] = useState(false)
  const [tplSaving, setTplSaving] = useState(false)
  const [tplForm] = Form.useForm<{ tags: string }>()
  const [saveAsProjOpen, setSaveAsProjOpen] = useState(false)
  /** 创建历史版本时可选，对应 `PUT …/project/{id}?description=` */
  const [snapshotDescription, setSnapshotDescription] = useState('')
  const [versionView, setVersionView] = useState<{
    open: boolean
    key: string | null
    loading: boolean
    data: ProjectDetailDto | null
  }>({ open: false, key: null, loading: false, data: null })

  const projectId = detail?.id ?? currentProjectId ?? null

  const versionRows: VersionRow[] = useMemo(() => {
    const v = detail?.versions
    if (!v || typeof v !== 'object' || Array.isArray(v)) return []
    return Object.entries(v as Record<string, ProjectVersionMeta>).map(([key, meta]) => ({
      key,
      meta: meta ?? {},
    }))
  }, [detail?.versions])

  const onRefresh = useCallback(async () => {
    if (!projectId) return
    setRefreshing(true)
    try {
      await refreshProjectMetadata()
      message.success('已刷新元数据')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '刷新失败')
    } finally {
      setRefreshing(false)
    }
  }, [message, projectId, refreshProjectMetadata])

  const onCreateSnapshot = useCallback(async () => {
    if (!projectId) return
    if (isRunning) {
      message.warning('流程运行中，请先停止后再创建历史版本')
      return
    }
    setSnapshotLoading(true)
    try {
      await saveCurrentFlow()
      await createProjectHistoryVersion(projectId, {
        description: snapshotDescription.trim() || undefined,
      })
      message.success('已创建历史版本')
      setSnapshotDescription('')
      await refreshProjectMetadata()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      setSnapshotLoading(false)
    }
  }, [isRunning, message, projectId, refreshProjectMetadata, saveCurrentFlow, snapshotDescription])

  const openSaveAsTemplateModal = useCallback(() => {
    if (isRunning) {
      message.warning('流程运行中，请先停止后再另存为模板')
      return
    }
    tplForm.setFieldsValue({ tags: '' })
    setTplModalOpen(true)
  }, [isRunning, message, tplForm])

  const submitSaveAsTemplate = useCallback(async () => {
    if (!projectId) return
    try {
      const { tags } = await tplForm.validateFields()
      setTplSaving(true)
      await saveCurrentFlow()
      await saveProjectAsTemplate(projectId, tags)
      message.success('已另存为模板（可先保存首页模板列表是否出现新项）')
      setTplModalOpen(false)
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(e instanceof Error ? e.message : '另存为模板失败')
    } finally {
      setTplSaving(false)
    }
  }, [message, projectId, saveCurrentFlow, tplForm])

  const openSaveAsProjectModal = useCallback(() => {
    if (!projectId || !detail) return
    if (isRunning) {
      message.warning('流程运行中，请先停止后再另存为工程')
      return
    }
    setSaveAsProjOpen(true)
  }, [detail, isRunning, message, projectId])

  const onRecover = useCallback(
    (versionKey: string) => {
      if (!projectId) return
      if (isRunning) {
        message.warning('流程运行中，无法恢复版本')
        return
      }
      modal.confirm({
        title: '恢复历史版本',
        content:
          '将把当前工程内容替换为该历史版本在服务端保存的快照，未保存到服务端的本地修改将丢失。是否继续？',
        okText: '恢复',
        okType: 'danger',
        onOk: async () => {
          setRowLoadingKey(versionKey)
          try {
            await recoverProjectVersion(projectId, versionKey)
            message.success('已恢复，正在重新加载工程')
            await loadProjectFlow(projectId)
            await refreshProjectMetadata()
          } catch (e) {
            message.error(e instanceof Error ? e.message : '恢复失败')
          } finally {
            setRowLoadingKey(null)
          }
        },
      })
    },
    [isRunning, loadProjectFlow, message, modal, projectId, refreshProjectMetadata],
  )

  const onDeleteVersion = useCallback(
    (versionKey: string) => {
      if (!projectId) return
      modal.confirm({
        title: '删除历史版本',
        content: `确定删除版本「${versionKey}」的记录吗？`,
        okText: '删除',
        okType: 'danger',
        onOk: async () => {
          setRowLoadingKey(versionKey)
          try {
            await deleteProjectVersion(projectId, versionKey)
            message.success('已删除')
            await refreshProjectMetadata()
          } catch (e) {
            message.error(e instanceof Error ? e.message : '删除失败')
          } finally {
            setRowLoadingKey(null)
          }
        },
      })
    },
    [message, modal, projectId, refreshProjectMetadata],
  )

  const closeVersionView = useCallback(() => {
    setVersionView({ open: false, key: null, loading: false, data: null })
  }, [])

  const onViewVersion = useCallback(
    async (versionKey: string) => {
      if (!projectId) return
      setVersionView({ open: true, key: versionKey, loading: true, data: null })
      try {
        const data = await fetchProjectVersionDetail(projectId, versionKey)
        setVersionView((s) => ({ ...s, loading: false, data }))
      } catch (e) {
        message.error(e instanceof Error ? e.message : '加载历史版本失败')
        setVersionView((s) => ({ ...s, loading: false, data: null }))
      }
    },
    [message, projectId],
  )

  const columns: ColumnsType<VersionRow> = useMemo(
    () => [
      {
        title: '版本标识',
        dataIndex: 'key',
        key: 'id',
        ellipsis: true,
        width: '32%',
        render: (_: unknown, row) => (
          <Text code copyable={{ text: row.key }} style={{ fontSize: 11 }}>
            {row.key}
          </Text>
        ),
      },
      {
        title: '创建时间',
        key: 'time',
        width: '28%',
        render: (_: unknown, row) => row.meta.createTime ?? '—',
      },
      {
        title: '说明',
        key: 'desc',
        ellipsis: true,
        render: (_: unknown, row) => row.meta.description ?? '—',
      },
      {
        title: '操作',
        key: 'actions',
        width: 248,
        render: (_: unknown, row) => (
          <Space size="small" wrap>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              loading={versionView.loading && versionView.key === row.key}
              onClick={() => void onViewVersion(row.key)}
            >
              详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              disabled={isRunning}
              loading={rowLoadingKey === row.key}
              onClick={() => onRecover(row.key)}
            >
              恢复
            </Button>
            <Button
              type="link"
              size="small"
              danger
              loading={rowLoadingKey === row.key}
              onClick={() => onDeleteVersion(row.key)}
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [isRunning, onDeleteVersion, onRecover, onViewVersion, rowLoadingKey, versionView.key, versionView.loading],
  )

  if (!projectId || !detail) {
    return (
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        请先在左侧工程树中打开一个工程，以查看描述与历史版本。
      </Paragraph>
    )
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Text strong>{typeof detail.name === 'string' ? detail.name : `工程 #${detail.id}`}</Text>
        <Paragraph type="secondary" style={{ marginBottom: 8, marginTop: 4 }}>
          ID：{detail.id}
          {typeof detail.description === 'string' && detail.description.length > 0
            ? ` · ${detail.description}`
            : ' · 无描述（可在工程树节点右键「修改描述」）'}
        </Paragraph>
        <Space wrap>
          <Button size="small" icon={<ReloadOutlined />} loading={refreshing} onClick={() => void onRefresh()}>
            刷新元数据
          </Button>
          <Input
            size="small"
            allowClear
            placeholder="版本说明（可选）"
            style={{ width: 200, maxWidth: '100%' }}
            value={snapshotDescription}
            disabled={isRunning}
            onChange={(e) => setSnapshotDescription(e.target.value)}
          />
          <Button
            size="small"
            type="primary"
            icon={<HistoryOutlined />}
            loading={snapshotLoading}
            disabled={isRunning}
            onClick={() => void onCreateSnapshot()}
          >
            创建历史版本
          </Button>
          <Button
            size="small"
            icon={<CopyOutlined />}
            disabled={isRunning}
            onClick={openSaveAsProjectModal}
          >
            另存为工程
          </Button>
          <Button
            size="small"
            icon={<FileAddOutlined />}
            disabled={isRunning}
            onClick={openSaveAsTemplateModal}
          >
            另存为模板
          </Button>
        </Space>
        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          「创建历史版本」会先保存当前流程到服务端，再按接口在服务端生成一条历史版本记录（基于磁盘上的工程内容）。
          「另存为工程」会先保存当前流程，再调用{' '}
          <Text code>POST …/saveAs</Text>（父目录 id + 新名称）；「另存为模板」为{' '}
          <Text code>PUT …/saveAsTemplate</Text>。
        </Paragraph>
      </div>

      <SaveAsProjectDialog
        open={saveAsProjOpen}
        sourceProjectId={saveAsProjOpen && projectId != null ? projectId : null}
        initialDetail={saveAsProjOpen ? detail : null}
        onClose={() => setSaveAsProjOpen(false)}
      />

      <Modal
        title={
          versionView.key ? `历史版本详情 · ${versionView.key}` : '历史版本详情'
        }
        open={versionView.open}
        onCancel={closeVersionView}
        footer={null}
        width={880}
        destroyOnHidden
      >
        {versionView.loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="加载版本内容…" />
          </div>
        ) : versionView.data ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="工程 ID">
                {String(versionView.data.id)}
              </Descriptions.Item>
              <Descriptions.Item label="名称">
                {typeof versionView.data.name === 'string' && versionView.data.name.trim()
                  ? versionView.data.name
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="描述">
                {typeof versionView.data.description === 'string' && versionView.data.description.trim()
                  ? versionView.data.description
                  : '—'}
              </Descriptions.Item>
            </Descriptions>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Flow JSON（<Text code>json</Text> 字段，只读）
              </Text>
              <Input.TextArea
                readOnly
                rows={18}
                value={formatFlowJsonField(versionView.data.json)}
                style={{
                  marginTop: 8,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: 11,
                }}
              />
            </div>
          </Space>
        ) : (
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            未能加载该版本内容，请关闭后重试或检查网络与权限。
          </Paragraph>
        )}
      </Modal>

      <Modal
        title="另存为流程模板"
        open={tplModalOpen}
        okText="确定"
        confirmLoading={tplSaving}
        onCancel={() => {
          setTplModalOpen(false)
          tplForm.resetFields()
        }}
        onOk={() => void submitSaveAsTemplate()}
        destroyOnHidden
      >
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          将先把当前画布保存到服务端，再把本工程登记为模板；标签格式以后端约定为准（可留空）。
        </Paragraph>
        <Form form={tplForm} layout="vertical">
          <Form.Item name="tags" label="标签（tags）">
            <Input allowClear placeholder="可选，如多个可用逗号分隔" />
          </Form.Item>
        </Form>
      </Modal>

      <Table<VersionRow>
        size="small"
        pagination={false}
        rowKey={(r) => r.key}
        columns={columns}
        dataSource={versionRows}
        locale={{ emptyText: '暂无历史版本' }}
        scroll={{ x: 'max-content' }}
      />
    </Space>
  )
}
