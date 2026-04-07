import { Collapse, Descriptions, Drawer, Spin, Typography } from 'antd'
import type { ComponentDefinitionDto } from '../../types/component'

const { Text, Paragraph } = Typography

export type ComponentDetailDrawerProps = {
  open: boolean
  loading: boolean
  data: ComponentDefinitionDto | null
  onClose: () => void
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

export function ComponentDetailDrawer({ open, loading, data, onClose }: ComponentDetailDrawerProps) {
  const engine =
    data?.extra && typeof data.extra === 'object' && data.extra !== null && 'engine' in data.extra
      ? String((data.extra as { engine?: unknown }).engine ?? '')
      : ''

  return (
    <Drawer title="组件详情" width={520} open={open} onClose={onClose} destroyOnHidden>
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : data ? (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="名称">{String(data.name ?? '')}</Descriptions.Item>
            <Descriptions.Item label="描述">
              <Paragraph style={{ marginBottom: 0 }}>{String(data.description ?? '—')}</Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="算法类">{String(data.targetAlgorithm ?? '—')}</Descriptions.Item>
            <Descriptions.Item label="引擎">{engine || '—'}</Descriptions.Item>
            <Descriptions.Item label="最少输入">{String(data.minimumInput ?? '—')}</Descriptions.Item>
            <Descriptions.Item label="允许看源码">
              {data.allowViewSource === true ? '是' : data.allowViewSource === false ? '否' : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="启用">
              {data.enabled === true ? '是' : data.enabled === false ? '否' : '—'}
            </Descriptions.Item>
          </Descriptions>

          <Collapse
            style={{ marginTop: 16 }}
            items={[
              {
                key: 'io',
                label: `输入 / 输出（${Array.isArray(data.inputs) ? data.inputs.length : 0} / ${Array.isArray(data.outputs) ? data.outputs.length : 0}）`,
                children: (
                  <pre style={{ margin: 0, maxHeight: 240, overflow: 'auto', fontSize: 12 }}>
                    {JSON.stringify({ inputs: data.inputs ?? [], outputs: data.outputs ?? [] }, null, 2)}
                  </pre>
                ),
              },
              {
                key: 'tabs',
                label: `参数页签（${Array.isArray(data.tabs) ? data.tabs.length : 0}）`,
                children: (
                  <pre style={{ margin: 0, maxHeight: 240, overflow: 'auto', fontSize: 12 }}>
                    {JSON.stringify(data.tabs ?? [], null, 2)}
                  </pre>
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
  )
}
