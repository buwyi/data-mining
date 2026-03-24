import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

export function DataSourcePage() {
  return (
    <Card bordered={false}>
      <Title level={4}>数据源</Title>
      <Paragraph type="secondary">后续接入数据源列表、上传与预览。</Paragraph>
    </Card>
  )
}
