import {
  CloudDownloadOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { App, Button, Card, Input, Space, Typography } from 'antd'
import { useCallback, useState } from 'react'
import { ProjectFlowCanvas } from '../../components/ProjectFlowCanvas'
import { useProjectStore } from '../../stores/projectStore'

const { Title, Paragraph } = Typography

export function ProjectPage() {
  const { message } = App.useApp()
  const [projectIdInput, setProjectIdInput] = useState('')
  const loadProjectFlow = useProjectStore((s) => s.loadProjectFlow)
  const saveCurrentFlow = useProjectStore((s) => s.saveCurrentFlow)
  const runCurrentFlowFull = useProjectStore((s) => s.runCurrentFlowFull)
  const stopCurrentFlowRun = useProjectStore((s) => s.stopCurrentFlowRun)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const projectChange = useProjectStore((s) => s.flowData.projectChange)
  const isRunning = useProjectStore((s) => s.flowData.isRunning)
  const workFlowId = useProjectStore((s) => s.flowData.workFlowId)
  const nodeCount = useProjectStore((s) => s.flowData.nodes.length)
  const [runActionLoading, setRunActionLoading] = useState(false)

  const onLoad = useCallback(async () => {
    const id = Number.parseInt(projectIdInput.trim(), 10)
    if (!Number.isFinite(id) || id <= 0) {
      message.warning('请输入有效的工程 ID（正整数）')
      return
    }
    try {
      await loadProjectFlow(id)
      message.success(`已加载工程 ${id}`)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败')
    }
  }, [projectIdInput, loadProjectFlow, message])

  const onSave = useCallback(async () => {
    try {
      await saveCurrentFlow()
      message.success('流程已保存')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败')
    }
  }, [saveCurrentFlow, message])

  const onRunFull = useCallback(async () => {
    setRunActionLoading(true)
    try {
      await runCurrentFlowFull()
      message.success('已保存并提交全流程运行')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '运行失败')
    } finally {
      setRunActionLoading(false)
    }
  }, [runCurrentFlowFull, message])

  const onStopRun = useCallback(async () => {
    const hadWorkFlowId = useProjectStore.getState().flowData.workFlowId > 0
    setRunActionLoading(true)
    try {
      await stopCurrentFlowRun()
      message.success(hadWorkFlowId ? '已请求停止运行' : '已清除本地运行状态')
    } catch (e) {
      message.error(e instanceof Error ? e.message : '停止失败')
    } finally {
      setRunActionLoading(false)
    }
  }, [stopCurrentFlowRun, message])

  return (
    <Card bordered={false}>
      <Title level={4}>工程 / 流程画布</Title>
      <Paragraph type="secondary">
        输入工程 ID 从服务端拉取 Flow JSON，在下方 React Flow 中查看与编辑；节点可拖拽、Delete/Backspace
        删除选中项、从输出端口拖到输入端口新建连线。保存时将当前图 POST 为 `content`。运行会先保存再按接口文档调用
        `execute/…/apply` 与 `execute?executionId=`；若响应中带 workFlowId，停止按钮会调用 `shutdown`。
      </Paragraph>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="工程 ID"
          style={{ width: 160 }}
          value={projectIdInput}
          onChange={(e) => setProjectIdInput(e.target.value)}
          onPressEnter={() => void onLoad()}
        />
        <Button
          type="primary"
          icon={<CloudDownloadOutlined />}
          loading={projectChange}
          onClick={() => void onLoad()}
        >
          加载工程
        </Button>
        <Button icon={<SaveOutlined />} onClick={() => void onSave()} disabled={!currentProjectId}>
          保存流程
        </Button>
        <Button
          icon={<PlayCircleOutlined />}
          loading={runActionLoading}
          disabled={!currentProjectId}
          onClick={() => void onRunFull()}
        >
          运行（全流程）
        </Button>
        <Button
          danger
          icon={<StopOutlined />}
          loading={runActionLoading}
          disabled={!currentProjectId || !isRunning}
          onClick={() => void onStopRun()}
        >
          停止
        </Button>
        <Typography.Text type="secondary">
          当前工程：{currentProjectId ?? '—'} · 节点数：{nodeCount}
          {isRunning ? ` · 运行中${workFlowId > 0 ? ` · workFlowId ${workFlowId}` : ''}` : ''}
        </Typography.Text>
      </Space>
      <ProjectFlowCanvas height={560} readOnly={false} />
    </Card>
  )
}
