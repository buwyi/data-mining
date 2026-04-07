import { Button, Card, Space, Typography } from 'antd'
import { useState } from 'react'
import { AddFlatFileDialog } from '../../components/AddFlatFileDialog'

const { Title, Paragraph } = Typography

export function DataSourcePage() {
  const [flatOpen, setFlatOpen] = useState(false)

  return (
    <Card bordered={false}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }} wrap>
          <Title level={4} style={{ margin: 0 }}>
            数据源
          </Title>
          <Button type="primary" onClick={() => setFlatOpen(true)}>
            新建数据源（CSV）
          </Button>
        </Space>
        <Paragraph type="secondary">数据源列表与检索将在后续步骤接入；可先通过上方入口完成 CSV 上传建表。</Paragraph>
      </Space>

      <AddFlatFileDialog open={flatOpen} onClose={() => setFlatOpen(false)} />
    </Card>
  )
}
