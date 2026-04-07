import { App, Card, Form, Input, Menu, Modal, Tree, Typography } from 'antd'
import type { MenuProps } from 'antd'
import type { DataNode, EventDataNode } from 'antd/es/tree'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  createCat,
  deleteCat,
  deleteComponent,
  fetchCatChildren,
  fetchComponentDefinition,
  patchCatName,
} from '../../api/componentApi'
import { TIPDM_COMPONENT_DRAG_MIME } from '../../constants/tipdmDrag'
import type { CatChildNodeDto, ComponentDefinitionDto } from '../../types/component'
import { ComponentDetailDrawer } from './ComponentDetailDrawer'
import { ComponentScriptModal } from './ComponentScriptModal'

const { Text } = Typography

export type ComponentLibraryTreeProps = {
  systemRootCatId: number
  personalRootCatId: number
  /**
   * `manage`：系统组件页，完整右键菜单。
   * `palette`：工程页侧栏，组件节点可拖到画布。
   */
  variant?: 'manage' | 'palette'
}

type CtxTarget =
  | { kind: 'cat'; key: React.Key; catId: number; title: string }
  | { kind: 'comp'; key: React.Key; componentId: number; title: string }

function parseTreeKey(key: React.Key): { kind: 'cat' | 'comp'; id: number } | null {
  const s = String(key)
  if (s.startsWith('cat-')) {
    const id = Number(s.slice(4))
    return Number.isFinite(id) ? { kind: 'cat', id } : null
  }
  if (s.startsWith('comp-')) {
    const id = Number(s.slice(5))
    return Number.isFinite(id) ? { kind: 'comp', id } : null
  }
  return null
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

function removeNodeByKey(list: DataNode[], nodeKey: React.Key): DataNode[] {
  return list
    .filter((n) => n.key !== nodeKey)
    .map((n) => (n.children?.length ? { ...n, children: removeNodeByKey(n.children, nodeKey) } : n))
}

function renameNodeTitle(list: DataNode[], nodeKey: React.Key, title: string): DataNode[] {
  return list.map((n) => {
    if (n.key === nodeKey) return { ...n, title }
    if (n.children?.length) return { ...n, children: renameNodeTitle(n.children, nodeKey, title) }
    return n
  })
}

function mapListToNodes(items: CatChildNodeDto[]): DataNode[] {
  return items.map((item) => {
    const isComponent = item.component === true
    return {
      key: isComponent ? `comp-${item.id}` : `cat-${item.id}`,
      title: item.name,
      isLeaf: isComponent,
    }
  })
}

function getTitleFromNode(node: EventDataNode<DataNode>): string {
  const t = node.title
  if (typeof t === 'string') return t
  return String(node.key)
}

function resolveTreeTitle(node: DataNode): ReactNode {
  const t = node.title
  if (typeof t === 'function') return t(node)
  return t
}

export function ComponentLibraryTree({
  systemRootCatId,
  personalRootCatId,
  variant = 'manage',
}: ComponentLibraryTreeProps) {
  const { message, modal } = App.useApp()
  const [treeData, setTreeData] = useState<DataNode[]>([])
  const [ctx, setCtx] = useState<{ x: number; y: number; target: CtxTarget } | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<ComponentDefinitionDto | null>(null)

  const [scriptOpen, setScriptOpen] = useState(false)
  const [scriptComponentId, setScriptComponentId] = useState<number | null>(null)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ key: React.Key; catId: number } | null>(null)
  const [renameForm] = Form.useForm<{ name: string }>()

  const [createOpen, setCreateOpen] = useState(false)
  const [createTarget, setCreateTarget] = useState<{ parentKey: React.Key; parentId: number } | null>(null)
  const [createForm] = Form.useForm<{ name: string }>()

  useEffect(() => {
    setTreeData([
      { title: '系统组件', key: `cat-${systemRootCatId}`, isLeaf: false },
      { title: '我的组件', key: `cat-${personalRootCatId}`, isLeaf: false },
    ])
  }, [systemRootCatId, personalRootCatId])

  useEffect(() => {
    if (!ctx) return
    const onDown = () => setCtx(null)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ctx])

  const reloadCatChildren = useCallback(async (nodeKey: React.Key, catId: number) => {
    const list = await fetchCatChildren(catId)
    const children = mapListToNodes(list)
    setTreeData((t) => updateTreeData(t, nodeKey, children))
  }, [])

  const loadData = useCallback(
    async (node: EventDataNode<DataNode>) => {
      const parsed = parseTreeKey(node.key)
      if (!parsed || parsed.kind !== 'cat') return
      try {
        await reloadCatChildren(node.key, parsed.id)
      } catch (e) {
        message.error(e instanceof Error ? e.message : '加载失败')
      }
    },
    [message, reloadCatChildren],
  )

  const onRightClick = useCallback(
    (info: { event: React.MouseEvent; node: EventDataNode<DataNode> }) => {
      info.event.preventDefault()
      const parsed = parseTreeKey(info.node.key)
      if (!parsed) return
      const title = getTitleFromNode(info.node)
      if (parsed.kind === 'cat') {
        setCtx({
          x: info.event.clientX,
          y: info.event.clientY,
          target: { kind: 'cat', key: info.node.key, catId: parsed.id, title },
        })
        return
      }
      setCtx({
        x: info.event.clientX,
        y: info.event.clientY,
        target: { kind: 'comp', key: info.node.key, componentId: parsed.id, title },
      })
    },
    [],
  )

  const openDetail = useCallback(
    async (componentId: number) => {
      setDetailOpen(true)
      setDetailLoading(true)
      setDetailData(null)
      try {
        const dto = await fetchComponentDefinition(componentId)
        setDetailData(dto)
      } catch (e) {
        message.error(e instanceof Error ? e.message : '加载详情失败')
        setDetailOpen(false)
      } finally {
        setDetailLoading(false)
      }
    },
    [message],
  )

  const menuItems: MenuProps['items'] = useMemo(() => {
    if (!ctx) return []
    if (ctx.target.kind === 'cat') {
      return [
        { key: 'refresh', label: '刷新' },
        { key: 'newCat', label: '新建子分类' },
        { key: 'rename', label: '重命名' },
        { type: 'divider' },
        { key: 'delCat', label: '删除分类', danger: true },
      ]
    }
    return [
      { key: 'detail', label: '查看详情' },
      { key: 'script', label: '编辑脚本' },
      { type: 'divider' },
      { key: 'delComp', label: '删除组件', danger: true },
    ]
  }, [ctx])

  const runMenuAction = useCallback(
    async (key: string) => {
      if (!ctx) return
      const { target } = ctx
      setCtx(null)

      if (target.kind === 'cat') {
        if (key === 'refresh') {
          try {
            await reloadCatChildren(target.key, target.catId)
            message.success('已刷新')
          } catch (e) {
            message.error(e instanceof Error ? e.message : '刷新失败')
          }
          return
        }
        if (key === 'newCat') {
          setCreateTarget({ parentKey: target.key, parentId: target.catId })
          createForm.resetFields()
          setCreateOpen(true)
          return
        }
        if (key === 'rename') {
          setRenameTarget({ key: target.key, catId: target.catId })
          renameForm.setFieldsValue({ name: target.title })
          setRenameOpen(true)
          return
        }
        if (key === 'delCat') {
          modal.confirm({
            title: '删除分类',
            content: `确定删除「${target.title}」吗？若其下仍有子分类或组件，可能失败。`,
            okText: '删除',
            okType: 'danger',
            onOk: async () => {
              try {
                await deleteCat(target.catId)
                setTreeData((t) => removeNodeByKey(t, target.key))
                message.success('已删除分类')
              } catch (e) {
                message.error(e instanceof Error ? e.message : '删除失败')
                throw e
              }
            },
          })
        }
        return
      }

      if (key === 'detail') {
        await openDetail(target.componentId)
        return
      }
      if (key === 'script') {
        setScriptComponentId(target.componentId)
        setScriptOpen(true)
        return
      }
      if (key === 'delComp') {
        modal.confirm({
          title: '删除组件',
          content: `确定删除组件「${target.title}」吗？`,
          okText: '删除',
          okType: 'danger',
          onOk: async () => {
            try {
              await deleteComponent(target.componentId)
              setTreeData((t) => removeNodeByKey(t, target.key))
              message.success('已删除组件')
            } catch (e) {
              message.error(e instanceof Error ? e.message : '删除失败')
              throw e
            }
          },
        })
      }
    },
    [ctx, createForm, message, modal, openDetail, reloadCatChildren, renameForm],
  )

  const onMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
    domEvent.stopPropagation()
    void runMenuAction(String(key))
  }

  const submitRename = async () => {
    if (!renameTarget) return
    const name = renameForm.getFieldValue('name')?.trim()
    if (!name) {
      message.warning('请输入名称')
      return
    }
    try {
      await patchCatName(renameTarget.catId, name)
      setTreeData((t) => renameNodeTitle(t, renameTarget.key, name))
      message.success('已重命名')
      setRenameOpen(false)
      setRenameTarget(null)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '重命名失败')
    }
  }

  const submitCreate = async () => {
    if (!createTarget) return
    const name = createForm.getFieldValue('name')?.trim()
    if (!name) {
      message.warning('请输入分类名称')
      return
    }
    try {
      await createCat({ name, parentId: createTarget.parentId })
      message.success('已新建子分类')
      setCreateOpen(false)
      await reloadCatChildren(createTarget.parentKey, createTarget.parentId)
      setCreateTarget(null)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '新建失败')
    }
  }

  const titleRender = useCallback(
    (node: DataNode) => {
      const parsed = parseTreeKey(node.key)
      if (variant === 'palette' && parsed?.kind === 'comp') {
        return (
          <span
            draggable
            onDragStart={(e) => {
              e.stopPropagation()
              e.dataTransfer.setData(TIPDM_COMPONENT_DRAG_MIME, String(parsed.id))
              e.dataTransfer.setData('text/plain', String(parsed.id))
              e.dataTransfer.effectAllowed = 'copy'
            }}
            style={{ cursor: 'grab' }}
          >
            {resolveTreeTitle(node)}
          </span>
        )
      }
      return <span>{resolveTreeTitle(node)}</span>
    },
    [variant],
  )

  return (
    <Card
      size="small"
      title={variant === 'palette' ? '组件库（拖入画布）' : '组件库'}
      bordered={false}
      styles={{ body: { paddingTop: 8 } }}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
        {variant === 'palette'
          ? '展开分类后，按住组件名称拖到右侧流程图空白处即可新建节点（需已加载工程）。'
          : '右键分类或组件可刷新、管理分类或查看详情与编辑脚本。根节点 ID 可在 config.json 或环境变量中配置。'}
      </Text>
      <div onMouseDown={(e) => e.stopPropagation()}>
        <Tree
          blockNode
          showLine
          loadData={(n) => loadData(n as EventDataNode<DataNode>)}
          treeData={treeData}
          titleRender={titleRender}
          onRightClick={onRightClick}
        />
      </div>

      {ctx ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            left: ctx.x,
            top: ctx.y,
            zIndex: 1070,
            minWidth: 160,
            boxShadow: '0 3px 6px -4px rgba(0,0,0,.12), 0 6px 16px 0 rgba(0,0,0,.08)',
            background: 'var(--ant-color-bg-container)',
            borderRadius: 8,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Menu mode="vertical" selectable={false} items={menuItems} onClick={onMenuClick} />
        </div>
      ) : null}

      <ComponentDetailDrawer
        open={detailOpen}
        loading={detailLoading}
        data={detailData}
        onClose={() => {
          setDetailOpen(false)
          setDetailData(null)
        }}
      />

      <ComponentScriptModal
        open={scriptOpen}
        componentId={scriptComponentId}
        onClose={() => {
          setScriptOpen(false)
          setScriptComponentId(null)
        }}
        onSaved={() => {
          if (scriptComponentId != null) void openDetail(scriptComponentId)
        }}
      />

      <Modal
        title="重命名分类"
        open={renameOpen}
        onCancel={() => {
          setRenameOpen(false)
          setRenameTarget(null)
        }}
        onOk={() => void submitRename()}
        destroyOnHidden
      >
        <Form form={renameForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input allowClear />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建子分类"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false)
          setCreateTarget(null)
        }}
        onOk={() => void submitCreate()}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input allowClear placeholder="新分类名称" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
