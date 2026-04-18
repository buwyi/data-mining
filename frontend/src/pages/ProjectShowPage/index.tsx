import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons'
import { Alert, App, Button, Result, Space, Spin, Typography } from 'antd'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BrowserCompatibilityAlert } from '../../components/BrowserCompatibilityAlert'
import { ProjectFlowCanvas } from '../../components/ProjectFlowCanvas'
import { useAuthStore } from '../../stores/authStore'
import { useProjectStore } from '../../stores/projectStore'
import { pickShareAccessToken } from '../../utils/pickShareAccessToken'

const { Text, Title } = Typography

export function ProjectShowPage() {
  const { message } = App.useApp()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const shareToken = useMemo(() => pickShareAccessToken(searchParams), [searchParams])
  const accessToken = useAuthStore((s) => s.accessToken)
  const hasSession = Boolean(accessToken)
  const shareOnly = Boolean(shareToken && !hasSession)

  const { projectId: projectIdParam } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const loadProjectFlow = useProjectStore((s) => s.loadProjectFlow)
  const projectChange = useProjectStore((s) => s.flowData.projectChange)
  const detail = useProjectStore((s) => s.flowData.currentProjectDetail)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)

  const mainRef = useRef<HTMLDivElement>(null)
  const [canvasHeight, setCanvasHeight] = useState(520)
  const [loadError, setLoadError] = useState<string | null>(null)

  useLayoutEffect(() => {
    const el = mainRef.current
    if (!el) return
    const update = () => setCanvasHeight(Math.max(320, el.clientHeight))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!hasSession && !shareToken) return
    const id = Number.parseInt(projectIdParam ?? '', 10)
    if (!Number.isFinite(id) || id <= 0) {
      message.warning('无效的工程 ID')
      navigate(hasSession ? '/home/main' : '/login', { replace: true, state: { from: location } })
      return
    }
    let cancelled = false
    setLoadError(null)
    const loadOpts =
      shareToken !== undefined && shareToken.length > 0
        ? { overrideAccessToken: shareToken }
        : undefined
    void loadProjectFlow(id, loadOpts)
      .then(() => {
        if (!cancelled) setLoadError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [projectIdParam, loadProjectFlow, message, navigate, hasSession, location, shareToken])

  if (!hasSession && !shareToken) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const parsedId = Number.parseInt(projectIdParam ?? '', 10)
  const goEdit = useCallback(() => {
    if (!Number.isFinite(parsedId) || parsedId <= 0) return
    if (!hasSession) {
      message.info('请先登录后再编辑工程')
      navigate('/login', { state: { from: { pathname: `/home/project/${parsedId}`, search: '' } } })
      return
    }
    navigate(`/home/project/${parsedId}`)
  }, [hasSession, message, navigate, parsedId])

  const goBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  const titleName =
    detail?.name && currentProjectId === parsedId ? detail.name : `工程 ${parsedId}`

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: '#fafafa',
      }}
    >
      <header
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fff',
        }}
      >
        <Space align="center" size="middle">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={goBack} aria-label="返回" />
          <div>
            <Title level={5} style={{ margin: 0, fontWeight: 600, lineHeight: 1.3 }}>
              流程预览
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {titleName}
            </Text>
          </div>
        </Space>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={goEdit}
          disabled={loadError !== null || shareOnly}
          title={shareOnly ? '分享链接为只读预览，登录后可从工程页编辑' : undefined}
        >
          进入编辑
        </Button>
      </header>

      <div style={{ padding: '12px 16px 0', flexShrink: 0, background: '#fafafa' }}>
        {shareOnly ? (
          <Alert
            type="info"
            showIcon
            message="只读分享预览"
            description="通过链接中的 token 查看流程；不会写入登录态。请勿在不可信环境传播含 token 的完整 URL。"
            style={{ marginBottom: 12 }}
          />
        ) : null}
        <BrowserCompatibilityAlert />
      </div>

      <main ref={mainRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {loadError !== null ? (
          <div style={{ padding: 48 }}>
            <Result
              status="error"
              title="无法加载流程"
              subTitle={loadError}
              extra={
                <Space>
                  {hasSession ? (
                    <Button type="primary" onClick={() => navigate('/home/project')}>
                      前往工程页
                    </Button>
                  ) : (
                    <Button type="primary" onClick={() => navigate('/login', { state: { from: location } })}>
                      去登录
                    </Button>
                  )}
                </Space>
              }
            />
          </div>
        ) : (
          <Spin spinning={projectChange} style={{ display: 'block', height: '100%' }}>
            <div style={{ height: canvasHeight }}>
              <ProjectFlowCanvas readOnly borderless height={canvasHeight} />
            </div>
          </Spin>
        )}
      </main>
    </div>
  )
}
