import { Button, Input, InputNumber, Space, Switch, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo } from 'react'

const { Text } = Typography

type Row = { key: string; val: unknown }

function isPrimitiveJson(v: unknown): boolean {
  return (
    v === null ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  )
}

function ValueCell({
  k,
  val,
  readOnly,
  onCommit,
}: {
  k: string
  val: unknown
  readOnly: boolean
  onCommit: (key: string, next: unknown) => void
}) {
  if (readOnly) {
    if (val === null || val === undefined) return <Text type="secondary">—</Text>
    if (typeof val === 'boolean') return <Text>{val ? 'true' : 'false'}</Text>
    if (typeof val === 'object') {
      try {
        return (
          <Text code style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(val, null, 2)}
          </Text>
        )
      } catch {
        return <Text>（无法展示）</Text>
      }
    }
    return <Text style={{ wordBreak: 'break-word' }}>{String(val)}</Text>
  }

  if (typeof val === 'boolean') {
    return (
      <Switch
        size="small"
        className="nodrag"
        checked={val}
        onChange={(checked) => onCommit(k, checked)}
      />
    )
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    return (
      <InputNumber
        size="small"
        className="nodrag"
        style={{ width: '100%' }}
        value={val}
        onChange={(n) => onCommit(k, n === null || n === undefined ? '' : n)}
      />
    )
  }
  if (val === null || val === undefined || isPrimitiveJson(val)) {
    const str = val === null || val === undefined ? '' : String(val)
    return (
      <Input
        size="small"
        className="nodrag"
        variant="filled"
        value={str}
        placeholder="空"
        onChange={(e) => onCommit(k, e.target.value)}
      />
    )
  }
  let json = ''
  try {
    json = JSON.stringify(val, null, 2)
  } catch {
    json = String(val)
  }
  return (
    <Input.TextArea
      size="small"
      className="nodrag"
      variant="filled"
      rows={3}
      style={{ fontFamily: 'monospace', fontSize: 12 }}
      value={json}
      onChange={(e) => {
        const raw = e.target.value
        const t = raw.trim()
        if (t === '') {
          onCommit(k, '')
          return
        }
        try {
          onCommit(k, JSON.parse(t) as unknown)
        } catch {
          onCommit(k, raw)
        }
      }}
    />
  )
}

export type FeatureValueTableProps = {
  /** 平面键值对象 */
  value: Record<string, unknown>
  readOnly?: boolean
  /** 可编辑时必填；只读可不传 */
  onChange?: (next: Record<string, unknown>) => void
}

/** 侧栏「特征」类参数：用表格展示特征名 / 特征值，替代大段 JSON 文本框 */
export function FeatureValueTable({ value, readOnly, onChange }: FeatureValueTableProps) {
  const fire = onChange ?? (() => {})
  const dataSource: Row[] = useMemo(
    () => Object.keys(value).map((key) => ({ key, val: value[key] })),
    [value],
  )

  const patch = (next: Record<string, unknown>) => {
    fire(next)
  }

  const setVal = (k: string, v: unknown) => {
    patch({ ...value, [k]: v })
  }

  const remove = (k: string) => {
    const { [k]: _, ...rest } = value
    patch(rest)
  }

  const addRow = () => {
    let n = 1
    let name = `feature_${n}`
    while (name in value) {
      n += 1
      name = `feature_${n}`
    }
    patch({ ...value, [name]: '' })
  }

  const columns: ColumnsType<Row> = [
    {
      title: '特征名',
      dataIndex: 'key',
      key: 'name',
      width: '34%',
      ellipsis: true,
      render: (k: string) => (
        <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: k }}>
          {k}
        </Text>
      ),
    },
    {
      title: '特征值',
      dataIndex: 'val',
      key: 'val',
      render: (_: unknown, row) => (
        <ValueCell k={row.key} val={row.val} readOnly={readOnly ?? false} onCommit={setVal} />
      ),
    },
    ...(readOnly
      ? []
      : [
          {
            title: '操作',
            key: 'op',
            width: 64,
            align: 'center' as const,
            render: (_: unknown, row: Row) => (
              <Button type="link" size="small" danger className="nodrag" onClick={() => remove(row.key)}>
                删除
              </Button>
            ),
          },
        ]),
  ]

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Table<Row>
        size="small"
        bordered
        pagination={false}
        rowKey={(r) => r.key}
        dataSource={dataSource}
        columns={columns}
        locale={{ emptyText: '暂无特征项' }}
        scroll={{ x: 'max-content' }}
      />
      {!readOnly && onChange ? (
        <div>
          <Button size="small" type="dashed" block className="nodrag" onClick={addRow}>
            添加特征
          </Button>
        </div>
      ) : null}
    </Space>
  )
}
