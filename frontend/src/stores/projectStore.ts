import { create } from 'zustand'
import {
  applyProjectExecution,
  fetchProjectChildren,
  fetchProjectDetail,
  runProjectExecute,
  saveProjectFlowContent,
  shutdownProjectRun,
  type ProjectChildDto,
  type ProjectDetailDto,
  type ProjectExecuteVariant,
} from '../api/projectApi'
import {
  emptyPersistedFlowDocument,
  parseFlowDocumentFromApiJsonString,
  readWireNodeId,
  stringifyFlowForSave,
  type FlowCanvasStyle,
  type FlowLinkWire,
  type FlowNodeWire,
  type FlowRunSummaryPersist,
  type PersistedFlowDocument,
} from '../domain/flow'
import {
  DM_NODE_LAST_RUN_AT,
  DM_NODE_LAST_RUN_STATUS,
  type DmNodeRunStatus,
} from '../domain/flow'
import type {
  SocketRunTerminalVariant,
  SocketRunVisualVariant,
  TipdmFlowSocketEvent,
} from '../realtime/tipdmSocketTypes'
import { tipdmCanvasNodeIdMatchesSocketJobId } from '../utils/tipdmSocketNodeIdMatch'

let flowRunNodeFailureSeen = false
let runFailureModalKeySeq = 0

type RunFailureAccumulatorEntry = { nodeId: string; nodeIndex: string }
const runFailureAccumulator: RunFailureAccumulatorEntry[] = []

function dedupeRunFailureEntries(entries: RunFailureAccumulatorEntry[]): RunFailureAccumulatorEntry[] {
  const byNodeId = new Map<string, RunFailureAccumulatorEntry>()
  for (const e of entries) {
    if (!byNodeId.has(e.nodeId)) byNodeId.set(e.nodeId, e)
  }
  return [...byNodeId.values()]
}

function formatUnifiedRunFailureMessage(entries: RunFailureAccumulatorEntry[]): string {
  if (entries.length === 0) {
    return '流程运行过程中有节点执行失败，请查看节点日志与参数。'
  }
  if (entries.length === 1) {
    const e = entries[0]!
    return `节点「${e.nodeId}」执行失败，流程可能已中止。请查看节点日志与参数。`
  }
  const lines = entries.map((e) => `• 节点「${e.nodeId}」`)
  return `以下 ${entries.length} 个节点执行失败：\n\n${lines.join('\n')}\n\n流程可能已中止，请查看各节点日志与参数。`
}

function stripDmRunOutcomeFromWire(wire: FlowNodeWire): FlowNodeWire {
  const next: FlowNodeWire = { ...wire }
  delete next[DM_NODE_LAST_RUN_STATUS]
  delete next[DM_NODE_LAST_RUN_AT]
  return next
}

/** 整工程再次运行时清空各节点持久化的上次运行态，使画板回到「未运行」外观 */
function stripAllDmRunOutcomeFromNodes(nodes: FlowNodeWire[]): FlowNodeWire[] {
  return nodes.map(stripDmRunOutcomeFromWire)
}

function patchNodesWithDmRunOutcome(
  nodes: FlowNodeWire[],
  jobId: string,
  status: DmNodeRunStatus,
): FlowNodeWire[] {
  const at = new Date().toISOString()
  return nodes.map((wire) => {
    try {
      const wid = readWireNodeId(wire)
      if (!tipdmCanvasNodeIdMatchesSocketJobId(wid, jobId)) return wire
    } catch {
      return wire
    }
    return {
      ...wire,
      [DM_NODE_LAST_RUN_STATUS]: status,
      [DM_NODE_LAST_RUN_AT]: at,
    }
  })
}

function terminalToPersistStatus(terminal: SocketRunTerminalVariant): DmNodeRunStatus | null {
  if (terminal === 'success') return 'success'
  if (terminal === 'failed') return 'failed'
  if (terminal === 'skipped' || terminal === 'queued') return 'skipped'
  return null
}

/** 工程树节点（对齐 Vuex `projectMenu` 子项形态） */
export type ProjectTreeNode = {
  /** 文档树节点 id（与 `ProjectChildDto.id` 一致） */
  id: number
  /** 叶子工程时存在：真实工程 id（`ProjectChildDto.projectEntityId`） */
  projectEntityId?: number
  createTime: number
  creatorId: number
  creatorName: string
  name: string
  parentId: number
  path: string
  sequence: number
  leaf: boolean
  delete: boolean
  open: boolean
  loading: boolean
  children: ProjectTreeNode[]
}

export type FlowDataState = {
  contentStyle: FlowCanvasStyle
  /** 当前工程元数据 + `json` 字符串字段 */
  currentProjectDetail: ProjectDetailDto | null
  projectChange: boolean
  nodes: FlowNodeWire[]
  links: FlowLinkWire[]
  isRunning: boolean
  /** 与后端 `shutdown/{workFlowId}` 一致，多为字符串 */
  workFlowId: string | null
  currentNodeId: { curNodeId: string; curNodeIndex: string }
  /** Socket 推送的画布节点高亮（运行中 / 成功 / 失败 / 跳过 / 排队） */
  socketRunVisual: { nodeId: string; variant: SocketRunVisualVariant }
  /** 最近一次整流程运行摘要（持久化在工程 JSON 根级 `dmLastFlow*`） */
  flowRunSummary: FlowRunSummaryPersist
  /** 流程结束后若有失败节点，由 `FlowRunFailureModalBridge` 统一弹出一次汇总提示 */
  runFailureAlert: { key: number; title: string; message: string } | null
  currentPath: { curPathId: string; curPathIndex: string }
  selectComponent: string
  nodeChange: boolean
  positionChange: boolean
  /** 树交互上下文（对齐 Vuex；`null` 表示未选目录） */
  currentProjectItem: ProjectTreeNode | null
  currentParentItem: ProjectTreeNode | null
  targetParentItem: ProjectTreeNode | null
}

function createRootProjectMenu(): ProjectTreeNode {
  return {
    id: 0,
    createTime: 0,
    creatorId: 0,
    creatorName: 'admin',
    name: '我的工程',
    parentId: 0,
    path: '',
    sequence: 0,
    leaf: false,
    delete: false,
    open: false,
    loading: false,
    children: [],
  }
}

function createInitialFlowData(): FlowDataState {
  const empty = emptyPersistedFlowDocument()
  return {
    contentStyle: empty.style,
    currentProjectDetail: null,
    projectChange: false,
    nodes: [],
    links: [],
    isRunning: false,
    workFlowId: null,
    currentNodeId: { curNodeId: '', curNodeIndex: '' },
    socketRunVisual: { nodeId: '', variant: 'running' },
    flowRunSummary: {},
    runFailureAlert: null,
    currentPath: { curPathId: '', curPathIndex: '' },
    selectComponent: '',
    nodeChange: true,
    positionChange: false,
    currentProjectItem: null,
    currentParentItem: null,
    targetParentItem: null,
  }
}

function mapDtoToTree(c: ProjectChildDto): ProjectTreeNode {
  return {
    id: c.id,
    projectEntityId: c.projectEntityId,
    name: c.name,
    parentId: c.parentId,
    leaf: c.leaf,
    delete: c.delete,
    sequence: c.sequence ?? 0,
    creatorId: c.creatorId ?? 0,
    creatorName: c.creatorName ?? '',
    path: '',
    createTime: 0,
    open: false,
    loading: false,
    children: c.leaf ? [] : [],
  }
}

function mapTreeSetLoading(nodes: ProjectTreeNode[], id: number, loading: boolean): ProjectTreeNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, loading }
    if (n.children.length > 0) {
      return { ...n, children: mapTreeSetLoading(n.children, id, loading) }
    }
    return n
  })
}

function replaceNodeChildren(
  nodes: ProjectTreeNode[],
  parentId: number,
  children: ProjectTreeNode[],
): ProjectTreeNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) {
      return { ...n, loading: false, children }
    }
    if (n.children.length > 0) {
      return { ...n, children: replaceNodeChildren(n.children, parentId, children) }
    }
    return n
  })
}

export type ProjectStoreState = {
  projectMenu: ProjectTreeNode[]
  flowData: FlowDataState
  /** 当前打开的工程 id（与 `currentProjectDetail.id` 同步） */
  currentProjectId: number | null
  /**
   * 仅在从远端加载/整包替换流程时递增；画布本地编辑不递增。
   * React Flow 用它触发「从 store 重置画布」而避免编辑回流造成循环。
   */
  flowRemoteRevision: number
  /**
   * 任意「store 中的 nodes/links 与画布需对齐」时递增（含远端加载、拖入组件新建节点）。
   * 与 `flowRemoteRevision` 分离，避免每次加节点都触发 fitView。
   */
  flowGraphRevision: number
  /** 画布当前选中的流程节点 wire id（与 `FlowNodeWire.id` 一致） */
  selectedWireNodeId: string | null
  /** 节点右键菜单（屏幕坐标，用于固定定位） */
  nodeContextMenu: { clientX: number; clientY: number; nodeId: string } | null

  setCurrentProjectId: (id: number | null) => void
  setFlowData: (partial: Partial<FlowDataState>) => void
  setProjectMenu: (menu: ProjectTreeNode[]) => void
  setCurrentProjectItem: (item: ProjectTreeNode | null) => void
  setCurrentParentItem: (item: ProjectTreeNode | null) => void
  setTargetParentItem: (item: ProjectTreeNode | null) => void
  setSelectComponent: (key: string) => void
  toggleNodeChange: () => void
  updateCurrentNode: (payload: { curNodeId: string; curNodeIndex: string }) => void
  updateFlowCurrentPath: (payload: { curPathId: string; curPathIndex: string }) => void
  applyPersistedFlow: (doc: PersistedFlowDocument) => void
  setFlowGraph: (nodes: FlowNodeWire[], links: FlowLinkWire[]) => void
  /** 在保留 links 的前提下追加一个节点（如从组件库拖入） */
  appendFlowNodeWire: (wire: FlowNodeWire) => void
  setSelectedWireNodeId: (id: string | null) => void
  /** 深拷贝后更新单个节点并刷新画布（用于属性面板写回 tabs/inputData 等） */
  updateFlowNodeWire: (nodeId: string, updater: (wire: FlowNodeWire) => FlowNodeWire) => void
  openNodeContextMenu: (p: { clientX: number; clientY: number; nodeId: string }) => void
  closeNodeContextMenu: () => void
  /** 删除节点及其关联连线 */
  deleteFlowNodeWire: (nodeId: string) => void
  /** 对齐 `cleanCurFlowData` */
  resetFlowWorkspace: () => void
  /** 对齐 `getMenuProjectList` + 目录刷新：拉取某目录子节点并挂到树上 */
  refreshProjectChildren: (parentId: number) => Promise<void>
  /** 对齐 `getCurrentFlowJson` / `fillProjectJsonData` */
  loadProjectFlow: (projectId: number, options?: { overrideAccessToken?: string }) => Promise<void>
  /** 对齐 `saveCurrentFlowJson`：将当前内存中的 style/nodes/links POST 到服务端 */
  saveCurrentFlow: () => Promise<void>
  /** 先保存，再 `apply` + 按模式 `GET execute/...`（`componentId` 为画布节点 id，与旧版 `curNodeId` 一致） */
  runCurrentFlowExecute: (variant: ProjectExecuteVariant) => Promise<void>
  /** 等同于 `runCurrentFlowExecute('full')` */
  runCurrentFlowFull: () => Promise<void>
  /** 若存在 workFlowId 则请求 shutdown，并清除本地运行态 */
  stopCurrentFlowRun: () => Promise<void>
  /** 仅刷新当前工程元数据（name/description/versions），不替换画布 nodes/links */
  refreshProjectMetadata: () => Promise<void>
  /** 全局 Socket 推送的流程进度（解析见 `parseTipdmSocketPayload`） */
  applyRemoteFlowSocketEvent: (e: TipdmFlowSocketEvent) => void
  clearRunFailureAlert: () => void
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projectMenu: [createRootProjectMenu()],
  flowData: createInitialFlowData(),
  currentProjectId: null,
  flowRemoteRevision: 0,
  flowGraphRevision: 0,
  selectedWireNodeId: null,
  nodeContextMenu: null,

  setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),

  setFlowData: (partial) =>
    set((s) => ({
      flowData: { ...s.flowData, ...partial },
    })),

  setProjectMenu: (projectMenu) => set({ projectMenu }),

  setCurrentProjectItem: (currentProjectItem) =>
    set((s) => ({ flowData: { ...s.flowData, currentProjectItem } })),

  setCurrentParentItem: (currentParentItem) =>
    set((s) => ({ flowData: { ...s.flowData, currentParentItem } })),

  setTargetParentItem: (targetParentItem) =>
    set((s) => ({ flowData: { ...s.flowData, targetParentItem } })),

  setSelectComponent: (selectComponent) =>
    set((s) => ({ flowData: { ...s.flowData, selectComponent } })),

  toggleNodeChange: () =>
    set((s) => ({ flowData: { ...s.flowData, nodeChange: !s.flowData.nodeChange } })),

  updateCurrentNode: (payload) =>
    set((s) => ({
      flowData: {
        ...s.flowData,
        currentNodeId: { curNodeId: payload.curNodeId, curNodeIndex: payload.curNodeIndex },
        socketRunVisual:
          payload.curNodeId !== ''
            ? { nodeId: payload.curNodeId, variant: 'running' as const }
            : { nodeId: '', variant: 'running' as const },
      },
    })),

  applyRemoteFlowSocketEvent: (e) => {
    if (e.kind === 'flow_done') {
      const failed = flowRunNodeFailureSeen
      flowRunNodeFailureSeen = false
      const finishedAt = new Date().toISOString()
      const patchSummary: FlowRunSummaryPersist = failed
        ? {
            dmLastFlowStatus: 'failed',
            dmLastFlowFinishedAt: finishedAt,
            dmLastFlowMessage: '流程运行过程中有节点执行失败',
          }
        : {
            dmLastFlowStatus: 'success',
            dmLastFlowFinishedAt: finishedAt,
          }

      let runFailureAlert: FlowDataState['runFailureAlert'] = null
      if (failed) {
        const entries = dedupeRunFailureEntries(runFailureAccumulator)
        runFailureAccumulator.length = 0
        runFailureModalKeySeq += 1
        runFailureAlert = {
          key: runFailureModalKeySeq,
          title: entries.length <= 1 ? '节点执行失败' : '流程运行完成（存在失败节点）',
          message: formatUnifiedRunFailureMessage(entries),
        }
      } else {
        runFailureAccumulator.length = 0
      }

      set((s) => ({
        flowRemoteRevision: s.flowRemoteRevision + 1,
        flowData: {
          ...s.flowData,
          isRunning: false,
          workFlowId: null,
          currentNodeId: { curNodeId: '', curNodeIndex: '' },
          socketRunVisual: { nodeId: '', variant: 'running' },
          flowRunSummary: { ...s.flowData.flowRunSummary, ...patchSummary },
          runFailureAlert,
        },
      }))
      queueMicrotask(() => {
        void get()
          .saveCurrentFlow()
          .catch((err) => console.warn('[project] flow 结束后自动保存失败', err))
      })
      return
    }
    if (e.kind === 'node_terminal') {
      if (e.terminal === 'failed') {
        flowRunNodeFailureSeen = true
        runFailureAccumulator.push({ nodeId: e.nodeId, nodeIndex: e.nodeIndex })
      }
      const persist = terminalToPersistStatus(e.terminal)
      set((s) => {
        const nodes =
          persist !== null
            ? patchNodesWithDmRunOutcome(s.flowData.nodes, e.nodeId, persist)
            : s.flowData.nodes
        return {
          flowGraphRevision: s.flowGraphRevision + 1,
          flowData: {
            ...s.flowData,
            isRunning: true,
            currentNodeId: { curNodeId: e.nodeId, curNodeIndex: e.nodeIndex },
            socketRunVisual: { nodeId: e.nodeId, variant: e.terminal },
            nodes,
          },
        }
      })
      return
    }
    set((s) => ({
      flowData: {
        ...s.flowData,
        isRunning: true,
        currentNodeId: { curNodeId: e.nodeId, curNodeIndex: e.nodeIndex },
        socketRunVisual: { nodeId: e.nodeId, variant: 'running' },
      },
    }))
  },

  clearRunFailureAlert: () =>
    set((s) => ({
      flowData: { ...s.flowData, runFailureAlert: null },
    })),

  updateFlowCurrentPath: (payload) =>
    set((s) => ({
      flowData: {
        ...s.flowData,
        currentPath: { curPathId: payload.curPathId, curPathIndex: payload.curPathIndex },
      },
    })),

  applyPersistedFlow: (doc) =>
    set((s) => ({
      flowRemoteRevision: s.flowRemoteRevision + 1,
      flowGraphRevision: s.flowGraphRevision + 1,
      selectedWireNodeId: null,
      nodeContextMenu: null,
      flowData: {
        ...s.flowData,
        contentStyle: { ...doc.style },
        nodes: [...doc.nodes],
        links: [...doc.links],
        flowRunSummary: {
          dmLastFlowStatus: doc.dmLastFlowStatus,
          dmLastFlowFinishedAt: doc.dmLastFlowFinishedAt,
          dmLastFlowMessage: doc.dmLastFlowMessage,
        },
        runFailureAlert: null,
      },
    })),

  setFlowGraph: (nodes, links) =>
    set((s) => ({
      flowData: {
        ...s.flowData,
        nodes: [...nodes],
        links: [...links],
      },
    })),

  appendFlowNodeWire: (wire) =>
    set((s) => ({
      flowGraphRevision: s.flowGraphRevision + 1,
      flowData: {
        ...s.flowData,
        nodes: [...s.flowData.nodes, wire],
      },
    })),

  setSelectedWireNodeId: (selectedWireNodeId) => set({ selectedWireNodeId }),

  updateFlowNodeWire: (nodeId, updater) =>
    set((s) => {
      const idx = s.flowData.nodes.findIndex((n) => {
        try {
          return readWireNodeId(n) === nodeId
        } catch {
          return false
        }
      })
      if (idx < 0) return {}
      const prev = s.flowData.nodes[idx]
      const draft = JSON.parse(JSON.stringify(prev)) as FlowNodeWire
      const next = updater(draft)
      const nodes = [...s.flowData.nodes]
      nodes[idx] = next
      return {
        flowGraphRevision: s.flowGraphRevision + 1,
        flowData: { ...s.flowData, nodes },
      }
    }),

  openNodeContextMenu: (p) =>
    set({
      nodeContextMenu: p,
      selectedWireNodeId: p.nodeId,
    }),

  closeNodeContextMenu: () => set({ nodeContextMenu: null }),

  deleteFlowNodeWire: (nodeId) =>
    set((s) => {
      const nodes = s.flowData.nodes.filter((n) => {
        try {
          return readWireNodeId(n) !== nodeId
        } catch {
          return true
        }
      })
      const links = s.flowData.links.filter((l) => l.source !== nodeId && l.target !== nodeId)
      return {
        flowGraphRevision: s.flowGraphRevision + 1,
        nodeContextMenu: null,
        selectedWireNodeId: s.selectedWireNodeId === nodeId ? null : s.selectedWireNodeId,
        flowData: { ...s.flowData, nodes, links },
      }
    }),

  resetFlowWorkspace: () =>
    set((s) => ({
      flowGraphRevision: s.flowGraphRevision + 1,
      selectedWireNodeId: null,
      nodeContextMenu: null,
      flowData: {
        ...s.flowData,
        currentProjectDetail: null,
        nodes: [],
        links: [],
        contentStyle: emptyPersistedFlowDocument().style,
        isRunning: false,
        workFlowId: null,
        currentNodeId: { curNodeId: '', curNodeIndex: '' },
        socketRunVisual: { nodeId: '', variant: 'running' },
        flowRunSummary: {},
        runFailureAlert: null,
      },
      currentProjectId: null,
    })),

  refreshProjectChildren: async (parentId) => {
    set((s) => ({
      projectMenu: mapTreeSetLoading(s.projectMenu, parentId, true),
    }))
    try {
      const list = await fetchProjectChildren(parentId)
      const mapped = list.map(mapDtoToTree)
      set((s) => ({
        projectMenu: replaceNodeChildren(s.projectMenu, parentId, mapped),
      }))
    } finally {
      set((s) => ({
        projectMenu: mapTreeSetLoading(s.projectMenu, parentId, false),
      }))
    }
  },

  loadProjectFlow: async (projectId, options) => {
    set((s) => ({
      flowData: {
        ...s.flowData,
        projectChange: true,
        currentNodeId: { curNodeId: '', curNodeIndex: '' },
        socketRunVisual: { nodeId: '', variant: 'running' },
        runFailureAlert: null,
      },
    }))
    try {
      const detail = await fetchProjectDetail(projectId, {
        overrideAccessToken: options?.overrideAccessToken,
      })
      set((s) => ({
        currentProjectId: projectId,
        flowData: {
          ...s.flowData,
          currentProjectDetail: detail,
        },
      }))
      const json = detail.json
      if (json !== undefined && json !== null && String(json).length > 0) {
        const doc = parseFlowDocumentFromApiJsonString(String(json))
        get().applyPersistedFlow(doc)
      } else {
        const empty = emptyPersistedFlowDocument()
        get().applyPersistedFlow(empty)
      }
    } finally {
      set((s) => ({
        flowData: { ...s.flowData, projectChange: false },
      }))
    }
  },

  saveCurrentFlow: async () => {
    const detail = get().flowData.currentProjectDetail
    if (!detail?.id) {
      throw new Error('没有当前工程，无法保存')
    }
    const { contentStyle, nodes, links, flowRunSummary } = get().flowData
    const body = stringifyFlowForSave({
      style: contentStyle,
      nodes,
      links,
      ...flowRunSummary,
    })
    await saveProjectFlowContent(detail.id, body)
  },

  runCurrentFlowExecute: async (variant) => {
    runFailureAccumulator.length = 0
    flowRunNodeFailureSeen = false

    if (variant === 'full') {
      set((s) => ({
        flowGraphRevision: s.flowGraphRevision + 1,
        flowData: {
          ...s.flowData,
          nodes: stripAllDmRunOutcomeFromNodes(s.flowData.nodes),
          socketRunVisual: { nodeId: '', variant: 'running' },
          currentNodeId: { curNodeId: '', curNodeIndex: '' },
          runFailureAlert: null,
        },
      }))
    } else {
      set((s) => ({
        flowData: { ...s.flowData, runFailureAlert: null },
      }))
    }
    await get().saveCurrentFlow()
    const detail = get().flowData.currentProjectDetail
    if (!detail?.id) {
      throw new Error('没有当前工程，无法运行')
    }
    const projectId = detail.id
    const nodeId =
      variant === 'full' ? undefined : (get().selectedWireNodeId ?? undefined)
    if (variant !== 'full' && (!nodeId || !nodeId.length)) {
      throw new Error('请先在画布上选中一个节点')
    }
    const executionId = await applyProjectExecution(projectId)
    const { workFlowId } = await runProjectExecute(projectId, executionId, variant, nodeId)
    const wf = workFlowId != null && String(workFlowId).trim() ? String(workFlowId).trim() : ''
    if (!wf) {
      throw new Error('未获取到运行任务编号，实时进度与节点高亮可能不可用。请稍后重试或检查网络与服务状态。')
    }
    set((s) => ({
      flowData: {
        ...s.flowData,
        isRunning: true,
        workFlowId: wf,
      },
    }))
  },

  runCurrentFlowFull: async () => {
    await get().runCurrentFlowExecute('full')
  },

  stopCurrentFlowRun: async () => {
    runFailureAccumulator.length = 0
    const wf = get().flowData.workFlowId
    if (wf != null && String(wf).length > 0) {
      try {
        await shutdownProjectRun(wf)
      } finally {
        set((s) => ({
          flowData: {
            ...s.flowData,
            isRunning: false,
            workFlowId: null,
            currentNodeId: { curNodeId: '', curNodeIndex: '' },
            socketRunVisual: { nodeId: '', variant: 'running' },
            runFailureAlert: null,
          },
        }))
      }
      return
    }
    set((s) => ({
      flowData: {
        ...s.flowData,
        isRunning: false,
        currentNodeId: { curNodeId: '', curNodeIndex: '' },
        socketRunVisual: { nodeId: '', variant: 'running' },
        runFailureAlert: null,
      },
    }))
  },

  refreshProjectMetadata: async () => {
    const cur = get().flowData.currentProjectDetail
    const id = cur?.id ?? get().currentProjectId
    if (!id) return
    const d = await fetchProjectDetail(id)
    set((s) => {
      const prev = s.flowData.currentProjectDetail
      if (!prev || prev.id !== id) {
        return {
          flowData: { ...s.flowData, currentProjectDetail: d },
        }
      }
      return {
        flowData: {
          ...s.flowData,
          currentProjectDetail: {
            ...prev,
            name: d.name,
            description: d.description,
            versions: d.versions,
          },
        },
      }
    })
  },
}))
