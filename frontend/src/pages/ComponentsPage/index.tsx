import { Card, Col, Row, Typography } from 'antd'
import { ComponentLibraryTree } from '../../components/ComponentLibraryTree'
import { useComponentTreeRootIds } from '../../hooks/useComponentTreeRootIds'

const { Paragraph, Title } = Typography

export function ComponentsPage() {
  const { systemRootCatId, personalRootCatId } = useComponentTreeRootIds()

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={10} xl={8}>
        <ComponentLibraryTree
          systemRootCatId={systemRootCatId}
          personalRootCatId={personalRootCatId}
        />
      </Col>
      <Col xs={24} lg={14} xl={16}>
        <Card bordered={false} size="small" title="说明">
          <Title level={5} style={{ marginTop: 0 }}>
            系统组件与个人组件
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 8 }}>
            左侧为懒加载分类树：展开节点时请求 <code>{'GET /api/cat/{catId}/childs'}</code>。
            根分类 ID 可在 <code>public/config.json</code> 中设置{' '}
            <code>componentSystemCatId</code>、<code>componentPersonalCatId</code>，或使用环境变量{' '}
            <code>VITE_COMPONENT_SYSTEM_CAT_ID</code>、<code>VITE_COMPONENT_PERSONAL_CAT_ID</code>；未配置时默认
            为 1 与 2（需与后端实际根节点一致）。
          </Paragraph>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            从组件树拖拽节点到 React Flow 画布将在阶段 5 第二步与工程页对接。
          </Paragraph>
        </Card>
      </Col>
    </Row>
  )
}
