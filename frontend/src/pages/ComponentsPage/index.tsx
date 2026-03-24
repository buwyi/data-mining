import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

export function ComponentsPage() {
  return (
    <Card bordered={false}>
      <Title level={4}>系统组件</Title>
      <Paragraph type="secondary">后续接入组件目录与自定义组件编辑。</Paragraph>
    </Card>
  )
}
