import {
  Button,
  Checkbox,
  Input,
  InputNumber,
  Popconfirm,
  Space,
  Table,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo } from 'react'

const { Text } = Typography

function updateRow(
  rows: Record<string, unknown>[],
  index: number,
  patch: Record<string, unknown>,
): Record<string, unknown>[] {
  return rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
}

function removeRow(rows: Record<string, unknown>[], index: number): Record<string, unknown>[] {
  return rows.filter((_, i) => i !== index)
}

function readStrCell(record: Record<string, unknown>, key: string): string {
  const v = record[key]
  if (v == null) return ''
  return String(v)
}

function readBoolCell(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true
}

function readLeftNumber(record: Record<string, unknown>): number | null {
  const v = record.left
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function stringifyColumnsField(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return ''
  }
}

function parseColumnsInput(text: string): unknown {
  const t = text.trim()
  if (!t) return undefined
  try {
    return JSON.parse(t) as unknown
  } catch {
    return t
  }
}

type PortVariant = 'input' | 'output'

function duplicatePortRow(
  rows: Record<string, unknown>[],
  index: number,
  variant: PortVariant,
): Record<string, unknown>[] {
  const src = rows[index]
  let copy: Record<string, unknown>
  try {
    copy = JSON.parse(JSON.stringify(src)) as Record<string, unknown>
  } catch {
    copy = { ...src }
  }
  const ak = copy.key
  if (typeof ak === 'string' && ak.trim()) {
    copy.key = `${ak.trim()}_copy`
  } else {
    copy.key = variant === 'input' ? `in_copy_${index + 1}` : `out_copy_${index + 1}`
  }
  copy.id = ''
  if (variant === 'input') {
    copy.isConnected = false
  }
  return [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)]
}

type PortTableProps = {
  title: string
  variant: PortVariant
  /** 新增行时的默认 `type` 字段 */
  defaultType: string
  rows: Record<string, unknown>[]
  onChange: (next: Record<string, unknown>[]) => void
  disabled: boolean
}

function PortTable({ title, variant, defaultType, rows, onChange, disabled }: PortTableProps) {
  const columns: ColumnsType<Record<string, unknown>> = useMemo(() => {
    const tip = (label: string, hint: string) => (
      <Tooltip title={hint}>
        <span>{label}</span>
      </Tooltip>
    )

    const keyCol: ColumnsType<Record<string, unknown>>[0] = {
      title: tip('key', '与 Flow 连线、inputData.key 等关联的端口键'),
      width: 100,
      render: (_: unknown, record, index) => (
        <Input
          size="small"
          disabled={disabled}
          value={readStrCell(record, 'key')}
          onChange={(e) => onChange(updateRow(rows, index, { key: e.target.value }))}
          placeholder="端口键"
        />
      ),
    }
    const descCol: ColumnsType<Record<string, unknown>>[0] = {
      title: tip('description', '端口说明文案'),
      width: 120,
      render: (_: unknown, record, index) => (
        <Input
          size="small"
          disabled={disabled}
          value={readStrCell(record, 'description')}
          onChange={(e) => onChange(updateRow(rows, index, { description: e.target.value }))}
          placeholder="说明"
        />
      ),
    }
    const typeCol: ColumnsType<Record<string, unknown>>[0] = {
      title: tip('type', '通常为 INPUT 或 OUTPUT'),
      width: 88,
      render: (_: unknown, record, index) => (
        <Input
          size="small"
          disabled={disabled}
          value={readStrCell(record, 'type')}
          onChange={(e) => onChange(updateRow(rows, index, { type: e.target.value }))}
          placeholder={defaultType}
        />
      ),
    }

    const inputExtras: ColumnsType<Record<string, unknown>> = [
      {
        title: tip('cat', '输入分类，如 DATA'),
        width: 80,
        render: (_: unknown, record, index) => (
          <Input
            size="small"
            disabled={disabled}
            value={readStrCell(record, 'cat')}
            onChange={(e) => onChange(updateRow(rows, index, { cat: e.target.value }))}
            placeholder="分类"
          />
        ),
      },
      {
        title: tip('value', '端口默认值或运行态绑定标识'),
        width: 100,
        render: (_: unknown, record, index) => (
          <Input
            size="small"
            disabled={disabled}
            value={readStrCell(record, 'value')}
            onChange={(e) => onChange(updateRow(rows, index, { value: e.target.value }))}
            placeholder="端口值"
          />
        ),
      },
      {
        title: tip('left', '画布上端口水平位置（像素）'),
        width: 72,
        render: (_: unknown, record, index) => (
          <InputNumber
            size="small"
            disabled={disabled}
            style={{ width: '100%' }}
            min={0}
            value={readLeftNumber(record)}
            onChange={(v) => onChange(updateRow(rows, index, { left: v ?? undefined }))}
          />
        ),
      },
      {
        title: tip('model', '是否为模型类输入端口'),
        width: 64,
        align: 'center',
        render: (_: unknown, record, index) => (
          <Checkbox
            disabled={disabled}
            checked={readBoolCell(record, 'model')}
            onChange={(e) => onChange(updateRow(rows, index, { model: e.target.checked }))}
          />
        ),
      },
      {
        title: tip('预览', 'canPreview：运行后是否可预览该端口数据'),
        width: 64,
        align: 'center',
        render: (_: unknown, record, index) => (
          <Checkbox
            disabled={disabled}
            checked={readBoolCell(record, 'canPreview')}
            onChange={(e) => onChange(updateRow(rows, index, { canPreview: e.target.checked }))}
          />
        ),
      },
      {
        title: tip('已连', 'isConnected：是否与上游连线（保存 Flow 后通常会按连线重算）'),
        width: 56,
        align: 'center',
        render: (_: unknown, record, index) => (
          <Checkbox
            disabled={disabled}
            checked={readBoolCell(record, 'isConnected')}
            onChange={(e) => onChange(updateRow(rows, index, { isConnected: e.target.checked }))}
          />
        ),
      },
    ]

    const outputExtras: ColumnsType<Record<string, unknown>> = [
      {
        title: tip('access', '输出访问或权限相关标记'),
        width: 88,
        render: (_: unknown, record, index) => (
          <Input
            size="small"
            disabled={disabled}
            value={readStrCell(record, 'access')}
            onChange={(e) => onChange(updateRow(rows, index, { access: e.target.value }))}
            placeholder="access"
          />
        ),
      },
      {
        title: tip('value', '输出端口值或中间表/模型路径标识'),
        width: 100,
        render: (_: unknown, record, index) => (
          <Input
            size="small"
            disabled={disabled}
            value={readStrCell(record, 'value')}
            onChange={(e) => onChange(updateRow(rows, index, { value: e.target.value }))}
            placeholder="输出值"
          />
        ),
      },
      {
        title: tip('columns', '列结构，JSON 数组或对象字符串'),
        width: 140,
        render: (_: unknown, record, index) => (
          <Input.TextArea
            size="small"
            rows={1}
            disabled={disabled}
            value={stringifyColumnsField(record.columns)}
            onChange={(e) => onChange(updateRow(rows, index, { columns: parseColumnsInput(e.target.value) }))}
            placeholder="JSON"
            style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
          />
        ),
      },
    ]

    const idCol: ColumnsType<Record<string, unknown>>[0] = {
      title: tip('id', '连线使用的端口 id，应对应 links 中的 inputPortId 等'),
      width: 120,
      render: (_: unknown, record, index) => (
        <Input
          size="small"
          disabled={disabled}
          value={readStrCell(record, 'id')}
          onChange={(e) => onChange(updateRow(rows, index, { id: e.target.value }))}
          placeholder="端口 id"
        />
      ),
    }

    const actionsCol: ColumnsType<Record<string, unknown>>[0] = {
      title: '操作',
      width: 112,
      fixed: 'right',
      render: (_: unknown, __, index) => (
        <Space size={0} wrap>
          <Button
            type="link"
            size="small"
            disabled={disabled}
            onClick={() => onChange(duplicatePortRow(rows, index, variant))}
          >
            复制
          </Button>
          <Popconfirm
            title="删除该端口行？"
            disabled={disabled}
            onConfirm={() => onChange(removeRow(rows, index))}
          >
            <Button type="link" size="small" danger disabled={disabled}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    }

    const middle = variant === 'input' ? inputExtras : outputExtras
    return [keyCol, descCol, typeCol, ...middle, idCol, actionsCol]
  }, [defaultType, disabled, onChange, rows, variant])

  const scrollX = variant === 'input' ? 1220 : 960

  const appendDefaultRow = () => {
    const base: Record<string, unknown> = {
      key: `${defaultType === 'INPUT' ? 'in' : 'out'}_${rows.length + 1}`,
      description: '',
      type: defaultType,
      id: '',
    }
    if (variant === 'input') {
      base.cat = ''
      base.value = ''
      base.model = false
      base.canPreview = false
      base.isConnected = false
    } else {
      base.access = ''
      base.value = ''
    }
    onChange([...rows, base])
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <Space style={{ marginBottom: 8 }} align="center">
        <Text strong>{title}</Text>
        <Button size="small" disabled={disabled} onClick={appendDefaultRow}>
          添加行
        </Button>
      </Space>
      <Table
        size="small"
        pagination={false}
        rowKey={(_, i) => `port-${defaultType}-${variant}-${i}`}
        columns={columns}
        dataSource={rows}
        locale={{ emptyText: '（无端口）' }}
        scroll={{ x: scrollX }}
      />
    </div>
  )
}

export type ComponentIoPortsEditorProps = {
  inputs: Record<string, unknown>[]
  outputs: Record<string, unknown>[]
  onChangeInputs: (next: Record<string, unknown>[]) => void
  onChangeOutputs: (next: Record<string, unknown>[]) => void
  disabled: boolean
}

export function ComponentIoPortsEditor({
  inputs,
  outputs,
  onChangeInputs,
  onChangeOutputs,
  disabled,
}: ComponentIoPortsEditorProps) {
  return (
    <div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
        配置组件的输入与输出端口。表头悬停可查看字段说明；「复制」会在下方插入一行并在端口键名后追加后缀以便区分。
      </Text>
      <PortTable
        title="输入（inputs）"
        variant="input"
        defaultType="INPUT"
        rows={inputs}
        onChange={onChangeInputs}
        disabled={disabled}
      />
      <PortTable
        title="输出（outputs）"
        variant="output"
        defaultType="OUTPUT"
        rows={outputs}
        onChange={onChangeOutputs}
        disabled={disabled}
      />
    </div>
  )
}
