import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

export function ProjectPage() {
  return (
    <Card bordered={false}>
      <Title level={4}>工程</Title>
      <Paragraph type="secondary">后续接入工程树与流程画布（React Flow 等）。</Paragraph>
    </Card>
  )
}
