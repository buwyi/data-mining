import { App, Card, Form, Input, Menu, Modal, Tree, Typography } from 'antd'
import type { MenuProps, TreeProps } from 'antd'
import type { DataNode, EventDataNode } from 'antd/es/tree'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createCat,
  deleteCat,
  deleteComponent,
  fetchCatChildren,
  fetchComponentDefinition,
  patchCatName,
} from '../../api/componentApi'
import { TIPDM_COMPONENT_DRAG_MIME } from '../../constants/tipdmDrag'
import { useI18n } from '../../i18n/I18nProvider'
import type { CatChildNodeDto, ComponentDefinitionDto } from '../../types/component'
import { ComponentDetailDrawer } from './ComponentDetailDrawer'
import { ComponentScriptModal } from './ComponentScriptModal'

const { Text } = Typography

/** 管理页（`/home/components`）左键选中树节点时，供右侧工作台展示 */
export type ComponentWorkbenchSelection =
  | null
  | { kind: 'cat'; catId: number; title: string }
  | { kind: 'comp'; componentId: number; title: string }

export type ComponentLibraryTreeHandle = {
  openDetail: (componentId: number) => Promise<void>
  openScript: (componentId: number) => void
}

export type ComponentLibraryTreeProps = {
  systemRootCatId: number
  personalRootCatId: number
  /**
   * `manage`：系统组件页，完整右键菜单。
   * `palette`：工程页侧栏，组件节点可拖到画布。
   */
  variant?: 'manage' | 'palette'
  /** 仅 `manage`：单选变化时回调（与右键菜单无关） */
  onWorkbenchSelectionChange?: (selection: ComponentWorkbenchSelection) => void
}

type CtxTarget =
  | { kind: 'cat'; key: React.Key; catId: number; title: string }
  | { kind: 'comp'; key: React.Key; componentId: number; title: string }

/** 根节点可用非 `cat-{id}` 的 key，通过 `catLoadId` 指定请求 `GET /api/cat/{id}/childs` 的 id */
type CatTreeDataNode = DataNode & { catLoadId?: number }

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

function resolveCatApiId(node: EventDataNode<DataNode>): number | null {
  const ext = node as EventDataNode<CatTreeDataNode>
  if (typeof ext.catLoadId === 'number' && Number.isFinite(ext.catLoadId)) return ext.catLoadId
  const p = parseTreeKey(node.key)
  return p?.kind === 'cat' ? p.id : null
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

export const ComponentLibraryTree = forwardRef<ComponentLibraryTreeHandle, ComponentLibraryTreeProps>(
  function ComponentLibraryTree(
    {
      systemRootCatId,
      personalRootCatId,
      variant = 'manage',
      onWorkbenchSelectionChange,
    }: ComponentLibraryTreeProps,
    ref,
  ) {
  const { t } = useI18n()
  const { message, modal } = App.useApp()
  const [treeData, setTreeData] = useState<DataNode[]>([])
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [ctx, setCtx] = useState<{ x: number; y: number; target: CtxTarget } | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<ComponentDefinitionDto | null>(null)
  const [detailComponentId, setDetailComponentId] = useState<number | null>(null)

  const [scriptOpen, setScriptOpen] = useState(false)
  const [scriptComponentId, setScriptComponentId] = useState<number | null>(null)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ key: React.Key; catId: number } | null>(null)
  const [renameForm] = Form.useForm<{ name: string }>()

  const [createOpen, setCreateOpen] = useState(false)
  const [createTarget, setCreateTarget] = useState<{ parentKey: React.Key; parentId: number } | null>(null)
  const [createForm] = Form.useForm<{ name: string }>()

  useEffect(() => {
    if (variant === 'palette') {
      const cid = systemRootCatId
      const root: CatTreeDataNode = {
        title: t('componentTree.root.system'),
        key: `pal-root-${cid}`,
        isLeaf: false,
        catLoadId: cid,
      }
      setTreeData([root])
    } else {
      const sys: CatTreeDataNode = {
        title: t('componentTree.root.system'),
        key: `mg-sys-${systemRootCatId}`,
        isLeaf: false,
        catLoadId: systemRootCatId,
      }
      const per: CatTreeDataNode = {
        title: t('componentTree.root.personal'),
        key: `mg-per-${personalRootCatId}`,
        isLeaf: false,
        catLoadId: personalRootCatId,
      }
      setTreeData([sys, per])
    }
    if (variant === 'manage') {
      setSelectedKeys([])
      onWorkbenchSelectionChange?.(null)
    }
  }, [onWorkbenchSelectionChange, personalRootCatId, systemRootCatId, t, variant])

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
      const catId = resolveCatApiId(node)
      if (catId == null) return
      try {
        await reloadCatChildren(node.key, catId)
      } catch (e) {
        message.error(e instanceof Error ? e.message : t('componentTree.msg.loadChildrenFailed'))
      }
    },
    [message, reloadCatChildren, t],
  )

  const onRightClick = useCallback(
    (info: { event: React.MouseEvent; node: EventDataNode<DataNode> }) => {
      info.event.preventDefault()
      const parsed = parseTreeKey(info.node.key)
      const title = getTitleFromNode(info.node)
      const catId = resolveCatApiId(info.node)
      if (catId != null) {
        setCtx({
          x: info.event.clientX,
          y: info.event.clientY,
          target: { kind: 'cat', key: info.node.key, catId, title },
        })
        return
      }
      if (!parsed || parsed.kind !== 'comp') return
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
      setDetailComponentId(componentId)
      setDetailOpen(true)
      setDetailLoading(true)
      setDetailData(null)
      try {
        const dto = await fetchComponentDefinition(componentId)
        setDetailData(dto)
      } catch (e) {
        message.error(e instanceof Error ? e.message : t('componentTree.msg.detailLoadFailed'))
        setDetailOpen(false)
        setDetailComponentId(null)
      } finally {
        setDetailLoading(false)
      }
    },
    [message, t],
  )

  const reloadDetail = useCallback(async () => {
    if (detailComponentId == null) return
    setDetailLoading(true)
    try {
      const dto = await fetchComponentDefinition(detailComponentId)
      setDetailData(dto)
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('componentTree.msg.detailRefreshFailed'))
    } finally {
      setDetailLoading(false)
    }
  }, [detailComponentId, message, t])

  useImperativeHandle(
    ref,
    () => ({
      openDetail: (componentId: number) => openDetail(componentId),
      openScript: (componentId: number) => {
        setScriptComponentId(componentId)
        setScriptOpen(true)
      },
    }),
    [openDetail],
  )

  const onTreeSelect = useCallback<NonNullable<TreeProps['onSelect']>>(
    (keys, info) => {
      if (variant !== 'manage') return
      setSelectedKeys(keys)
      const key = keys[0]
      if (key == null) {
        onWorkbenchSelectionChange?.(null)
        return
      }
      const parsed = parseTreeKey(key)
      const title = getTitleFromNode(info.node)
      const catId = resolveCatApiId(info.node)
      if (parsed?.kind === 'comp') {
        onWorkbenchSelectionChange?.({ kind: 'comp', componentId: parsed.id, title })
      } else if (catId != null) {
        onWorkbenchSelectionChange?.({ kind: 'cat', catId, title })
      } else {
        onWorkbenchSelectionChange?.(null)
      }
    },
    [variant, onWorkbenchSelectionChange],
  )

  const menuItems: MenuProps['items'] = useMemo(() => {
    if (!ctx) return []
    if (ctx.target.kind === 'cat') {
      return [
        { key: 'refresh', label: t('componentTree.menu.refresh') },
        { key: 'newCat', label: t('componentTree.menu.newChildCat') },
        { key: 'rename', label: t('componentTree.menu.rename') },
        { type: 'divider' },
        { key: 'delCat', label: t('componentTree.menu.deleteCat'), danger: true },
      ]
    }
    return [
      { key: 'detail', label: t('componentsPage.btn.detail') },
      { key: 'script', label: t('componentTree.menu.editScript') },
      { type: 'divider' },
      { key: 'delComp', label: t('componentTree.menu.deleteComp'), danger: true },
    ]
  }, [ctx, t])

  const runMenuAction = useCallback(
    async (key: string) => {
      if (!ctx) return
      const { target } = ctx
      setCtx(null)

      if (target.kind === 'cat') {
        if (key === 'refresh') {
          try {
            await reloadCatChildren(target.key, target.catId)
            message.success(t('componentTree.msg.refreshed'))
          } catch (e) {
            message.error(e instanceof Error ? e.message : t('componentTree.msg.refreshFailed'))
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
            title: t('componentTree.confirm.delCatTitle'),
            content: t('componentTree.confirm.delCatBody', { title: target.title }),
            okText: t('componentTree.confirm.okDelete'),
            okType: 'danger',
            onOk: async () => {
              try {
                await deleteCat(target.catId)
                setTreeData((t) => removeNodeByKey(t, target.key))
                setSelectedKeys((sk) => {
                  if (sk[0] === target.key) {
                    onWorkbenchSelectionChange?.(null)
                    return []
                  }
                  return sk
                })
                message.success(t('componentTree.msg.catDeleted'))
              } catch (e) {
                message.error(e instanceof Error ? e.message : t('componentTree.msg.deleteFailed'))
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
          title: t('componentTree.confirm.delCompTitle'),
          content: t('componentTree.confirm.delCompBody', { title: target.title }),
          okText: t('componentTree.confirm.okDelete'),
          okType: 'danger',
            onOk: async () => {
            try {
              await deleteComponent(target.componentId)
              setTreeData((t) => removeNodeByKey(t, target.key))
              setSelectedKeys((sk) => {
                if (sk[0] === target.key) {
                  onWorkbenchSelectionChange?.(null)
                  return []
                }
                return sk
              })
              message.success(t('componentTree.msg.compDeleted'))
            } catch (e) {
              message.error(e instanceof Error ? e.message : t('componentTree.msg.deleteFailed'))
              throw e
            }
          },
        })
      }
    },
    [
      ctx,
      createForm,
      message,
      modal,
      onWorkbenchSelectionChange,
      openDetail,
      reloadCatChildren,
      renameForm,
      t,
    ],
  )

  const onMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
    domEvent.stopPropagation()
    void runMenuAction(String(key))
  }

  const submitRename = async () => {
    if (!renameTarget) return
    const name = renameForm.getFieldValue('name')?.trim()
    if (!name) {
      message.warning(t('componentTree.warn.enterName'))
      return
    }
    try {
      await patchCatName(renameTarget.catId, name)
      setTreeData((prev) => renameNodeTitle(prev, renameTarget.key, name))
      message.success(t('componentTree.msg.renamed'))
      setRenameOpen(false)
      setRenameTarget(null)
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('componentTree.msg.renameFailed'))
    }
  }

  const submitCreate = async () => {
    if (!createTarget) return
    const name = createForm.getFieldValue('name')?.trim()
    if (!name) {
      message.warning(t('componentTree.warn.enterCatName'))
      return
    }
    try {
      await createCat({ name, parentId: createTarget.parentId })
      message.success(t('componentTree.msg.childCatCreated'))
      setCreateOpen(false)
      await reloadCatChildren(createTarget.parentKey, createTarget.parentId)
      setCreateTarget(null)
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('componentTree.msg.createFailed'))
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
      title={variant === 'palette' ? t('componentTree.card.palette') : t('componentTree.card.default')}
      bordered={false}
      styles={{ body: { paddingTop: 8 } }}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
        {variant === 'palette' ? t('componentTree.hint.palette') : t('componentTree.hint.manage')}
      </Text>
      <div onMouseDown={(e) => e.stopPropagation()}>
        <Tree
          blockNode
          showLine
          loadData={(n) => loadData(n as EventDataNode<DataNode>)}
          treeData={treeData}
          titleRender={titleRender}
          onRightClick={onRightClick}
          {...(variant === 'manage'
            ? { selectedKeys, onSelect: onTreeSelect }
            : {})}
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
        componentId={detailComponentId}
        onClose={() => {
          setDetailOpen(false)
          setDetailData(null)
          setDetailComponentId(null)
        }}
        onReloadDetail={reloadDetail}
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
        title={t('componentTree.renameModalTitle')}
        open={renameOpen}
        onCancel={() => {
          setRenameOpen(false)
          setRenameTarget(null)
        }}
        onOk={() => void submitRename()}
        destroyOnHidden
      >
        <Form form={renameForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="name"
            label={t('componentTree.field.name')}
            rules={[{ required: true, message: t('componentTree.warn.enterName') }]}
          >
            <Input allowClear />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('componentTree.createModalTitle')}
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false)
          setCreateTarget(null)
        }}
        onOk={() => void submitCreate()}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item
            name="name"
            label={t('componentTree.field.catName')}
            rules={[{ required: true, message: t('componentTree.warn.enterCatName') }]}
          >
            <Input allowClear placeholder={t('componentTree.placeholder.newCat')} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
)

ComponentLibraryTree.displayName = 'ComponentLibraryTree'
