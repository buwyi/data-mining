import { Card, Typography } from 'antd'

const { Title, Paragraph } = Typography

export function MainPage() {
  return (
    <Card bordered={false}>
      <Title level={4}>首页</Title>
      <Paragraph type="secondary">后续可接入模板列表、快捷入口等。</Paragraph>
    </Card>
  )
}
