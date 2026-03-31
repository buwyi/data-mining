import { create } from 'zustand'
import {
  fetchProjectChildren,
  fetchProjectDetail,
  saveProjectFlowContent,
  type ProjectChildDto,
  type ProjectDetailDto,
} from '../api/projectApi'
import {
  emptyPersistedFlowDocument,
  parseFlowDocumentFromApiJsonString,
  stringifyFlowForSave,
  type FlowCanvasStyle,
  type FlowLinkWire,
  type FlowNodeWire,
  type PersistedFlowDocument,
} from '../domain/flow'

/** 工程树节点（对齐 Vuex `projectMenu` 子项形态） */
export type ProjectTreeNode = {
  id: number
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
  workFlowId: number
  currentNodeId: { curNodeId: string; curNodeIndex: string }
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
    workFlowId: 0,
    currentNodeId: { curNodeId: '', curNodeIndex: '' },
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
  /** 对齐 `cleanCurFlowData` */
  resetFlowWorkspace: () => void
  /** 对齐 `getMenuProjectList` + 目录刷新：拉取某目录子节点并挂到树上 */
  refreshProjectChildren: (parentId: number) => Promise<void>
  /** 对齐 `getCurrentFlowJson` / `fillProjectJsonData` */
  loadProjectFlow: (projectId: number) => Promise<void>
  /** 对齐 `saveCurrentFlowJson`：将当前内存中的 style/nodes/links POST 到服务端 */
  saveCurrentFlow: () => Promise<void>
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projectMenu: [createRootProjectMenu()],
  flowData: createInitialFlowData(),
  currentProjectId: null,
  flowRemoteRevision: 0,

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
      },
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
      flowData: {
        ...s.flowData,
        contentStyle: { ...doc.style },
        nodes: [...doc.nodes],
        links: [...doc.links],
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

  resetFlowWorkspace: () =>
    set((s) => ({
      flowData: {
        ...s.flowData,
        currentProjectDetail: null,
        nodes: [],
        links: [],
        contentStyle: emptyPersistedFlowDocument().style,
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

  loadProjectFlow: async (projectId) => {
    set((s) => ({
      flowData: { ...s.flowData, projectChange: true },
    }))
    try {
      const detail = await fetchProjectDetail(projectId)
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
    const { contentStyle, nodes, links } = get().flowData
    const body = stringifyFlowForSave({ style: contentStyle, nodes, links })
    await saveProjectFlowContent(detail.id, body)
  },
}))
