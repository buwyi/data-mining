import {
  ApartmentOutlined,
  DatabaseOutlined,
  DownOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Breadcrumb, Button, Dropdown, Layout, Menu, Modal, Radio, Space, theme, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { fetchTokenInfo } from '../../api/tokenApi'
import { BrowserCompatibilityAlert } from '../../components/BrowserCompatibilityAlert'
import { TipdmSocketStatusBanner } from '../../components/TipdmSocketStatusBanner'
import { SIDEBAR_MENU_PERMISSION, isPermissionGranted, isSidebarPathAllowed } from '../../config/menuPermissions'
import { useAuthStore } from '../../stores/authStore'
import { useConfigStore } from '../../stores/configStore'
import { useProjectStore } from '../../stores/projectStore'
import { useI18n, type AppLocale } from '../../i18n/I18nProvider'
import type { AppMessageKey } from '../../locales/app/zh-CN'

const { Header, Sider, Content } = Layout
const { Text } = Typography

type MenuSpec = {
  path: string
  icon: ReactNode
  labelKey: AppMessageKey
}

const SIDEBAR_MENU_SPECS: MenuSpec[] = [
  { path: '/home/main', icon: <HomeOutlined />, labelKey: 'menu.main' },
  { path: '/home/datasource', icon: <DatabaseOutlined />, labelKey: 'menu.datasource' },
  { path: '/home/project', icon: <ApartmentOutlined />, labelKey: 'menu.project' },
  { path: '/home/components', icon: <SettingOutlined />, labelKey: 'menu.components' },
]

export function AppLayout() {
  const { t, locale, setLocale } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const tokenUser = useAuthStore((s) => s.tokenUser)
  const setTokenUser = useAuthStore((s) => s.setTokenUser)
  const accessToken = useAuthStore((s) => s.accessToken)
  const configTitleRaw = useConfigStore((s) => s.config?.title)
  const configTitle = configTitleRaw ?? t('shell.brand')
  const projectMatch = useMatch('/home/project/:projectId')
  const urlProjectId = projectMatch?.params.projectId
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const projectDetailName = useProjectStore((s) => {
    const n = s.flowData.currentProjectDetail?.name
    return typeof n === 'string' && n.length > 0 ? n : null
  })

  const [aboutOpen, setAboutOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const permissions = tokenUser?.permissions ?? []

  const breadcrumbItems = useMemo(() => {
    const { pathname } = location
    if (pathname === '/home/main') {
      return [{ title: t('breadcrumb.main') }]
    }
    const homeLink = { title: <Link to="/home/main">{t('breadcrumb.main')}</Link> }
    if (pathname.startsWith('/home/datasource')) {
      return [homeLink, { title: t('breadcrumb.datasource') }]
    }
    if (pathname.startsWith('/home/components')) {
      return [homeLink, { title: t('breadcrumb.components') }]
    }
    if (pathname.startsWith('/home/project')) {
      const rest = [
        homeLink,
        { title: <Link to="/home/project">{t('breadcrumb.project')}</Link> },
      ] as { title: ReactNode }[]
      if (urlProjectId) {
        const idNum = Number.parseInt(urlProjectId, 10)
        const label =
          Number.isFinite(idNum) && currentProjectId === idNum && projectDetailName
            ? projectDetailName
            : t('breadcrumb.projectId', { id: urlProjectId })
        rest.push({ title: label })
      }
      return rest
    }
    if (pathname === '/home/forbidden') {
      return [homeLink, { title: t('breadcrumb.forbidden') }]
    }
    return [homeLink, { title: t('breadcrumb.page') }]
  }, [currentProjectId, location, projectDetailName, t, urlProjectId])

  const menuItems: MenuProps['items'] = useMemo(
    () =>
      SIDEBAR_MENU_SPECS.filter((spec) =>
        isPermissionGranted(SIDEBAR_MENU_PERMISSION[spec.path], permissions),
      ).map((spec) => ({
        key: spec.path,
        icon: spec.icon,
        label: <Link to={spec.path}>{t(spec.labelKey)}</Link>,
      })),
    [permissions, t],
  )

  useEffect(() => {
    if (!accessToken || tokenUser) return
    void fetchTokenInfo()
      .then((info) =>
        setTokenUser({
          username: typeof info.username === 'string' ? info.username : '',
          permissions: Array.isArray(info.permissions) ? info.permissions : [],
          shareable: Array.isArray(info.shareable) ? info.shareable : [],
        }),
      )
      .catch(() => {
        /* 保留登录态，仅不展示用户名 */
      })
  }, [accessToken, setTokenUser, tokenUser])

  useEffect(() => {
    if (!tokenUser) return
    if (location.pathname === '/home/forbidden') return
    if (isSidebarPathAllowed(location.pathname, tokenUser.permissions)) return
    navigate('/home/forbidden', {
      replace: true,
      state: { attemptedPath: location.pathname },
    })
  }, [location.pathname, navigate, tokenUser])

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
          {t('shell.brand')}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[String(selectedKey)]} items={menuItems} />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <Space size="middle" style={{ minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 16, fontWeight: 600, flexShrink: 0 }}>{t('shell.workbench')}</span>
            <Breadcrumb style={{ minWidth: 0 }} items={breadcrumbItems} />
          </Space>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'about',
                  icon: <InfoCircleOutlined />,
                  label: t('userMenu.about'),
                },
                {
                  key: 'settings',
                  icon: <SettingOutlined />,
                  label: t('userMenu.settings'),
                },
                { type: 'divider' },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: t('userMenu.logout'),
                  danger: true,
                },
              ] as MenuProps['items'],
              onClick: ({ key, domEvent }) => {
                domEvent.preventDefault()
                if (key === 'about') setAboutOpen(true)
                else if (key === 'settings') setSettingsOpen(true)
                else if (key === 'logout') {
                  clearAuth()
                  navigate('/login', { replace: true })
                }
              },
            }}
            placement="bottomRight"
          >
            <Button type="text" style={{ height: 'auto', padding: '4px 8px' }}>
              <Space>
                <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: 'var(--ant-color-primary)' }} />
                <span
                  style={{
                    maxWidth: 140,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                    verticalAlign: 'bottom',
                  }}
                >
                  {tokenUser?.username ? tokenUser.username : t('user.loggedIn')}
                </span>
                <DownOutlined style={{ fontSize: 10, opacity: 0.65 }} />
              </Space>
            </Button>
          </Dropdown>
        </Header>
        <Modal
          title={t('aboutModal.title')}
          open={aboutOpen}
          footer={null}
          onCancel={() => setAboutOpen(false)}
        >
          <p style={{ marginBottom: 8 }}>
            {t('aboutModal.appTitleLabel')}
            <strong>{configTitle}</strong>
          </p>
          <p style={{ margin: 0, color: 'var(--ant-color-text-secondary)', fontSize: 13 }}>
            {t('aboutModal.line1')}
            <code>config.json</code>
            {t('aboutModal.line2')}
            <code>operation-log/to-do.md</code>
            {t('aboutModal.line3')}
          </p>
        </Modal>
        <Modal
          title={t('settingsModal.title')}
          open={settingsOpen}
          onCancel={() => setSettingsOpen(false)}
          footer={[
            <Button key="close" type="primary" onClick={() => setSettingsOpen(false)}>
              {t('settingsModal.close')}
            </Button>,
          ]}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>{t('settingsModal.language')}</Text>
              <Radio.Group
                style={{ display: 'block', marginTop: 8 }}
                value={locale}
                onChange={(e) => setLocale(e.target.value as AppLocale)}
              >
                <Space direction="vertical">
                  <Radio value="zh-CN">{t('settingsModal.langZh')}</Radio>
                  <Radio value="en">{t('settingsModal.langEn')}</Radio>
                </Space>
              </Radio.Group>
            </div>
            <p style={{ margin: 0, color: 'var(--ant-color-text-secondary)' }}>
              {t('settingsModal.hintBefore')}
              <code>config.json</code>
              {t('settingsModal.hintAfter')}
            </p>
          </Space>
        </Modal>
        <Content style={{ margin: 24 }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <BrowserCompatibilityAlert />
            <TipdmSocketStatusBanner />
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
