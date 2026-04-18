import {
  BranchesOutlined,
  DeleteOutlined,
  EditOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  LineChartOutlined,
  PlayCircleOutlined,
  TableOutlined,
} from '@ant-design/icons'
import {
  App,
  Form,
  Input,
  Menu,
  Modal,
  Spin,
  Typography,
} from 'antd'
import type { MenuProps } from 'antd'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getHttpServerBase } from '../../api/httpClient'
import type { ProjectExecuteVariant } from '../../api/projectApi'
import {
  fetchProjectNodeLog,
  fetchProjectNodeOutputData,
  fetchProjectNodeResult,
  fetchProjectNodeViewSource,
  fetchProjectNodeVisual,
} from '../../api/projectNodeApi'
import { readWireNodeId, type FlowNodeWire } from '../../domain/flow'
import { useConfigStore } from '../../stores/configStore'
import { useProjectStore } from '../../stores/projectStore'
import { formatTipdmNodeLogFilePath, resolveTipdmLogHome } from '../../utils/tipdmLogHomePath'
import { sanitizeNodeLogHtmlForDisplay } from '../../utils/sanitizeNodeLogHtml'
import {
  sanitizeNodeReportHtmlForDisplay,
  shouldRenderNodeResultAsInlineHtml,
} from '../../utils/sanitizeNodeReportHtml'
import {
  listWireOutputsForPreview,
  readWireAllowViewSource,
  readWireHasReport,
  wireSupportsChartVisual,
} from '../../utils/flowNodeContextHelpers'
import { NodeOutputDataPreview } from '../NodeOutputDataPreview'
import { ScriptCodeEditor } from '../ScriptCodeEditor'

const { Text } = Typography

const MENU_PAD = 8
const MENU_EST_WIDTH = 268

function getViewportSize(): { vw: number; vh: number } {
  const vv = window.visualViewport
  if (vv) {
    return { vw: vv.width, vh: vv.height }
  }
  return { vw: window.innerWidth, vh: window.innerHeight }
}

/** 根据已渲染菜单的真实尺寸，将 fixed 菜单限制在当前视口内 */
function clampMenuToViewport(el: HTMLElement, pad: number): { left: number; top: number } {
  const { vw, vh } = getViewportSize()
  const br = el.getBoundingClientRect()
  let left = br.left
  let top = br.top
  if (br.right > vw - pad) left -= br.right - (vw - pad)
  if (br.bottom > vh - pad) top -= br.bottom - (vh - pad)
  if (left < pad) left = pad
  if (top < pad) top = pad
  return { left: Math.round(left), top: Math.round(top) }
}

function resolveAssetUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  try {
    const base = getHttpServerBase()
    return `${base}${t.startsWith('/') ? '' : '/'}${t}`
  } catch {
    return t
  }
}

function findWireByNodeId(nodes: FlowNodeWire[], nodeId: string): FlowNodeWire | null {
  for (const n of nodes) {
    try {
      if (readWireNodeId(n) === nodeId) return n
    } catch {
      /* skip */
    }
  }
  return null
}

export type FlowNodeContextMenuProps = {
  readOnly?: boolean
}

export function FlowNodeContextMenu({ readOnly = false }: FlowNodeContextMenuProps) {
  const { message, modal } = App.useApp()
  const appConfig = useConfigStore((s) => s.config)
  const tipdmLogHomeResolved = useMemo(() => resolveTipdmLogHome(appConfig), [appConfig])
  const ctx = useProjectStore((s) => s.nodeContextMenu)
  const closeMenu = useProjectStore((s) => s.closeNodeContextMenu)
  const nodes = useProjectStore((s) => s.flowData.nodes)
  const projectDetail = useProjectStore((s) => s.flowData.currentProjectDetail)
  const isRunning = useProjectStore((s) => s.flowData.isRunning)
  const deleteFlowNodeWire = useProjectStore((s) => s.deleteFlowNodeWire)
  const updateFlowNodeWire = useProjectStore((s) => s.updateFlowNodeWire)
  const runCurrentFlowExecute = useProjectStore((s) => s.runCurrentFlowExecute)

  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 })

  const wire = useMemo(
    () => (ctx ? findWireByNodeId(nodes, ctx.nodeId) : null),
    [ctx, nodes],
  )

  const projectId = projectDetail?.id

  useEffect(() => {
    if (!ctx) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t)) return
      const el = t instanceof Element ? t : null
      if (el?.closest?.('.ant-menu-submenu-popup')) return
      /** Modal / Dropdown / Popover 等挂在 body，勿当作「点画布关菜单」 */
      if (el?.closest?.('.ant-modal-wrap, .ant-modal-root, .ant-dropdown, .ant-popover, .ant-picker-dropdown')) return
      closeMenu()
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [ctx, closeMenu])

  useEffect(() => {
    if (!ctx) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctx, closeMenu])

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameForm] = Form.useForm<{ name: string }>()

  const [logOpen, setLogOpen] = useState(false)
  const [logText, setLogText] = useState('')
  const [logLoading, setLogLoading] = useState(false)
  /** 打开日志弹窗时的节点 id（菜单关闭后 ctx 会清空，仍用于展示与服务端一致的预期 .log 路径） */
  const [logDialogNodeId, setLogDialogNodeId] = useState<string | null>(null)

  const [resultOpen, setResultOpen] = useState(false)
  const [resultUrl, setResultUrl] = useState('')
  const [resultHtml, setResultHtml] = useState('')
  const [resultLoading, setResultLoading] = useState(false)

  const [codeOpen, setCodeOpen] = useState(false)
  const [codeText, setCodeText] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  const [dataOpen, setDataOpen] = useState(false)
  const [dataPayload, setDataPayload] = useState<unknown>(null)
  const [dataTitle, setDataTitle] = useState('')
  const [dataLoading, setDataLoading] = useState(false)

  const [visualOpen, setVisualOpen] = useState(false)
  const [visualUrl, setVisualUrl] = useState('')
  const [visualLoading, setVisualLoading] = useState(false)

  const logFilePathHint = useMemo(() => {
    if (!tipdmLogHomeResolved || !logDialogNodeId) return ''
    try {
      return formatTipdmNodeLogFilePath(tipdmLogHomeResolved, logDialogNodeId)
    } catch {
      return ''
    }
  }, [tipdmLogHomeResolved, logDialogNodeId])

  const logHtmlSafe = useMemo(() => sanitizeNodeLogHtmlForDisplay(logText), [logText])

  const editBlocked = readOnly || isRunning
  const runBlocked = readOnly || isRunning
  /** 旧版仅 `isRunning` 时禁用查看类菜单 */
  const viewBlocked = isRunning

  const openRename = useCallback(() => {
    if (!ctx || !wire) return
    closeMenu()
    renameForm.setFieldsValue({
      name: typeof wire.name === 'string' ? wire.name : ctx.nodeId,
    })
    setRenameOpen(true)
  }, [ctx, wire, closeMenu, renameForm])

  const submitRename = useCallback(async () => {
    if (!ctx) return
    const v = await renameForm.validateFields()
    const name = v.name.trim()
    const reg = /^(?! +$).+/
    if (name.length > 20) {
      message.warning('名称长度为 1～20 个字符')
      return
    }
    if (!reg.test(name)) {
      message.warning('名称不能为空')
      return
    }
    updateFlowNodeWire(ctx.nodeId, (w) => ({ ...w, name }))
    message.success('已重命名')
    setRenameOpen(false)
  }, [ctx, renameForm, message, updateFlowNodeWire])

  const confirmDelete = useCallback(() => {
    if (!ctx) return
    closeMenu()
    modal.confirm({
      title: '删除节点',
      content: `确定删除节点「${ctx.nodeId}」及其连线吗？`,
      okText: '删除',
      okType: 'danger',
      onOk: () => {
        deleteFlowNodeWire(ctx.nodeId)
        message.success('已删除节点')
      },
    })
  }, [ctx, closeMenu, modal, message, deleteFlowNodeWire])

  const runVariant = useCallback(
    async (variant: ProjectExecuteVariant) => {
      closeMenu()
      try {
        if (!projectId) {
          message.warning('请先打开工程')
          return
        }
        await runCurrentFlowExecute(variant)
        message.success(variant === 'full' ? '已提交全流程运行' : '已提交运行请求')
      } catch (e) {
        message.error(e instanceof Error ? e.message : '运行失败')
      }
    },
    [closeMenu, message, projectId, runCurrentFlowExecute],
  )

  const openLog = useCallback(async () => {
    if (!ctx) return
    const nodeIdForApi = wire ? readWireNodeId(wire) : ctx.nodeId
    closeMenu()
    setLogDialogNodeId(nodeIdForApi)
    setLogOpen(true)
    setLogText('')
    setLogLoading(true)
    try {
      const text = await fetchProjectNodeLog(
        nodeIdForApi,
        tipdmLogHomeResolved ? { tipdmLogHome: tipdmLogHomeResolved } : undefined,
      )
      setLogText(text)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载日志失败')
    } finally {
      setLogLoading(false)
    }
  }, [ctx, wire, closeMenu, message, tipdmLogHomeResolved])

  const openResult = useCallback(async () => {
    if (!ctx) return
    closeMenu()
    setResultOpen(true)
    setResultUrl('')
    setResultHtml('')
    setResultLoading(true)
    try {
      const nodeIdForApi = wire ? readWireNodeId(wire) : ctx.nodeId
      const raw = await fetchProjectNodeResult(nodeIdForApi)
      if (shouldRenderNodeResultAsInlineHtml(raw)) {
        let stylesheetBase: string | undefined
        try {
          stylesheetBase = getHttpServerBase()
        } catch {
          stylesheetBase = undefined
        }
        setResultHtml(sanitizeNodeReportHtmlForDisplay(raw, { stylesheetBase }))
      } else {
        setResultUrl(resolveAssetUrl(raw))
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载报告地址失败')
    } finally {
      setResultLoading(false)
    }
  }, [ctx, wire, closeMenu, message])

  const openCode = useCallback(async () => {
    if (!ctx || !projectId) return
    closeMenu()
    setCodeOpen(true)
    setCodeText('')
    setCodeLoading(true)
    try {
      const src = await fetchProjectNodeViewSource(projectId, ctx.nodeId)
      setCodeText(src)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载源码失败')
    } finally {
      setCodeLoading(false)
    }
  }, [ctx, projectId, closeMenu, message])

  const openData = useCallback(
    async (outputId: string, title: string) => {
      if (!projectId) {
        message.warning('请先打开工程')
        return
      }
      closeMenu()
      setDataTitle(title)
      setDataOpen(true)
      setDataPayload(null)
      setDataLoading(true)
      try {
        const payload = await fetchProjectNodeOutputData(projectId, outputId)
        setDataPayload(payload)
      } catch (e) {
        message.error(e instanceof Error ? e.message : '加载数据失败')
      } finally {
        setDataLoading(false)
      }
    },
    [projectId, closeMenu, message],
  )

  const openVisual = useCallback(async () => {
    if (!ctx || !projectId) return
    closeMenu()
    setVisualOpen(true)
    setVisualUrl('')
    setVisualLoading(true)
    try {
      const url = await fetchProjectNodeVisual(projectId, ctx.nodeId)
      setVisualUrl(resolveAssetUrl(url))
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载可视化地址失败')
    } finally {
      setVisualLoading(false)
    }
  }, [ctx, projectId, closeMenu, message])

  const previewOutputs = useMemo(
    () => (wire ? listWireOutputsForPreview(wire) : []),
    [wire],
  )
  const previewable = useMemo(() => previewOutputs.filter((o) => o.canPreview), [previewOutputs])
  const hasReport = wire ? readWireHasReport(wire) : false
  const allowSource = wire ? readWireAllowViewSource(wire) : false
  const showChart = wire ? wireSupportsChartVisual(wire) : false

  const menuItems: MenuProps['items'] = useMemo(() => {
    const items: MenuProps['items'] = []
    if (!ctx || !wire) return items

    items.push(
      { key: 'rename', label: '重命名', icon: <EditOutlined />, disabled: editBlocked },
      { key: 'delete', label: '删除节点', icon: <DeleteOutlined />, danger: true, disabled: editBlocked },
      { type: 'divider' },
      {
        key: 'run-full',
        label: '全部运行',
        icon: <PlayCircleOutlined />,
        disabled: runBlocked,
      },
      {
        key: 'run-endAt',
        label: '运行到此处',
        icon: <BranchesOutlined />,
        disabled: runBlocked,
      },
      {
        key: 'run-only',
        label: '运行该节点',
        icon: <PlayCircleOutlined />,
        disabled: runBlocked,
      },
      {
        key: 'run-startAt',
        label: '从此节点运行',
        icon: <PlayCircleOutlined />,
        disabled: runBlocked,
      },
      { type: 'divider' },
    )

    if (previewable.length === 1) {
      const o = previewable[0]
      items.push({
        key: `data:${o.previewPathId}`,
        label: '查看数据',
        icon: <TableOutlined />,
        disabled: viewBlocked,
      })
    } else if (previewable.length > 1) {
      items.push({
        key: 'data-submenu',
        label: '查看数据',
        icon: <TableOutlined />,
        disabled: viewBlocked,
        children: previewable.map((o) => ({
          key: `data:${o.previewPathId}`,
          label: o.name,
          disabled: viewBlocked,
        })),
      })
    }

    if (showChart) {
      items.push({
        key: 'visual',
        label: '绘制可视化',
        icon: <LineChartOutlined />,
        disabled: viewBlocked,
      })
    }

    if (hasReport) {
      items.push({
        key: 'result',
        label: '查看报告',
        icon: <FileSearchOutlined />,
        disabled: viewBlocked,
      })
    }

    items.push({
      key: 'log',
      label: '查看日志',
      icon: <FileTextOutlined />,
      disabled: viewBlocked,
    })

    if (allowSource) {
      items.push({
        key: 'viewsource',
        label: '查看源码',
        icon: <FileTextOutlined />,
        disabled: viewBlocked,
      })
    }

    return items
  }, [ctx, wire, editBlocked, runBlocked, viewBlocked, previewable, showChart, hasReport, allowSource])

  /** 仅用「光标 + 节点」作 effect 依赖，避免 ctx 对象引用在其它 flowData 更新时抖动导致死循环 */
  const menuAnchorKey = ctx ? `${ctx.nodeId}:${ctx.clientX}:${ctx.clientY}` : ''

  /** 右键菜单：按光标初定位，布局后按真实尺寸夹紧到 visualViewport */
  useLayoutEffect(() => {
    if (!ctx) return undefined

    const { vw, vh } = getViewportSize()
    const estH = Math.min(560, Math.floor(vh * 0.88))

    let left = ctx.clientX
    let top = ctx.clientY
    if (left + MENU_EST_WIDTH > vw - MENU_PAD) {
      left = Math.max(MENU_PAD, vw - MENU_EST_WIDTH - MENU_PAD)
    }
    if (top + estH > vh - MENU_PAD) {
      top = Math.max(MENU_PAD, vh - estH - MENU_PAD)
    }
    left = Math.round(left)
    top = Math.round(top)
    setMenuPos((p) => (p.left === left && p.top === top ? p : { left, top }))

    const applyClamp = () => {
      const el = menuRef.current
      if (!el) return
      const next = clampMenuToViewport(el, MENU_PAD)
      setMenuPos((p) => (p.left === next.left && p.top === next.top ? p : next))
    }

    const raf1 = requestAnimationFrame(applyClamp)
    let raf2 = 0
    const raf0 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(applyClamp)
    })

    const vv = window.visualViewport
    /** 视口变化时夹紧；内部 setState 仅在坐标变化时更新，避免与 menuItems 等形成更新环 */
    const onViewportChange = () => applyClamp()
    vv?.addEventListener('resize', onViewportChange)
    vv?.addEventListener('scroll', onViewportChange)
    window.addEventListener('resize', onViewportChange)

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf0)
      if (raf2) cancelAnimationFrame(raf2)
      vv?.removeEventListener('resize', onViewportChange)
      vv?.removeEventListener('scroll', onViewportChange)
      window.removeEventListener('resize', onViewportChange)
    }
    // 勿将 `ctx` 放入依赖：store 每次合并 flowData 可能产生新引用，导致本 effect 与 setMenuPos 死循环。
    // `menuAnchorKey` 已覆盖「哪次右键、哪一节点、哪一坐标」。
  }, [menuAnchorKey, wire])

  const onMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(
    (info) => {
      const { key, domEvent } = info
      domEvent.stopPropagation()
      if (typeof key === 'string' && key.startsWith('data:')) {
        const outputId = key.slice('data:'.length)
        const meta = previewable.find((o) => o.previewPathId === outputId)
        void openData(outputId, meta?.name ?? outputId)
        return
      }
      switch (key) {
        case 'rename':
          openRename()
          break
        case 'delete':
          confirmDelete()
          break
        case 'run-full':
          void runVariant('full')
          break
        case 'run-endAt':
          void runVariant('endAt')
          break
        case 'run-only':
          void runVariant('only')
          break
        case 'run-startAt':
          void runVariant('startAt')
          break
        case 'visual':
          void openVisual()
          break
        case 'result':
          void openResult()
          break
        case 'log':
          void openLog()
          break
        case 'viewsource':
          void openCode()
          break
        default:
          break
      }
    },
    [
      previewable,
      openData,
      openRename,
      confirmDelete,
      runVariant,
      openVisual,
      openResult,
      openLog,
      openCode,
    ],
  )

  /** 注意：不得在 !ctx 时 return null —— 否则会卸载所有 Modal；「查看日志」等会先 closeMenu() 清空 ctx，导致弹窗永远不出现或状态错乱 */
  return (
    <>
      {ctx ? (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: menuPos.left,
            top: menuPos.top,
            zIndex: 2000,
            minWidth: 200,
            maxHeight: 'min(85vh, 560px)',
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgb(0 0 0 / 12%)',
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {!wire ? (
            <div style={{ padding: 12 }}>
              <Text type="secondary">未找到节点数据</Text>
            </div>
          ) : (
            <Menu
              mode="vertical"
              selectable={false}
              items={menuItems}
              onClick={onMenuClick}
              style={{ border: 'none' }}
              getPopupContainer={() => menuRef.current ?? document.body}
            />
          )}
        </div>
      ) : null}

      <Modal
        title="重命名节点"
        open={renameOpen}
        onCancel={() => setRenameOpen(false)}
        onOk={() => void submitRename()}
        destroyOnClose
      >
        <Form form={renameForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input maxLength={20} showCount placeholder="1～20 个字符" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="节点日志"
        open={logOpen}
        width={720}
        footer={null}
        onCancel={() => {
          setLogOpen(false)
          setLogDialogNodeId(null)
        }}
      >
        <Spin spinning={logLoading}>
          {logFilePathHint ? (
            <Text type="secondary" style={{ display: 'block', marginBottom: 8, wordBreak: 'break-all' }}>
              与服务端 LOG_HOME 一致时，日志文件：{logFilePathHint}
            </Text>
          ) : null}
          <div
            className="node-log-html-body"
            style={{
              minHeight: 200,
              maxHeight: 440,
              overflow: 'auto',
              padding: 10,
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              background: '#fafafa',
              fontSize: 12,
              lineHeight: 1.55,
            }}
            // 后端返回带样式的 div 日志；已做标签与 style 白名单过滤
            dangerouslySetInnerHTML={{
              __html: logLoading
                ? ' '
                : !logText.trim()
                  ? '<span style="color:#999">暂无日志</span>'
                  : logHtmlSafe || '<span style="color:#999">暂无日志</span>',
            }}
          />
        </Spin>
      </Modal>

      <Modal
        title="查看报告"
        open={resultOpen}
        width={900}
        footer={null}
        onCancel={() => {
          setResultOpen(false)
          setResultHtml('')
          setResultUrl('')
        }}
        styles={{ body: { height: 560, padding: 0 } }}
      >
        <Spin spinning={resultLoading}>
          {resultHtml ? (
            <div
              className="node-report-html-body"
              style={{
                height: 540,
                overflow: 'auto',
                padding: 12,
                background: '#fff',
                borderTop: '1px solid rgba(0,0,0,0.06)',
              }}
              dangerouslySetInnerHTML={{ __html: resultHtml }}
            />
          ) : resultUrl ? (
            <iframe
              title="report"
              src={resultUrl}
              referrerPolicy="no-referrer-when-downgrade"
              style={{ width: '100%', height: 540, border: 'none', display: 'block' }}
            />
          ) : (
            !resultLoading && <Text type="secondary">无报告内容</Text>
          )}
        </Spin>
      </Modal>

      <Modal title="节点源码" open={codeOpen} width={800} footer={null} onCancel={() => setCodeOpen(false)}>
        <Spin spinning={codeLoading}>
          <ScriptCodeEditor value={codeText} readOnly language="python" rows={22} />
        </Spin>
      </Modal>

      <Modal
        title={`查看数据 · ${dataTitle}`}
        open={dataOpen}
        width={900}
        footer={null}
        onCancel={() => setDataOpen(false)}
      >
        <Spin spinning={dataLoading}>
          <NodeOutputDataPreview data={dataPayload} />
        </Spin>
      </Modal>

      <Modal
        title="可视化"
        open={visualOpen}
        width={900}
        footer={null}
        onCancel={() => setVisualOpen(false)}
        styles={{ body: { height: 560, padding: 0 } }}
      >
        <Spin spinning={visualLoading}>
          {visualUrl ? (
            <iframe title="visual" src={visualUrl} style={{ width: '100%', height: 540, border: 'none' }} />
          ) : (
            !visualLoading && <Text type="secondary">无可视化地址</Text>
          )}
        </Spin>
      </Modal>
    </>
  )
}
