import { DownOutlined, PlayCircleOutlined, SaveOutlined, StopOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Col, Collapse, Dropdown, Input, Row, Space, Tabs, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ProjectExecuteVariant } from '../../api/projectApi'
import { ComponentLibraryTree } from '../../components/ComponentLibraryTree'
import { FlowNodePropsPanel } from '../../components/FlowNodePropsPanel'
import { ProjectFlowCanvas } from '../../components/ProjectFlowCanvas'
import { ProjectMetadataPanel } from '../../components/ProjectMetadataPanel'
import { ProjectWorkspaceTree } from '../../components/ProjectWorkspaceTree'
import { useI18n } from '../../i18n/I18nProvider'
import { useComponentTreeRootIds } from '../../hooks/useComponentTreeRootIds'
import { useProjectStore } from '../../stores/projectStore'
import { pickPositiveProjectIdFromSearchString } from '../../utils/legacyProjectIdQuery'
import { resolveFlowNodeDisplayNameByJobId } from '../../utils/resolveFlowNodeDisplayNameByJobId'

const { Title, Paragraph } = Typography

export function ProjectPage() {
  const { t } = useI18n()
  const { message } = App.useApp()
  const { projectId: projectIdParam } = useParams<{ projectId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { systemRootCatId, personalRootCatId } = useComponentTreeRootIds()
  const [projectIdInput, setProjectIdInput] = useState('')
  const loadProjectFlow = useProjectStore((s) => s.loadProjectFlow)
  const resetFlowWorkspace = useProjectStore((s) => s.resetFlowWorkspace)
  const saveCurrentFlow = useProjectStore((s) => s.saveCurrentFlow)
  const runCurrentFlowExecute = useProjectStore((s) => s.runCurrentFlowExecute)
  const stopCurrentFlowRun = useProjectStore((s) => s.stopCurrentFlowRun)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const selectedWireNodeId = useProjectStore((s) => s.selectedWireNodeId)
  const projectChange = useProjectStore((s) => s.flowData.projectChange)
  const isRunning = useProjectStore((s) => s.flowData.isRunning)
  const workFlowId = useProjectStore((s) => s.flowData.workFlowId)
  const flowNodes = useProjectStore((s) => s.flowData.nodes)
  const socketRunVisual = useProjectStore((s) => s.flowData.socketRunVisual)
  const nodeCount = flowNodes.length
  const flowRunSummary = useProjectStore((s) => s.flowData.flowRunSummary)
  const [runActionLoading, setRunActionLoading] = useState(false)

  const lastRunBanner = useMemo(() => {
    if (isRunning) return null
    const st = flowRunSummary.dmLastFlowStatus
    if (!st) return null
    const time =
      flowRunSummary.dmLastFlowFinishedAt != null && flowRunSummary.dmLastFlowFinishedAt.length > 0
        ? new Date(flowRunSummary.dmLastFlowFinishedAt).toLocaleString()
        : '—'
    if (st === 'success') {
      return (
        <Alert
          type="success"
          showIcon
          message={t('projectPage.lastRun.success', { time })}
          style={{ marginBottom: 12 }}
        />
      )
    }
    if (st === 'failed') {
      const extra = flowRunSummary.dmLastFlowMessage?.trim()
        ? ` ${flowRunSummary.dmLastFlowMessage}`
        : ''
      return (
        <Alert
          type="error"
          showIcon
          message={t('projectPage.lastRun.failed', { time, extra })}
          style={{ marginBottom: 12 }}
        />
      )
    }
    if (st === 'aborted') {
      return (
        <Alert
          type="warning"
          showIcon
          message={t('projectPage.lastRun.aborted', { time })}
          style={{ marginBottom: 12 }}
        />
      )
    }
    return null
  }, [flowRunSummary, isRunning, t])

  const runningNodeDisplayName = useMemo(
    () =>
      isRunning && socketRunVisual.nodeId !== ''
        ? resolveFlowNodeDisplayNameByJobId(flowNodes, socketRunVisual.nodeId)
        : null,
    [flowNodes, isRunning, socketRunVisual.nodeId],
  )

  const runScopedLabel = useMemo(
    () =>
      ({
        endAt: t('projectPage.run.endAt'),
        only: t('projectPage.run.only'),
        startAt: t('projectPage.run.startAt'),
      }) satisfies Record<Exclude<ProjectExecuteVariant, 'full'>, string>,
    [t],
  )

  /** 无路径参数时，从 `?projectId=` / `?id=` 等与旧版对齐的 query 解析（规范路由为 `/home/project/:id`） */
  const legacyIdFromQuery = useMemo(
    () => (projectIdParam ? null : pickPositiveProjectIdFromSearchString(location.search)),
    [projectIdParam, location.search],
  )

  useEffect(() => {
    if (legacyIdFromQuery === null) return
    navigate(`/home/project/${legacyIdFromQuery}`, { replace: true })
  }, [legacyIdFromQuery, navigate])

  useEffect(() => {
    if (projectIdParam) return
    if (legacyIdFromQuery !== null) return
    resetFlowWorkspace()
  }, [projectIdParam, legacyIdFromQuery, resetFlowWorkspace])

  useEffect(() => {
    if (!projectIdParam) return
    const id = Number.parseInt(projectIdParam, 10)
    if (!Number.isFinite(id) || id <= 0) {
      navigate('/home/project', { replace: true })
      return
    }
    let cancelled = false
    void loadProjectFlow(id)
      .then(() => {
        if (!cancelled) message.success(t('projectPage.msg.loadedProject', { id }))
      })
      .catch((e) => {
        if (!cancelled) message.error(e instanceof Error ? e.message : t('projectPage.msg.loadFailed'))
      })
    return () => {
      cancelled = true
    }
  }, [projectIdParam, loadProjectFlow, message, navigate, t])

  const onLoadById = useCallback(() => {
    const id = Number.parseInt(projectIdInput.trim(), 10)
    if (!Number.isFinite(id) || id <= 0) {
      message.warning(t('projectPage.warn.invalidProjectId'))
      return
    }
    navigate(`/home/project/${id}`)
    setProjectIdInput('')
  }, [projectIdInput, message, navigate, t])

  const onSelectProjectFromTree = useCallback(
    (id: number) => {
      navigate(`/home/project/${id}`)
    },
    [navigate],
  )

  const onCurrentProjectRemoved = useCallback(() => {
    navigate('/home/project', { replace: true })
  }, [navigate])

  const onSave = useCallback(async () => {
    try {
      await saveCurrentFlow()
      message.success(t('projectPage.msg.flowSaved'))
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('projectPage.msg.saveFailed'))
    }
  }, [saveCurrentFlow, message, t])

  const onRunVariant = useCallback(
    async (variant: ProjectExecuteVariant) => {
      setRunActionLoading(true)
      try {
        await runCurrentFlowExecute(variant)
        const sid = useProjectStore.getState().selectedWireNodeId
        if (variant === 'full') {
          message.success(t('projectPage.msg.runFullSubmitted'))
        } else {
          message.success(
            t('projectPage.msg.runScopedSubmitted', {
              label: runScopedLabel[variant],
              nodeId: sid != null ? String(sid) : '—',
            }),
          )
        }
      } catch (e) {
        message.error(e instanceof Error ? e.message : t('projectPage.msg.runFailed'))
      } finally {
        setRunActionLoading(false)
      }
    },
    [runCurrentFlowExecute, message, runScopedLabel, t],
  )

  const runMenuItems: MenuProps['items'] = useMemo(
    () => [
      {
        key: 'endAt',
        label: t('projectPage.run.menuEndAt'),
        disabled: !selectedWireNodeId,
      },
      {
        key: 'only',
        label: t('projectPage.run.menuOnly'),
        disabled: !selectedWireNodeId,
      },
      {
        key: 'startAt',
        label: t('projectPage.run.menuStartAt'),
        disabled: !selectedWireNodeId,
      },
    ],
    [selectedWireNodeId, t],
  )

  const onStopRun = useCallback(async () => {
    const wf = useProjectStore.getState().flowData.workFlowId
    const hadWorkFlowId = wf != null && String(wf).length > 0
    setRunActionLoading(true)
    try {
      await stopCurrentFlowRun()
      message.success(
        hadWorkFlowId ? t('projectPage.msg.stopRequested') : t('projectPage.msg.stopLocalCleared'),
      )
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('projectPage.msg.stopFailed'))
    } finally {
      setRunActionLoading(false)
    }
  }, [stopCurrentFlowRun, message, t])

  return (
    <Card bordered={false}>
      <Title level={4}>{t('projectPage.title')}</Title>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {t('projectPage.intro')}
      </Paragraph>
      <Space wrap style={{ marginBottom: 16 }}>
        <Button icon={<SaveOutlined />} onClick={() => void onSave()} disabled={!currentProjectId}>
          {t('projectPage.saveFlow')}
        </Button>
        <Dropdown.Button
          type="primary"
          icon={<DownOutlined />}
          menu={{
            items: runMenuItems,
            onClick: ({ key }) => void onRunVariant(key as ProjectExecuteVariant),
          }}
          loading={runActionLoading}
          disabled={!currentProjectId}
          onClick={() => void onRunVariant('full')}
        >
          <PlayCircleOutlined /> {t('projectPage.runFull')}
        </Dropdown.Button>
        <Button
          danger
          icon={<StopOutlined />}
          loading={runActionLoading}
          disabled={!currentProjectId || !isRunning}
          onClick={() => void onStopRun()}
        >
          {t('projectPage.stop')}
        </Button>
        <Typography.Text type="secondary">
          {t('projectPage.status.current')}
          {currentProjectId ?? '—'}
          {t('projectPage.status.nodes')}
          {nodeCount}
          {projectChange ? t('projectPage.status.loading') : ''}
          {isRunning ? t('projectPage.status.running') : ''}
          {runningNodeDisplayName !== null
            ? t('projectPage.status.runningNode', { name: runningNodeDisplayName })
            : ''}
          {isRunning && workFlowId != null && String(workFlowId).length > 0
            ? t('projectPage.status.workFlowId', { id: String(workFlowId) })
            : ''}
        </Typography.Text>
      </Space>
      {lastRunBanner}

      <Collapse
        ghost
        style={{ marginBottom: 12 }}
        items={[
          {
            key: 'metadata',
            label: t('projectPage.collapse.metadata'),
            children: <ProjectMetadataPanel />,
          },
          {
            key: 'by-id',
            label: t('projectPage.collapse.byId'),
            children: (
              <Space wrap>
                <Input
                  placeholder={t('projectPage.placeholderProjectId')}
                  style={{ width: 160 }}
                  value={projectIdInput}
                  onChange={(e) => setProjectIdInput(e.target.value)}
                  onPressEnter={() => void onLoadById()}
                />
                <Button type="default" loading={projectChange} onClick={() => void onLoadById()}>
                  {t('projectPage.load')}
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Row gutter={[16, 16]}>
        <Col flex="0 0 300px" style={{ maxWidth: '100%' }}>
          <Tabs
            size="small"
            items={[
              {
                key: 'projects',
                label: t('menu.project'),
                children: (
                  <ProjectWorkspaceTree
                    currentProjectId={currentProjectId}
                    onSelectProject={onSelectProjectFromTree}
                    onCurrentProjectRemoved={onCurrentProjectRemoved}
                  />
                ),
              },
              {
                key: 'components',
                label: t('componentTree.card.default'),
                children: (
                  <ComponentLibraryTree
                    variant="palette"
                    systemRootCatId={systemRootCatId}
                    personalRootCatId={personalRootCatId}
                  />
                ),
              },
            ]}
          />
        </Col>
        <Col flex="1 1 380px" style={{ minWidth: 0 }}>
          <ProjectFlowCanvas height={560} readOnly={false} />
        </Col>
        <Col flex="0 0 320px" style={{ maxWidth: '100%' }}>
          <Card
            size="small"
            type="inner"
            styles={{
              body: {
                height: 560,
                maxHeight: 560,
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden',
              },
            }}
          >
            <FlowNodePropsPanel />
          </Card>
        </Col>
      </Row>
    </Card>
  )
}
