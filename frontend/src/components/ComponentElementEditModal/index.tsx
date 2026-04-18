import { App, Checkbox, Form, Input, InputNumber, Modal, Radio, Select, Space } from 'antd'
import { useEffect, useState } from 'react'
import { fetchWidgetList } from '../../api/componentApi'
import {
  parseElementValueFromForm,
  parseExtraFromForm,
  stringifyElementValueForForm,
  stringifyExtraForForm,
} from '../../utils/elementValueString'
import { readElementUiDescription } from '../../utils/componentDefinitionInspect'
import {
  readElementAllowClear,
  readElementMaxLength,
  readElementNumberMax,
  readElementNumberMin,
  readElementNumberStep,
  readElementSelectSearchFormMode,
  readElementType,
  readOptionalElementRows,
} from '../../utils/flowNodeTabUtils'
import type { ElementSelectSearchFormMode } from '../../utils/flowNodeTabUtils'
import { buildWidgetElementTypeOptions } from '../../utils/widgetListOptions'

function readBoolishTrue(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1'
}

function readEditableInitial(rec: Record<string, unknown>): boolean {
  const ed = rec.editable
  if (ed === false || ed === 'false' || ed === 0 || ed === '0') return false
  const ex = rec.extra
  if (ex !== null && typeof ex === 'object' && !Array.isArray(ex)) {
    const e = (ex as Record<string, unknown>).editable
    if (e === false || e === 'false' || e === 0 || e === '0') return false
  }
  return true
}

function assignFiniteNumber(
  target: Record<string, unknown>,
  key: string,
  val: number | null | undefined,
): void {
  if (val !== null && val !== undefined && Number.isFinite(val)) {
    target[key] = val
  }
}

function assignIntInRange(
  target: Record<string, unknown>,
  key: string,
  val: number | null | undefined,
  min: number,
  max: number,
): void {
  if (val === null || val === undefined || !Number.isFinite(val)) return
  const n = Math.trunc(val)
  if (n >= min && n <= max) target[key] = n
}

/** 仅 elementType=3 时写入 `allowClear` / `showSearch` */
function applySelectUiToPayload(
  target: Record<string, unknown>,
  elementType: number | null | undefined,
  searchMode: ElementSelectSearchFormMode,
  allowClear: boolean,
): void {
  if (elementType !== 3) return
  target.allowClear = allowClear
  if (searchMode === 'on') target.showSearch = true
  else if (searchMode === 'off') target.showSearch = false
}

export type ComponentElementEditModalProps =
  | {
      variant: 'edit'
      open: boolean
      tabIndex: number
      elIndex: number
      initial: Record<string, unknown>
      onCancel: () => void
      onSave: (patch: Record<string, unknown>) => Promise<void>
    }
  | {
      variant: 'create'
      open: boolean
      tabIndex: number
      onCancel: () => void
      /** 新元素完整对象（无后端 id 时由下次 GET 补全） */
      onSave: (record: Record<string, unknown>) => Promise<void>
    }

type FormValues = {
  label: string
  name: string
  /** 部分旧版/后端 DTO 中的补充说明，与 label 并存 */
  description: string
  elementType: number | null
  options: string
  placeholder: string
  /** 与流程节点参数面板问号提示一致（旧版常作 toolTip） */
  toolTip: string
  valueStr: string
  required: boolean
  visible: boolean
  readOnly: boolean
  disabled: boolean
  /** 与节点参数面板一致：未勾选则写 editable:false */
  editable: boolean
  rexp: string
  /** 仅编辑态写入；新增时由外层统一分配 sequence */
  sequence: number | null
  /** elementType=2 时写入 `min` / `max` / `step`（留空则本次不写入该键） */
  numMin: number | null
  numMax: number | null
  numStep: number | null
  /** TextArea 行数 1–40，写入 `rows` */
  textAreaRows: number | null
  /** 写入 `maxLength` */
  fieldMaxLength: number | null
  /** elementType=3：下拉搜索显式开/关/不写 */
  selectShowSearchMode: ElementSelectSearchFormMode
  /** elementType=3：是否允许清空 */
  selectAllowClear: boolean
  extraStr: string
}

export function ComponentElementEditModal(props: ComponentElementEditModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const elementTypeWatched = Form.useWatch('elementType', form)
  const [saving, setSaving] = useState(false)
  const [widgetOpts, setWidgetOpts] = useState<{ value: number; label: string }[]>([])

  const { open, tabIndex, onCancel } = props
  const editInitial = props.variant === 'edit' ? props.initial : null

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void fetchWidgetList()
      .then((rows) => {
        if (!cancelled) setWidgetOpts(buildWidgetElementTypeOptions(rows))
      })
      .catch(() => {
        if (!cancelled) setWidgetOpts([])
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || editInitial === null) return
    const et = readElementType(editInitial)
    const seq = editInitial.sequence
    form.setFieldsValue({
      label: typeof editInitial.label === 'string' ? editInitial.label : '',
      name: typeof editInitial.name === 'string' ? editInitial.name : '',
      description: readElementUiDescription(editInitial),
      elementType: et >= 0 ? et : null,
      options: typeof editInitial.options === 'string' ? editInitial.options : '',
      placeholder: typeof editInitial.placeholder === 'string' ? editInitial.placeholder : '',
      toolTip:
        typeof editInitial.toolTip === 'string'
          ? editInitial.toolTip
          : typeof editInitial.tooltip === 'string'
            ? editInitial.tooltip
            : '',
      valueStr: stringifyElementValueForForm(editInitial.value),
      required: editInitial.required === true,
      visible: editInitial.visible !== false,
      readOnly: readBoolishTrue(editInitial.readOnly),
      disabled: readBoolishTrue(editInitial.disabled),
      editable: readEditableInitial(editInitial),
      rexp: typeof editInitial.rexp === 'string' ? editInitial.rexp : '',
      sequence:
        typeof seq === 'number' && Number.isFinite(seq)
          ? seq
          : typeof seq === 'string' && /^\d+$/.test(seq)
            ? Number.parseInt(seq, 10)
            : null,
      numMin: readElementNumberMin(editInitial) ?? null,
      numMax: readElementNumberMax(editInitial) ?? null,
      numStep: readElementNumberStep(editInitial) ?? null,
      textAreaRows: readOptionalElementRows(editInitial) ?? null,
      fieldMaxLength: readElementMaxLength(editInitial) ?? null,
      selectShowSearchMode: readElementSelectSearchFormMode(editInitial),
      selectAllowClear: readElementAllowClear(editInitial),
      extraStr: stringifyExtraForForm(editInitial.extra),
    })
  }, [open, editInitial, form])

  useEffect(() => {
    if (!open || props.variant !== 'create') return
    form.setFieldsValue({
      label: '新参数',
      name: `param_${Date.now()}`,
      description: '',
      elementType: 1,
      options: '',
      placeholder: '',
      toolTip: '',
      valueStr: '',
      required: false,
      visible: true,
      readOnly: false,
      disabled: false,
      editable: true,
      rexp: '',
      sequence: null,
      numMin: null,
      numMax: null,
      numStep: null,
      textAreaRows: null,
      fieldMaxLength: null,
      selectShowSearchMode: 'default',
      selectAllowClear: true,
      extraStr: '',
    })
  }, [open, props.variant, form])

  const submit = async () => {
    try {
      const v = await form.validateFields()
      let extra: Record<string, unknown>
      try {
        extra = parseExtraFromForm(v.extraStr)
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'extra 解析失败')
        return
      }
      setSaving(true)
      if (props.variant === 'edit') {
        const patch: Record<string, unknown> = {
          label: v.label.trim(),
          name: v.name.trim(),
          description: v.description.trim(),
          options: v.options.trim(),
          placeholder: v.placeholder.trim(),
          toolTip: v.toolTip.trim(),
          value: parseElementValueFromForm(v.valueStr),
          required: v.required,
          visible: v.visible,
          readOnly: v.readOnly,
          disabled: v.disabled,
          editable: v.editable,
          rexp: v.rexp.trim(),
          extra,
        }
        if (v.elementType !== null && v.elementType !== undefined && Number.isFinite(v.elementType)) {
          patch.elementType = v.elementType
        }
        if (v.sequence !== null && v.sequence !== undefined && Number.isFinite(v.sequence)) {
          patch.sequence = v.sequence
        }
        assignFiniteNumber(patch, 'min', v.numMin)
        assignFiniteNumber(patch, 'max', v.numMax)
        assignFiniteNumber(patch, 'step', v.numStep)
        assignIntInRange(patch, 'rows', v.textAreaRows, 1, 40)
        assignIntInRange(patch, 'maxLength', v.fieldMaxLength, 1, 1_000_000)
        applySelectUiToPayload(patch, v.elementType, v.selectShowSearchMode, v.selectAllowClear)
        await props.onSave(patch)
      } else {
        const record: Record<string, unknown> = {
          label: v.label.trim(),
          name: v.name.trim(),
          description: v.description.trim(),
          options: v.options.trim(),
          placeholder: v.placeholder.trim(),
          toolTip: v.toolTip.trim(),
          value: parseElementValueFromForm(v.valueStr),
          required: v.required,
          visible: v.visible,
          readOnly: v.readOnly,
          disabled: v.disabled,
          editable: v.editable,
          rexp: v.rexp.trim(),
          extra,
        }
        if (v.elementType !== null && v.elementType !== undefined && Number.isFinite(v.elementType)) {
          record.elementType = v.elementType
        }
        assignFiniteNumber(record, 'min', v.numMin)
        assignFiniteNumber(record, 'max', v.numMax)
        assignFiniteNumber(record, 'step', v.numStep)
        assignIntInRange(record, 'rows', v.textAreaRows, 1, 40)
        assignIntInRange(record, 'maxLength', v.fieldMaxLength, 1, 1_000_000)
        applySelectUiToPayload(record, v.elementType, v.selectShowSearchMode, v.selectAllowClear)
        await props.onSave(record)
      }
      onCancel()
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const title =
    props.variant === 'edit'
      ? `编辑参数项（页签 ${tabIndex + 1} · 第 ${props.elIndex + 1} 项）`
      : `新增参数项（页签 ${tabIndex + 1}）`

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={() => void submit()}
      okText="保存"
      confirmLoading={saving}
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }} disabled={saving}>
        <Form.Item name="label" label="显示标签（label）">
          <Input allowClear placeholder="面板上的名称" />
        </Form.Item>
        <Form.Item
          name="name"
          label="字段名（name）"
          rules={[{ required: true, message: '请输入 name，与流程 JSON 中参数键一致' }]}
        >
          <Input allowClear placeholder="如 method、threshold" />
        </Form.Item>
        <Form.Item
          name="description"
          label="说明（description）"
          tooltip="可选；部分组件定义中与 label 并存的补充文案"
        >
          <Input.TextArea rows={2} allowClear placeholder="可选" />
        </Form.Item>
        <Form.Item label="控件类型（elementType）">
          <Space wrap style={{ width: '100%' }}>
            <Form.Item name="elementType" noStyle>
              <InputNumber min={0} max={99} placeholder="数字类型码" style={{ width: 160 }} />
            </Form.Item>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="从 widget/list 检索并选择"
              style={{ minWidth: 260 }}
              options={widgetOpts}
              onChange={(n) => {
                if (n !== undefined && n !== null) form.setFieldValue('elementType', n)
              }}
            />
          </Space>
        </Form.Item>
        <Form.Item
          name="options"
          label="选项串（options）"
          tooltip="旧版 a:b;c:d 格式，用于下拉/单选等"
        >
          <Input.TextArea rows={2} allowClear placeholder="可选" />
        </Form.Item>
        {elementTypeWatched === 3 ? (
          <Form.Item
            label="下拉交互（elementType=3）"
            tooltip="「默认」不在本次保存写入 showSearch，工程页仍可按选项≥10 自动可搜索；开启/关闭会显式写入布尔值"
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Form.Item name="selectShowSearchMode" noStyle>
                <Radio.Group>
                  <Radio value="default">搜索：默认（不显式写入 showSearch）</Radio>
                  <Radio value="on">搜索：开启</Radio>
                  <Radio value="off">搜索：关闭</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item name="selectAllowClear" valuePropName="checked" noStyle>
                <Checkbox>允许清空（allowClear）</Checkbox>
              </Form.Item>
            </Space>
          </Form.Item>
        ) : null}
        <Form.Item name="placeholder" label="占位符（placeholder）" tooltip="输入框为空时的提示文案">
          <Input allowClear placeholder="可选" />
        </Form.Item>
        <Form.Item
          name="toolTip"
          label="帮助说明（toolTip）"
          tooltip="工程页节点参数旁「?」展示；可用分号分隔多行"
        >
          <Input.TextArea rows={2} allowClear placeholder="可选" />
        </Form.Item>
        <Form.Item
          label="文本框展示（rows / maxLength）"
          tooltip="多行控件高度用 rows（1–40）；单行/多行可限制 maxLength。留空则本次不写入该键"
        >
          <Space wrap align="start">
            <Form.Item name="textAreaRows" label="行数 rows" style={{ marginBottom: 0, minWidth: 132 }}>
              <InputNumber min={1} max={40} placeholder="默认" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="fieldMaxLength" label="maxLength" style={{ marginBottom: 0, minWidth: 152 }}>
              <InputNumber min={1} max={1000000} placeholder="可选" style={{ width: '100%' }} />
            </Form.Item>
          </Space>
        </Form.Item>
        <Form.Item
          name="valueStr"
          label="默认值（value）"
          tooltip="可为普通文本、数字，或 JSON 对象/数组（合法 JSON 会解析后保存）"
        >
          <Input.TextArea rows={4} allowClear placeholder="可选" />
        </Form.Item>
        <Form.Item
          label="数字约束（min / max / step）"
          tooltip="在 elementType=2 时，工程页节点参数的数字框会应用；兼容别名 minimum / maximum。仅填写需要的项；未填项本次保存不会覆盖原有值"
        >
          <Space wrap style={{ width: '100%' }} align="start">
            <Form.Item name="numMin" label="最小值（min）" style={{ marginBottom: 0, minWidth: 140 }}>
              <InputNumber style={{ width: '100%' }} placeholder="可选" />
            </Form.Item>
            <Form.Item name="numMax" label="最大值（max）" style={{ marginBottom: 0, minWidth: 140 }}>
              <InputNumber style={{ width: '100%' }} placeholder="可选" />
            </Form.Item>
            <Form.Item name="numStep" label="步长（step）" style={{ marginBottom: 0, minWidth: 140 }}>
              <InputNumber style={{ width: '100%' }} placeholder="可选" step={0.0001} />
            </Form.Item>
          </Space>
        </Form.Item>
        <Form.Item label="校验与展示">
          <Space wrap size="large">
            <Form.Item name="required" valuePropName="checked" noStyle>
              <Checkbox>必填（required）</Checkbox>
            </Form.Item>
            <Form.Item name="visible" valuePropName="checked" noStyle>
              <Checkbox>可见（visible）</Checkbox>
            </Form.Item>
          </Space>
        </Form.Item>
        <Form.Item
          label="交互与只读"
          tooltip="与工程页节点参数一致：readOnly / disabled 或 editable 为假时控件禁用"
        >
          <Space wrap size="large">
            <Form.Item name="readOnly" valuePropName="checked" noStyle>
              <Checkbox>只读（readOnly）</Checkbox>
            </Form.Item>
            <Form.Item name="disabled" valuePropName="checked" noStyle>
              <Checkbox>禁用（disabled）</Checkbox>
            </Form.Item>
            <Form.Item name="editable" valuePropName="checked" noStyle>
              <Checkbox>可编辑（editable）</Checkbox>
            </Form.Item>
          </Space>
        </Form.Item>
        <Form.Item
          name="rexp"
          label="校验正则（rexp）"
          tooltip="与旧版一致；空表示不校验"
        >
          <Input allowClear placeholder="可选" />
        </Form.Item>
        {props.variant === 'edit' ? (
          <Form.Item
            name="sequence"
            label="排序序号（sequence）"
            tooltip="同一页签内参数顺序；留空表示不修改此项"
          >
            <InputNumber min={0} step={1} placeholder="可选" style={{ width: '100%' }} />
          </Form.Item>
        ) : null}
        <Form.Item
          name="extraStr"
          label="扩展字段（extra）"
          tooltip="须为 JSON 对象；空对象可留空"
        >
          <Input.TextArea rows={3} allowClear placeholder="{ }" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
