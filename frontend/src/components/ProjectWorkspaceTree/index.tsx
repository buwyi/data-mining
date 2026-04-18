import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { App, Button, Form, Input, Menu, Modal, Space, Tree, Typography } from 'antd'
import type { DataNode, EventDataNode } from 'antd/es/tree'
import type { MenuProps } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createProject,
  createProjectCategory,
  deleteProject,
  deleteProjectCategory,
  fetchProjectChildren,
  fetchProjectDetail,
  patchProjectDescription,
  type ProjectChildDto,
} from '../../api/projectApi'
import { SaveAsProjectDialog } from '../SaveAsProjectDialog'
import { useProjectStore } from '../../stores/projectStore'

const { Text } = Typography

const ROOT_KEY = 'dir-0'

export type ProjectWorkspaceTreeProps = {
  /** 选中叶子工程时加载流程 */
  onSelectProject: (projectId: number) => void | Promise<void>
  /** 当前已加载的工程 ID，用于高亮树节点 */
  currentProjectId: number | null
  /** 删除当前工程并已 reset 工作区后回调（如同步浏览器 URL） */
  onCurrentProjectRemoved?: () => void
}

function updateTreeData(list: DataNode[], nodeKey: React.Key, children: DataNode[]): DataNode[] {
  return list.map((node) => {
    if (node.key === nodeKey) {
      return { ...node, children }
    }
    if (node.children?.length) {
      return { ...node, children: updateTreeData(node.children, nodeKey, children) }
    }
    return node
  })
}

/** 叶子节点 key 使用 `dm_project.id`，与 `GET /api/project/{id}` 一致（行上的 `id` 为文档 id） */
function nodeKeyForItem(item: ProjectChildDto): string {
  if (!item.leaf) return `dir-${item.id}`
  if (item.projectEntityId != null) return `project-${item.projectEntityId}`
  return `project-${item.id}`
}

function mapChildren(
  items: ProjectChildDto[],
  dtoByKey: Map<string, ProjectChildDto>,
): DataNode[] {
  return items.map((item) => {
    const key = nodeKeyForItem(item)
    dtoByKey.set(key, item)
    return {
      key,
      title: item.name,
      isLeaf: item.leaf,
      icon: item.leaf ? <FileOutlined /> : <FolderOutlined />,
      ...(item.leaf ? {} : { children: [] as DataNode[] }),
    }
  })
}

function parseKey(key: React.Key): { kind: 'dir' | 'project'; id: number } | null {
  const s = String(key)
  if (s.startsWith('dir-')) {
    const id = Number(s.slice(4))
    return Number.isFinite(id) ? { kind: 'dir', id } : null
  }
  if (s.startsWith('project-')) {
    const id = Number(s.slice(8))
    return Number.isFinite(id) ? { kind: 'project', id } : null
  }
  return null
}

function resolveParentIdForNew(
  selectedKey: React.Key | null,
  dtoByKey: Map<string, ProjectChildDto>,
): number {
  if (!selectedKey) return 0
  const s = String(selectedKey)
  const dto = dtoByKey.get(s)
  if (!dto) return 0
  if (!dto.leaf) return dto.id
  return dto.parentId ?? 0
}

function syntheticRootDto(): ProjectChildDto {
  return {
    id: 0,
    name: '我的工程',
    parentId: 0,
    leaf: false,
    delete: false,
  }
}

export function ProjectWorkspaceTree({
  onSelectProject,
  currentProjectId,
  onCurrentProjectRemoved,
}: ProjectWorkspaceTreeProps) {
  const { message, modal } = App.useApp()
  const isRunning = useProjectStore((s) => s.flowData.isRunning)
  const storeCurrentProjectId = useProjectStore((s) => s.currentProjectId)
  const resetFlowWorkspace = useProjectStore((s) => s.resetFlowWorkspace)

  const [treeData, setTreeData] = useState<DataNode[]>([])
  const [rootLoading, setRootLoading] = useState(true)
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([ROOT_KEY])
  const dtoByKeyRef = useRef<Map<string, ProjectChildDto>>(new Map())

  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [createCatOpen, setCreateCatOpen] = useState(false)
  const [createProjectForm] = Form.useForm<{ name: string; description?: string }>()
  const [createCatForm] = Form.useForm<{ name: string }>()
  const [createSubmitting, setCreateSubmitting] = useState(false)

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; treeKey: React.Key } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 })

  const [saveAsSourceId, setSaveAsSourceId] = useState<number | null>(null)

  const [editDescOpen, setEditDescOpen] = useState(false)
  const [editDescProjectId, setEditDescProjectId] = useState<number | null>(null)
  const [editDescLoading, setEditDescLoading] = useState(false)
  const [editDescForm] = Form.useForm<{ description: string }>()

  const loadRoot = useCallback(async () => {
    setRootLoading(true)
    try {
      const list = await fetchProjectChildren(0)
      const map = new Map<string, ProjectChildDto>()
      map.set(ROOT_KEY, syntheticRootDto())
      const children = mapChildren(list, map)
      dtoByKeyRef.current = map
      setTreeData([
        {
          key: ROOT_KEY,
          title: '我的工程',
          isLeaf: false,
          icon: <FolderOutlined />,
          children,
        },
      ])
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载工程目录失败')
      setTreeData([])
    } finally {
      setRootLoading(false)
    }
  }, [message])

  useEffect(() => {
    void loadRoot()
  }, [loadRoot])

  const reloadDirChildren = useCallback(async (nodeKey: React.Key, documentId: number) => {
    const list = await fetchProjectChildren(documentId)
    const nextMap = dtoByKeyRef.current
    const children = mapChildren(list, nextMap)
    setTreeData((t) => updateTreeData(t, nodeKey, children))
  }, [])

  const loadData = useCallback(
    async (node: EventDataNode<DataNode>) => {
      const parsed = parseKey(node.key)
      if (!parsed || parsed.kind !== 'dir') return
      try {
        await reloadDirChildren(node.key, parsed.id)
      } catch (e) {
        message.error(e instanceof Error ? e.message : '加载子目录失败')
      }
    },
    [message, reloadDirChildren],
  )

  useEffect(() => {
    if (!ctxMenu) return
    const pad = 8
    const mw = 200
    const mh = 280
    let left = ctxMenu.x
    let top = ctxMenu.y
    if (left + mw > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - mw - pad)
    if (top + mh > window.innerHeight - pad) top = Math.max(pad, window.innerHeight - mh - pad)
    setMenuPos({ left, top })
  }, [ctxMenu])

  useEffect(() => {
    if (!ctxMenu) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t)) return
      const el = t instanceof Element ? t : null
      if (el?.closest?.('.ant-menu-submenu-popup')) return
      setCtxMenu(null)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [ctxMenu])

  useEffect(() => {
    if (!ctxMenu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctxMenu])

  const closeCtx = useCallback(() => setCtxMenu(null), [])

  const titleRender = useCallback(
    (node: DataNode) => {
      const parsed = parseKey(node.key)
      const label = typeof node.title === 'string' ? node.title : String(node.key)
      const isCurrent =
        parsed?.kind === 'project' && currentProjectId !== null && parsed.id === currentProjectId
      const content = isCurrent ? <Text strong>{label}</Text> : label
      return (
        <span
          role="presentation"
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setSelectedKeys([node.key])
            setCtxMenu({ x: e.clientX, y: e.clientY, treeKey: node.key })
          }}
        >
          {content}
        </span>
      )
    },
    [currentProjectId],
  )

  const onTreeSelect = useCallback(
    (keys: React.Key[], info: { node: EventDataNode<DataNode> }) => {
      setSelectedKeys(keys)
      const parsed = parseKey(info.node.key)
      if (parsed?.kind === 'project') {
        const dto = dtoByKeyRef.current.get(String(info.node.key))
        const workflowProjectId = dto?.projectEntityId ?? null
        if (workflowProjectId == null) {
          message.error('工程列表项缺少 project.id，无法请求工程详情（请检查后端是否返回嵌套 project）')
          return
        }
        void Promise.resolve(onSelectProject(workflowProjectId)).catch((e: unknown) => {
          message.error(e instanceof Error ? e.message : '加载工程失败')
        })
      }
    },
    [message, onSelectProject],
  )

  const parentIdForCreate = resolveParentIdForNew(selectedKeys[0] ?? null, dtoByKeyRef.current)

  const submitCreateProject = useCallback(async () => {
    const v = await createProjectForm.validateFields()
    setCreateSubmitting(true)
    try {
      const newId = await createProject({
        name: v.name.trim(),
        parentId: parentIdForCreate,
        description: v.description?.trim() || undefined,
      })
      message.success('已创建工程')
      setCreateProjectOpen(false)
      createProjectForm.resetFields()
      await loadRoot()
      if (newId !== null && newId > 0) {
        setSelectedKeys([`project-${newId}`])
        await Promise.resolve(onSelectProject(newId))
      }
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      setCreateSubmitting(false)
    }
  }, [createProjectForm, loadRoot, message, onSelectProject, parentIdForCreate])

  const submitCreateCat = useCallback(async () => {
    const v = await createCatForm.validateFields()
    setCreateSubmitting(true)
    try {
      await createProjectCategory({
        name: v.name.trim(),
        parentId: parentIdForCreate,
      })
      message.success('已创建分类')
      setCreateCatOpen(false)
      createCatForm.resetFields()
      await loadRoot()
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      setCreateSubmitting(false)
    }
  }, [createCatForm, loadRoot, message, parentIdForCreate])

  const openEditDescription = useCallback(
    async (projectId: number) => {
      closeCtx()
      setEditDescProjectId(projectId)
      setEditDescOpen(true)
      setEditDescLoading(true)
      editDescForm.resetFields()
      try {
        const d = await fetchProjectDetail(projectId)
        editDescForm.setFieldsValue({
          description: typeof d.description === 'string' ? d.description : '',
        })
      } catch (e) {
        message.error(e instanceof Error ? e.message : '加载工程信息失败')
        setEditDescOpen(false)
      } finally {
        setEditDescLoading(false)
      }
    },
    [closeCtx, editDescForm, message],
  )

  const submitEditDescription = useCallback(async () => {
    if (editDescProjectId === null) return
    const v = await editDescForm.validateFields()
    setEditDescLoading(true)
    try {
      await patchProjectDescription(editDescProjectId, v.description.trim())
      message.success('描述已更新')
      setEditDescOpen(false)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setEditDescLoading(false)
    }
  }, [editDescForm, editDescProjectId, message])

  const confirmDeleteCategory = useCallback(
    (catId: number) => {
      closeCtx()
      modal.confirm({
        title: '删除分类',
        content: '此操作将删除该分类（需为空目录）。是否继续？',
        okText: '删除',
        okType: 'danger',
        onOk: async () => {
          try {
            await deleteProjectCategory(catId)
            message.success('已删除分类')
            await loadRoot()
          } catch (e) {
            message.error(e instanceof Error ? e.message : '删除失败')
          }
        },
      })
    },
    [closeCtx, loadRoot, message, modal],
  )

  const confirmDeleteProject = useCallback(
    (projectId: number) => {
      if (isRunning) {
        message.warning('流程运行中，请稍后再试')
        return
      }
      closeCtx()
      modal.confirm({
        title: '删除工程',
        content: '此操作将删除该工程，是否继续？',
        okText: '删除',
        okType: 'danger',
        onOk: async () => {
          try {
            await deleteProject(projectId)
            message.success('已删除工程')
            if (storeCurrentProjectId === projectId) {
              resetFlowWorkspace()
              onCurrentProjectRemoved?.()
            }
            await loadRoot()
          } catch (e) {
            message.error(e instanceof Error ? e.message : '删除失败')
          }
        },
      })
    },
    [
      closeCtx,
      isRunning,
      loadRoot,
      message,
      modal,
      onCurrentProjectRemoved,
      resetFlowWorkspace,
      storeCurrentProjectId,
    ],
  )

  const treeMenuItems: MenuProps['items'] = useMemo(() => {
    if (!ctxMenu) return []
    const ctxParsed = parseKey(ctxMenu.treeKey)
    if (!ctxParsed) return []
    if (ctxParsed.kind === 'dir') {
      const id = ctxParsed.id
      const items: MenuProps['items'] = [
        {
          key: 'ctx-new-project',
          label: '新建工程',
          icon: <FileAddOutlined />,
        },
        {
          key: 'ctx-new-cat',
          label: '新建子分类',
          icon: <FolderAddOutlined />,
        },
      ]
      if (id !== 0) {
        items.push({
          key: 'ctx-del-cat',
          label: '删除分类',
          icon: <DeleteOutlined />,
          danger: true,
        })
      }
      return items
    }
    const projectId = ctxParsed.id
    return [
      {
        key: 'ctx-edit-desc',
        label: '修改描述',
        icon: <EditOutlined />,
      },
      {
        key: 'ctx-save-as-project',
        label: '另存为工程',
        icon: <CopyOutlined />,
        disabled: isRunning && storeCurrentProjectId === projectId,
      },
      {
        key: 'ctx-del-project',
        label: '删除工程',
        icon: <DeleteOutlined />,
        danger: true,
        disabled: isRunning,
      },
    ]
  }, [ctxMenu, isRunning, storeCurrentProjectId])

  const onTreeMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(
    ({ key, domEvent }) => {
      domEvent.stopPropagation()
      if (!ctxMenu) return
      const ctxParsed = parseKey(ctxMenu.treeKey)
      if (!ctxParsed) return
      if (ctxParsed.kind === 'dir') {
        const parentId = ctxParsed.id
        if (key === 'ctx-new-project') {
          closeCtx()
          setSelectedKeys([ctxMenu.treeKey])
          setCreateProjectOpen(true)
          return
        }
        if (key === 'ctx-new-cat') {
          closeCtx()
          setSelectedKeys([ctxMenu.treeKey])
          setCreateCatOpen(true)
          return
        }
        if (key === 'ctx-del-cat' && parentId !== 0) {
          confirmDeleteCategory(parentId)
        }
        return
      }
      const pid = ctxParsed.id
      if (key === 'ctx-edit-desc') {
        void openEditDescription(pid)
        return
      }
      if (key === 'ctx-save-as-project') {
        closeCtx()
        setSaveAsSourceId(pid)
        return
      }
      if (key === 'ctx-del-project') {
        confirmDeleteProject(pid)
      }
    },
    [ctxMenu, closeCtx, confirmDeleteCategory, confirmDeleteProject, openEditDescription],
  )

  return (
    <>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Space wrap size="small">
          <Button size="small" icon={<ReloadOutlined />} loading={rootLoading} onClick={() => void loadRoot()}>
            刷新
          </Button>
          <Button size="small" type="primary" onClick={() => setCreateProjectOpen(true)}>
            新建工程
          </Button>
          <Button size="small" onClick={() => setCreateCatOpen(true)}>
            新建分类
          </Button>
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          父目录：{parentIdForCreate === 0 ? '根目录' : `ID ${parentIdForCreate}`}（先选中树中目录或工程）；右键节点打开菜单
        </Text>
        <Tree
          showIcon
          blockNode
          height={420}
          virtual
          defaultExpandedKeys={[ROOT_KEY]}
          treeData={treeData}
          loadData={loadData}
          selectedKeys={selectedKeys}
          titleRender={titleRender}
          onSelect={onTreeSelect}
        />
      </Space>

      {ctxMenu ? (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: menuPos.left,
            top: menuPos.top,
            zIndex: 2000,
            minWidth: 180,
            background: '#fff',
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgb(0 0 0 / 12%)',
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Menu
            mode="vertical"
            selectable={false}
            items={treeMenuItems}
            onClick={onTreeMenuClick}
            style={{ border: 'none' }}
            getPopupContainer={() => menuRef.current ?? document.body}
          />
        </div>
      ) : null}

      <Modal
        title="新建工程"
        open={createProjectOpen}
        onCancel={() => setCreateProjectOpen(false)}
        onOk={() => void submitCreateProject()}
        confirmLoading={createSubmitting}
        destroyOnClose
      >
        <Form form={createProjectForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="name" label="工程名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="工程名" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建分类"
        open={createCatOpen}
        onCancel={() => setCreateCatOpen(false)}
        onOk={() => void submitCreateCat()}
        confirmLoading={createSubmitting}
        destroyOnClose
      >
        <Form form={createCatForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="分类名" />
          </Form.Item>
        </Form>
      </Modal>

      <SaveAsProjectDialog
        open={saveAsSourceId != null}
        sourceProjectId={saveAsSourceId}
        onClose={() => setSaveAsSourceId(null)}
        onSuccessRefreshTree={() => void loadRoot()}
      />

      <Modal
        title="修改工程描述"
        open={editDescOpen}
        onCancel={() => setEditDescOpen(false)}
        onOk={() => void submitEditDescription()}
        confirmLoading={editDescLoading}
        destroyOnClose
      >
        <Form form={editDescForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} placeholder="工程描述" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
