import {
  App,
  AutoComplete,
  Button,
  Checkbox,
  Collapse,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Typography,
} from 'antd'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  deleteComponentElement,
  fetchAlgorithmList,
  updateComponentDefinition,
} from '../../api/componentApi'
import { ComponentElementEditModal } from '../../components/ComponentElementEditModal'
import { ComponentIoPortsEditor } from '../../components/ComponentIoPortsEditor'
import type { ComponentDefinitionDto } from '../../types/component'
import { buildAlgorithmAutoCompleteOptions } from '../../utils/algorithmListOptions'
import { clonePortRows } from '../../utils/componentPortRows'
import {
  appendElementToTab,
  appendEmptyTab,
  applyPatchToComponentTabs,
  removeTabAt,
  setTabNameAt,
} from '../../utils/componentTabsPatch'
import {
  readElementNumericId,
  readElementUiDescription,
  readTabElements,
  readTabName,
  readTabsArray,
} from '../../utils/componentDefinitionInspect'
import {
  readElementAllowClear,
  readElementMaxLength,
  readElementNumberMax,
  readElementNumberMin,
  readElementNumberStep,
  readElementRexpPattern,
  readElementSelectShowSearch,
  readElementSelectSearchFormMode,
  readElementType,
  readOptionalElementRows,
} from '../../utils/flowNodeTabUtils'
import { parseTipdmOptionString } from '../../utils/tipdmElementOptions'

const { Text, Paragraph } = Typography

export type ComponentDetailDrawerProps = {
  open: boolean
  loading: boolean
  data: ComponentDefinitionDto | null
  /** 当前详情对应的组件 id，用于删除参数后重新拉取定义 */
  componentId: number | null
  onClose: () => void
  onReloadDetail: () => Promise<void>
}

function scriptPreview(script: Record<string, string> | undefined): string {
  if (!script || typeof script !== 'object') return '（无）'
  const main = script.MAIN
  if (typeof main === 'string' && main.trim()) {
    const t = main.trim()
    return t.length > 2000 ? `${t.slice(0, 2000)}…` : t
  }
  try {
    return JSON.stringify(script, null, 2)
  } catch {
    return '（无法展示）'
  }
}

function elementTypeLabel(t: unknown): string {
  const n =
    typeof t === 'number'
      ? t
      : typeof t === 'string' && /^\d+$/.test(t)
        ? Number.parseInt(t, 10)
        : NaN
  if (!Number.isFinite(n)) return '—'
  const map: Record<number, string> = {
    0: '静态展示',
    1: '文本',
    2: '数字',
    3: '下拉',
    4: '多行',
    5: '复杂/JSON',
    6: '单选',
    7: '勾选',
    8: 'SQL',
    9: 'Python',
    10: '脚本',
    11: '结构化(JSON)',
    12: '结构化(JSON)',
    13: '结构化(JSON)',
    14: '结构化(JSON)',
  }
  return map[n] ?? `类型 ${n}`
}

function readElementLabel(el: unknown, index: number): string {
  if (el === null || typeof el !== 'object' || Array.isArray(el)) return `参数 ${index + 1}`
  const o = el as Record<string, unknown>
  if (typeof o.label === 'string' && o.label.trim()) return o.label.trim()
  if (typeof o.name === 'string' && o.name.trim()) return o.name.trim()
  return `参数 ${index + 1}`
}

function elementListMetaDescription(rec: Record<string, unknown>): ReactNode {
  const descTrim = readElementUiDescription(rec).trim()
  const descLine = descTrim.length > 0 ? descTrim : null
  const val = rec.value
  let valueLine: string | null = null
  if (val !== undefined && val !== null) {
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      valueLine = `默认值：${String(val)}`
    } else {
      try {
        const s = JSON.stringify(val)
        valueLine = `默认值：${s.length > 120 ? `${s.slice(0, 120)}…` : s}`
      } catch {
        valueLine = '默认值：（无法展示）'
      }
    }
  }
  const nMin = readElementNumberMin(rec)
  const nMax = readElementNumberMax(rec)
  const nStep = readElementNumberStep(rec)
  const rangeBits: string[] = []
  if (nMin !== undefined) rangeBits.push(`min ${nMin}`)
  if (nMax !== undefined) rangeBits.push(`max ${nMax}`)
  if (nStep !== undefined) rangeBits.push(`step ${nStep}`)
  const rangeLine = rangeBits.length > 0 ? `数字约束：${rangeBits.join('，')}` : null
  const rexpPat = readElementRexpPattern(rec)
  const rexpLine = rexpPat
    ? `rexp：${rexpPat.length > 80 ? `${rexpPat.slice(0, 80)}…` : rexpPat}`
    : null
  const layRows = readOptionalElementRows(rec)
  const layMax = readElementMaxLength(rec)
  const layoutBits: string[] = []
  if (layRows !== undefined) layoutBits.push(`rows ${layRows}`)
  if (layMax !== undefined) layoutBits.push(`maxLength ${layMax}`)
  const layoutLine = layoutBits.length > 0 ? layoutBits.join('，') : null
  let selectLine: string | null = null
  if (readElementType(rec) === 3) {
    const optCount = parseTipdmOptionString(rec.options).length
    const clearOk = readElementAllowClear(rec)
    const mode = readElementSelectSearchFormMode(rec)
    const effectiveSearch = readElementSelectShowSearch(rec, optCount)
    const clearBit = clearOk ? '允许清空' : '禁止清空'
    let searchBit: string
    if (mode === 'on') searchBit = '可搜索（显式开启）'
    else if (mode === 'off') searchBit = '不可搜索（显式关闭）'
    else
      searchBit = `搜索未显式配置（${optCount} 项选项，运行时${effectiveSearch ? '可搜' : '不可搜'}）`
    selectLine = `下拉：${clearBit}；${searchBit}`
  }
  if (!descLine && !valueLine && !rangeLine && !rexpLine && !layoutLine && !selectLine) return null
  return (
    <Space direction="vertical" size={2} style={{ width: '100%' }}>
      {descLine ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {descLine}
        </Text>
      ) : null}
      {layoutLine ? (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {layoutLine}
        </Text>
      ) : null}
      {selectLine ? (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {selectLine}
        </Text>
      ) : null}
      {rexpLine ? (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {rexpLine}
        </Text>
      ) : null}
      {rangeLine ? (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {rangeLine}
        </Text>
      ) : null}
      {valueLine ? (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {valueLine}
        </Text>
      ) : null}
    </Space>
  )
}

type BasicFormValues = {
  name: string
  description: string
  targetAlgorithm: string
  minimumInput: number | null
  allowViewSource: boolean
  enabled: boolean
  engine: string
}

export function ComponentDetailDrawer({
  open,
  loading,
  data,
  componentId,
  onClose,
  onReloadDetail,
}: ComponentDetailDrawerProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<BasicFormValues>()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [savingBasic, setSavingBasic] = useState(false)
  const [algoOptions, setAlgoOptions] = useState<{ value: string; label: string }[]>([])
  const [editTarget, setEditTarget] = useState<{ tabIndex: number; elIndex: number } | null>(null)
  const [createElementTabIndex, setCreateElementTabIndex] = useState<number | null>(null)
  const [renameTabIndex, setRenameTabIndex] = useState<number | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [ioInputsDraft, setIoInputsDraft] = useState<Record<string, unknown>[]>([])
  const [ioOutputsDraft, setIoOutputsDraft] = useState<Record<string, unknown>[]>([])
  const [savingIo, setSavingIo] = useState(false)

  const editInitial = useMemo((): Record<string, unknown> | null => {
    if (!editTarget || !data) return null
    const tabs = readTabsArray(data.tabs)
    const tab = tabs[editTarget.tabIndex]
    const els = readTabElements(tab)
    const raw = els[editTarget.elIndex]
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
    return raw as Record<string, unknown>
  }, [editTarget, data])

  useEffect(() => {
    if (renameTabIndex === null || !data) return
    const tabs = readTabsArray(data.tabs)
    const tab = tabs[renameTabIndex]
    setRenameDraft(readTabName(tab, `页签 ${renameTabIndex + 1}`))
  }, [renameTabIndex, data])

  useEffect(() => {
    if (!open || !data) return
    setIoInputsDraft(clonePortRows(data.inputs))
    setIoOutputsDraft(clonePortRows(data.outputs))
  }, [open, data])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void fetchAlgorithmList()
      .then((rows) => {
        if (!cancelled) setAlgoOptions(buildAlgorithmAutoCompleteOptions(rows))
      })
      .catch(() => {
        if (!cancelled) setAlgoOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!data || componentId === null) return
    const eng =
      data.extra && typeof data.extra === 'object' && data.extra !== null && 'engine' in data.extra
        ? String((data.extra as { engine?: unknown }).engine ?? '')
        : ''
    form.setFieldsValue({
      name: String(data.name ?? ''),
      description: String(data.description ?? ''),
      targetAlgorithm: typeof data.targetAlgorithm === 'string' ? data.targetAlgorithm : '',
      minimumInput:
        typeof data.minimumInput === 'number' && Number.isFinite(data.minimumInput)
          ? data.minimumInput
          : null,
      allowViewSource: data.allowViewSource === true,
      enabled: data.enabled !== false,
      engine: eng,
    })
  }, [data, componentId, form])

  const onSaveBasic = useCallback(async () => {
    if (componentId === null || !data) return
    try {
      const v = await form.validateFields()
      setSavingBasic(true)
      const baseExtra =
        data.extra !== null && typeof data.extra === 'object' && !Array.isArray(data.extra)
          ? { ...(data.extra as Record<string, unknown>) }
          : {}
      const engineTrim = v.engine.trim()
      if (engineTrim) baseExtra.engine = engineTrim
      else delete baseExtra.engine

      const next: ComponentDefinitionDto = {
        ...data,
        name: v.name.trim(),
        description: v.description.trim() || undefined,
        targetAlgorithm: v.targetAlgorithm.trim() || undefined,
        minimumInput:
          v.minimumInput !== null && v.minimumInput !== undefined && Number.isFinite(v.minimumInput)
            ? v.minimumInput
            : undefined,
        allowViewSource: v.allowViewSource,
        enabled: v.enabled,
        extra: Object.keys(baseExtra).length > 0 ? (baseExtra as ComponentDefinitionDto['extra']) : undefined,
      }
      await updateComponentDefinition(componentId, next)
      message.success('已保存组件信息')
      await onReloadDetail()
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSavingBasic(false)
    }
  }, [componentId, data, form, message, onReloadDetail])

  const readOnlyEngine =
    data?.extra && typeof data.extra === 'object' && data.extra !== null && 'engine' in data.extra
      ? String((data.extra as { engine?: unknown }).engine ?? '')
      : ''

  const onDeleteElement = async (eleId: number) => {
    setDeletingId(eleId)
    try {
      await deleteComponentElement(eleId)
      message.success('已删除参数项')
      await onReloadDetail()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  const onSaveElementPatch = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!data || componentId === null || !editTarget) return
      const nextTabs = applyPatchToComponentTabs(
        data.tabs,
        editTarget.tabIndex,
        editTarget.elIndex,
        patch,
      )
      await updateComponentDefinition(componentId, { ...data, tabs: nextTabs })
      message.success('已更新参数项')
      await onReloadDetail()
    },
    [componentId, data, editTarget, message, onReloadDetail],
  )

  const onAppendNewElement = useCallback(
    async (record: Record<string, unknown>) => {
      if (!data || componentId === null || createElementTabIndex === null) return
      const ti = createElementTabIndex
      const tabs = readTabsArray(data.tabs)
      const tab = tabs[ti]
      const els = readTabElements(tab)
      let maxSeq = 0
      for (const e of els) {
        if (e !== null && typeof e === 'object' && !Array.isArray(e)) {
          const s = (e as Record<string, unknown>).sequence
          if (typeof s === 'number' && Number.isFinite(s)) maxSeq = Math.max(maxSeq, s)
        }
      }
      const full = { ...record, sequence: maxSeq + 1 }
      const nextTabs = appendElementToTab(data.tabs, ti, full)
      await updateComponentDefinition(componentId, { ...data, tabs: nextTabs })
      message.success('已添加参数项')
      await onReloadDetail()
    },
    [componentId, createElementTabIndex, data, message, onReloadDetail],
  )

  const onAddEmptyTab = useCallback(async () => {
    if (!data || componentId === null) return
    const n = readTabsArray(data.tabs).length + 1
    const nextTabs = appendEmptyTab(data.tabs, `新页签 ${n}`)
    await updateComponentDefinition(componentId, { ...data, tabs: nextTabs })
    message.success('已添加参数页签')
    await onReloadDetail()
  }, [componentId, data, message, onReloadDetail])

  const submitRenameTab = useCallback(async () => {
    if (!data || componentId === null || renameTabIndex === null) return
    const name = renameDraft.trim()
    if (!name) {
      message.warning('请输入页签名称')
      return
    }
    try {
      const nextTabs = setTabNameAt(data.tabs, renameTabIndex, name)
      await updateComponentDefinition(componentId, { ...data, tabs: nextTabs })
      message.success('已重命名页签')
      setRenameTabIndex(null)
      await onReloadDetail()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败')
    }
  }, [componentId, data, message, onReloadDetail, renameDraft, renameTabIndex])

  const onDeleteTab = useCallback(
    async (tabIndex: number) => {
      if (!data || componentId === null) return
      try {
        const nextTabs = removeTabAt(data.tabs, tabIndex)
        await updateComponentDefinition(componentId, { ...data, tabs: nextTabs })
        message.success('已删除页签')
        await onReloadDetail()
      } catch (e) {
        message.error(e instanceof Error ? e.message : '删除失败')
      }
    },
    [componentId, data, message, onReloadDetail],
  )

  const onSaveIoPorts = useCallback(async () => {
    if (!data || componentId === null) return
    try {
      setSavingIo(true)
      await updateComponentDefinition(componentId, {
        ...data,
        inputs: ioInputsDraft,
        outputs: ioOutputsDraft,
      })
      message.success('已保存输入/输出')
      await onReloadDetail()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSavingIo(false)
    }
  }, [componentId, data, ioInputsDraft, ioOutputsDraft, message, onReloadDetail])

  return (
    <>
    <Drawer
      title="组件详情"
      width={600}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={
        !loading && data && componentId !== null ? (
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={onClose}>关闭</Button>
              <Button type="primary" loading={savingBasic} onClick={() => void onSaveBasic()}>
                保存组件信息
              </Button>
            </Space>
          </div>
        ) : null
      }
    >
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : data ? (
        <>
          {componentId !== null ? (
            <Form form={form} layout="vertical" style={{ marginBottom: 16 }} disabled={savingBasic}>
              <Form.Item
                name="name"
                label="名称"
                rules={[{ required: true, message: '请输入组件名称' }]}
              >
                <Input allowClear placeholder="组件显示名称" />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={3} allowClear placeholder="可选" />
              </Form.Item>
              <Form.Item name="targetAlgorithm" label="算法类（targetAlgorithm）">
                <AutoComplete
                  options={algoOptions}
                  allowClear
                  placeholder="从列表选择或手动输入完整类名"
                  filterOption={(input, option) => {
                    const q = input.trim().toLowerCase()
                    if (!q) return true
                    const v = String(option?.value ?? '').toLowerCase()
                    const l = String(option?.label ?? '').toLowerCase()
                    return v.includes(q) || l.includes(q)
                  }}
                />
              </Form.Item>
              <Form.Item
                name="minimumInput"
                label="最少输入端口数（minimumInput）"
                tooltip="留空表示不在请求体中携带该字段（由后端默认）"
              >
                <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="可选" />
              </Form.Item>
              <Form.Item name="engine" label="执行引擎（extra.engine）">
                <Input allowClear placeholder="如 PYTHON、R 等，与后端约定一致" />
              </Form.Item>
              <Form.Item name="allowViewSource" valuePropName="checked">
                <Checkbox>允许查看源码（allowViewSource）</Checkbox>
              </Form.Item>
              <Form.Item name="enabled" valuePropName="checked">
                <Checkbox>启用组件（enabled）</Checkbox>
              </Form.Item>
            </Form>
          ) : (
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="名称">{String(data.name ?? '')}</Descriptions.Item>
              <Descriptions.Item label="描述">
                <Paragraph style={{ marginBottom: 0 }}>{String(data.description ?? '—')}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="算法类">{String(data.targetAlgorithm ?? '—')}</Descriptions.Item>
            </Descriptions>
          )}

          <Descriptions column={1} size="small" bordered>
            {componentId !== null ? (
              <Descriptions.Item label="组件 ID">{String(componentId)}</Descriptions.Item>
            ) : null}
            {componentId === null ? (
              <>
                <Descriptions.Item label="引擎">{readOnlyEngine || '—'}</Descriptions.Item>
                <Descriptions.Item label="最少输入">{String(data.minimumInput ?? '—')}</Descriptions.Item>
                <Descriptions.Item label="允许看源码">
                  {data.allowViewSource === true ? '是' : data.allowViewSource === false ? '否' : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="启用">
                  {data.enabled === true ? '是' : data.enabled === false ? '否' : '—'}
                </Descriptions.Item>
              </>
            ) : null}
          </Descriptions>

          <Collapse
            style={{ marginTop: 16 }}
            defaultActiveKey={['params', 'io']}
            items={[
              {
                key: 'params',
                label: `参数页签与元素（页签/参数项可增删改）· ${readTabsArray(data.tabs).length} 个页签`,
                children: (
                  <div>
                    {componentId !== null ? (
                      <Space style={{ marginBottom: 12 }} wrap align="center">
                        <Button
                          size="small"
                          type="primary"
                          disabled={savingBasic}
                          onClick={() => void onAddEmptyTab()}
                        >
                          添加参数页签
                        </Button>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          页签与参数变更将随 PUT 一并保存；新建参数项暂无后端 id 时，请以刷新后列表为准。
                        </Text>
                      </Space>
                    ) : null}
                    {readTabsArray(data.tabs).length === 0 ? (
                      <Text type="secondary">（无 tabs）</Text>
                    ) : (
                      readTabsArray(data.tabs).map((tab, ti) => {
                        const tabName = readTabName(tab, `页签 ${ti + 1}`)
                        const elements = readTabElements(tab)
                        return (
                          <div key={`tab-${ti}`} style={{ marginBottom: 16 }}>
                            <Space wrap style={{ marginBottom: 8 }} align="center">
                              <Text strong>{tabName}</Text>
                              {componentId !== null ? (
                                <>
                                  <Button
                                    size="small"
                                    disabled={savingBasic}
                                    onClick={() => setRenameTabIndex(ti)}
                                  >
                                    重命名页签
                                  </Button>
                                  <Popconfirm
                                    title="删除该页签及其全部参数项？"
                                    okText="删除"
                                    okType="danger"
                                    disabled={savingBasic}
                                    onConfirm={() => void onDeleteTab(ti)}
                                  >
                                    <Button size="small" danger disabled={savingBasic}>
                                      删除页签
                                    </Button>
                                  </Popconfirm>
                                  <Button
                                    size="small"
                                    type="primary"
                                    disabled={savingBasic}
                                    onClick={() => setCreateElementTabIndex(ti)}
                                  >
                                    添加参数项
                                  </Button>
                                </>
                              ) : null}
                            </Space>
                            <List
                              size="small"
                              bordered
                              dataSource={elements.map((el, ei) => ({ el, ei }))}
                              locale={{ emptyText: '（无参数项）' }}
                              renderItem={({ el, ei }) => {
                                const rec = el as Record<string, unknown>
                                const label = readElementLabel(el, ei)
                                const eleId = readElementNumericId(el)
                                const typeStr = elementTypeLabel(rec.elementType)
                                const allowDelete = componentId !== null && eleId !== null
                                const allowEdit = componentId !== null
                                const actionNodes: ReactNode[] = []
                                if (allowEdit) {
                                  actionNodes.push(
                                    <Button
                                      key="edit"
                                      type="link"
                                      size="small"
                                      disabled={savingBasic || deletingId !== null}
                                      onClick={() => setEditTarget({ tabIndex: ti, elIndex: ei })}
                                    >
                                      编辑
                                    </Button>,
                                  )
                                }
                                if (allowDelete) {
                                  actionNodes.push(
                                    <Popconfirm
                                      key="del"
                                      title="从组件定义中删除该参数项？"
                                      okText="删除"
                                      okButtonProps={{ danger: true, loading: deletingId === eleId }}
                                      onConfirm={() => void onDeleteElement(eleId)}
                                    >
                                      <Button
                                        type="link"
                                        danger
                                        size="small"
                                        disabled={deletingId !== null}
                                      >
                                        删除
                                      </Button>
                                    </Popconfirm>,
                                  )
                                }
                                return (
                                  <List.Item actions={actionNodes}>
                                    <List.Item.Meta
                                      title={
                                        <span>
                                          {label}
                                          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                                            {typeStr}
                                            {eleId !== null
                                              ? ` · id ${eleId}`
                                              : ' · 无 id，无法调用删除接口'}
                                            {eleId !== null && componentId === null ? ' · 未关联组件 id' : ''}
                                          </Text>
                                        </span>
                                      }
                                      description={elementListMetaDescription(rec)}
                                    />
                                  </List.Item>
                                )
                              }}
                            />
                          </div>
                        )
                      })
                    )}
                    <Collapse
                      ghost
                      size="small"
                      items={[
                        {
                          key: 'raw-tabs',
                          label: '原始 tabs JSON',
                          children: (
                            <pre style={{ margin: 0, maxHeight: 200, overflow: 'auto', fontSize: 11 }}>
                              {JSON.stringify(data.tabs ?? [], null, 2)}
                            </pre>
                          ),
                        },
                      ]}
                    />
                  </div>
                ),
              },
              {
                key: 'io',
                label: `输入 / 输出（${ioInputsDraft.length} / ${ioOutputsDraft.length}）`,
                children: (
                  <div>
                    <ComponentIoPortsEditor
                      inputs={ioInputsDraft}
                      outputs={ioOutputsDraft}
                      onChangeInputs={setIoInputsDraft}
                      onChangeOutputs={setIoOutputsDraft}
                      disabled={componentId === null || savingIo}
                    />
                    {componentId !== null ? (
                      <div style={{ marginBottom: 12 }}>
                        <Button type="primary" loading={savingIo} onClick={() => void onSaveIoPorts()}>
                          保存输入/输出
                        </Button>
                      </div>
                    ) : (
                      <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                        未关联组件 id 时仅可查看，无法保存端口。
                      </Text>
                    )}
                    <Collapse
                      ghost
                      size="small"
                      items={[
                        {
                          key: 'raw-io',
                          label: '草稿 JSON（与上表同步，保存后与服务端一致）',
                          children: (
                            <pre
                              style={{ margin: 0, maxHeight: 240, overflow: 'auto', fontSize: 11 }}
                            >
                              {JSON.stringify(
                                { inputs: ioInputsDraft, outputs: ioOutputsDraft },
                                null,
                                2,
                              )}
                            </pre>
                          ),
                        },
                      ]}
                    />
                  </div>
                ),
              },
              {
                key: 'script',
                label: '脚本（只读摘要）',
                children: (
                  <Text code copyable style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                    {scriptPreview(data.script)}
                  </Text>
                ),
              },
            ]}
          />
        </>
      ) : (
        <Text type="secondary">无数据</Text>
      )}
    </Drawer>
    {editTarget !== null && editInitial !== null ? (
      <ComponentElementEditModal
        variant="edit"
        open
        tabIndex={editTarget.tabIndex}
        elIndex={editTarget.elIndex}
        initial={editInitial}
        onCancel={() => setEditTarget(null)}
        onSave={onSaveElementPatch}
      />
    ) : null}
    {createElementTabIndex !== null ? (
      <ComponentElementEditModal
        variant="create"
        open
        tabIndex={createElementTabIndex}
        onCancel={() => setCreateElementTabIndex(null)}
        onSave={onAppendNewElement}
      />
    ) : null}
    <Modal
      title="重命名参数页签"
      open={renameTabIndex !== null}
      onOk={() => void submitRenameTab()}
      onCancel={() => setRenameTabIndex(null)}
      destroyOnHidden
    >
      <Input
        value={renameDraft}
        onChange={(e) => setRenameDraft(e.target.value)}
        placeholder="页签名称"
        style={{ marginTop: 8 }}
      />
    </Modal>
    </>
  )
}
