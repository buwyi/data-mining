import {
  App,
  AutoComplete,
  Button,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'
import type { GridColumnValueKind } from '../../utils/flowNodeGridModel'
import { gridColumnKeys } from '../../utils/flowNodeGridModel'

const { Text } = Typography

type FlowNodeInputDataGridProps = {
  /** React Table rowKey 前缀（节点 + tab + element） */
  rowKeyPrefix: string
  rows: Record<string, unknown>[]
  onChange: (next: Record<string, unknown>[]) => void
  /** 来自 `element.extra.gridColumnTypes`，写入由 `onColumnTypesChange` 回传 */
  columnTypes?: Record<string, GridColumnValueKind>
  onColumnTypesChange?: (next: Record<string, GridColumnValueKind>) => void
  /** 参数项只读时禁用编辑与增删行列（`readOnly` / `disabled` / `editable:false`） */
  readOnly?: boolean
  /** 与节点 `required` 配合：至少保留一行时禁用「删除」末行 */
  requireAtLeastOneRow?: boolean
}

function cellNumberDisplay(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * 节点参数里 `inputData` / 对象数组 `value` 的简易表格编辑；支持按列选择文本/数字（`extra.gridColumnTypes`）。
 */
export function FlowNodeInputDataGrid({
  rowKeyPrefix,
  rows,
  onChange,
  columnTypes: columnTypesProp,
  onColumnTypesChange,
  readOnly = false,
  requireAtLeastOneRow = false,
  columnPickOptions,
}: FlowNodeInputDataGridProps) {
  const columnTypes = columnTypesProp ?? {}
  const { message } = App.useApp()
  const [newColInput, setNewColInput] = useState('')
  const [removeCol, setRemoveCol] = useState<string | undefined>(undefined)
  const keys = useMemo(() => gridColumnKeys(rows), [rows])

  const updateCell = (rowIndex: number, key: string, val: string) => {
    const next = rows.map((r, i) => (i === rowIndex ? { ...r, [key]: val } : { ...r }))
    onChange(next)
  }

  const updateCellValue = (rowIndex: number, key: string, val: unknown) => {
    const next = rows.map((r, i) => (i === rowIndex ? { ...r, [key]: val } : { ...r }))
    onChange(next)
  }

  const setTypeForColumn = (col: string, kind: GridColumnValueKind) => {
    if (!onColumnTypesChange) return
    onColumnTypesChange({ ...columnTypes, [col]: kind })
  }

  const deleteRow = (rowIndex: number) => {
    onChange(rows.filter((_, i) => i !== rowIndex))
  }

  const addRow = () => {
    if (rows.length === 0) {
      onChange([{ value: '' }])
      return
    }
    const blank: Record<string, unknown> = {}
    for (const k of keys) blank[k] = ''
    onChange([...rows, blank])
  }

  const addColumn = () => {
    const name = newColInput.trim()
    if (!name) {
      message.warning('请输入列名')
      return
    }
    if (name.startsWith('_')) {
      message.warning('列名不能以 _ 开头（系统保留）')
      return
    }
    const exists = keys.includes(name)
    if (exists) {
      message.warning('该列已存在')
      return
    }
    setNewColInput('')
    if (rows.length === 0) {
      onChange([{ [name]: '' }])
    } else {
      onChange(rows.map((r) => ({ ...r, [name]: '' })))
    }
    onColumnTypesChange?.({ ...columnTypes, [name]: 'text' })
  }

  const deleteColumnConfirmed = (col: string) => {
    let next = rows.map((r) => {
      const { [col]: _, ...rest } = r
      return rest
    })
    const allEmpty = next.length > 0 && next.every((r) => Object.keys(r).length === 0)
    if (allEmpty) {
      next = next.map(() => ({ value: '' }))
    }
    onChange(next)
    setRemoveCol(undefined)
    if (onColumnTypesChange) {
      const rest = { ...columnTypes }
      delete rest[col]
      onColumnTypesChange(rest)
    }
    message.success(`已删除列「${col}」`)
  }

  const columns: ColumnsType<Record<string, unknown>> = [
    ...keys.map((k) => {
      const kind = columnTypes[k] ?? 'text'
      return {
        title: (
          <Space direction="vertical" size={4} style={{ minWidth: 88 }}>
            <Text strong style={{ fontSize: 12 }}>
              {k}
            </Text>
            {onColumnTypesChange ? (
              <Select
                size="small"
                className="nodrag"
                disabled={readOnly}
                value={kind}
                options={[
                  { value: 'text', label: '文本' },
                  { value: 'number', label: '数字' },
                ]}
                onChange={(v) => setTypeForColumn(k, v as GridColumnValueKind)}
                style={{ width: '100%', minWidth: 86 }}
              />
            ) : (
              <Text type="secondary" style={{ fontSize: 11 }}>
                文本
              </Text>
            )}
          </Space>
        ),
        dataIndex: k,
        key: k,
        ellipsis: true,
        render: (_: unknown, row: Record<string, unknown>, rowIndex: number) => {
          if (kind === 'number') {
            return (
              <InputNumber
                size="small"
                className="nodrag"
                style={{ width: '100%' }}
                disabled={readOnly}
                value={cellNumberDisplay(row[k])}
                onChange={(n) =>
                  updateCellValue(rowIndex, k, n === null || n === undefined ? '' : n)
                }
              />
            )
          }
          const pick = columnPickOptions?.[k]
          const strVal = row[k] == null ? '' : String(row[k])
          if (pick && pick.length > 0) {
            return (
              <AutoComplete
                size="small"
                className="nodrag"
                style={{ width: '100%' }}
                disabled={readOnly}
                value={strVal}
                options={pick.map((name) => ({ value: name }))}
                filterOption={(input, option) =>
                  (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                }
                onChange={(v) => updateCell(rowIndex, k, v)}
                allowClear
              />
            )
          }
          return (
            <Input
              size="small"
              className="nodrag"
              disabled={readOnly}
              value={strVal}
              onChange={(e) => updateCell(rowIndex, k, e.target.value)}
            />
          )
        },
      }
    }),
    ...(readOnly
      ? []
      : [
          {
            title: '操作',
            key: '_actions',
            width: 72,
            fixed: 'right' as const,
            render: (_: unknown, _row: Record<string, unknown>, rowIndex: number) => (
              <Button
                type="link"
                size="small"
                danger
                disabled={requireAtLeastOneRow && rows.length <= 1}
                onClick={() => deleteRow(rowIndex)}
              >
                删除
              </Button>
            ),
          },
        ]),
  ]

  return (
    <div>
      <Table<Record<string, unknown>>
        size="small"
        bordered
        pagination={false}
        scroll={{ x: Math.max(360, keys.length * 168 + 80) }}
        rowKey={(_, index) => `${rowKeyPrefix}-${index}`}
        dataSource={rows}
        columns={columns}
      />
      {readOnly ? null : (
        <Space style={{ marginTop: 8 }} wrap align="center">
          <Button size="small" type="dashed" onClick={addRow}>
            添加行
          </Button>
          <Input
            size="small"
            className="nodrag"
            placeholder="新列名"
            style={{ width: 140 }}
            value={newColInput}
            onChange={(e) => setNewColInput(e.target.value)}
            onPressEnter={() => addColumn()}
          />
          <Button size="small" type="default" onClick={addColumn}>
            添加列
          </Button>
          <Select
            size="small"
            className="nodrag"
            allowClear
            placeholder="删列：先选列名"
            style={{ width: 160 }}
            options={keys.map((k) => ({ label: k, value: k }))}
            value={removeCol}
            onChange={(v) => setRemoveCol(v)}
          />
          <Popconfirm
            title={`确定从所有行删除列「${removeCol ?? ''}」？`}
            okText="删除"
            okButtonProps={{ danger: true }}
            disabled={!removeCol}
            onConfirm={() => {
              if (removeCol) deleteColumnConfirmed(removeCol)
            }}
          >
            <Button size="small" danger disabled={!removeCol}>
              删除列
            </Button>
          </Popconfirm>
        </Space>
      )}
    </div>
  )
}
