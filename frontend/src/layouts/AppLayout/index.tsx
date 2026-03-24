import {
  ApartmentOutlined,
  DatabaseOutlined,
  HomeOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { Layout, Menu, theme } from 'antd'
import type { MenuProps } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'

const { Header, Sider, Content } = Layout

const menuItems: MenuProps['items'] = [
  {
    key: '/home/main',
    icon: <HomeOutlined />,
    label: <Link to="/home/main">首页</Link>,
  },
  {
    key: '/home/datasource',
    icon: <DatabaseOutlined />,
    label: <Link to="/home/datasource">数据源</Link>,
  },
  {
    key: '/home/project',
    icon: <ApartmentOutlined />,
    label: <Link to="/home/project">工程</Link>,
  },
  {
    key: '/home/components',
    icon: <SettingOutlined />,
    label: <Link to="/home/components">系统组件</Link>,
  },
]

export function AppLayout() {
  const location = useLocation()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  /** 较长路径优先，避免 /home 之类前缀误匹配 */
  const pathKeys = ['/home/components', '/home/project', '/home/datasource', '/home/main'] as const
  const selectedKey =
    pathKeys.find((key) => location.pathname === key || location.pathname.startsWith(`${key}/`)) ??
    '/home/main'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0}>
        <div
          style={{
            height: 64,
            margin: 16,
            borderRadius: borderRadiusLG,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          数据挖掘
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[String(selectedKey)]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600 }}>工作台</span>
          <span style={{ color: 'var(--ant-color-text-secondary)' }}>占位：用户 / 退出</span>
        </Header>
        <Content style={{ margin: 24 }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
