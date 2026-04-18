import { LoginOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Space, Typography } from 'antd'
import { useMemo } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { buildOAuthAuthorizeUrl } from '../../auth/oauthPaths'
import { resolveOAuthClientId, resolveOAuthClientSecret } from '../../auth/oauthClient'
import { setPostLoginRedirect } from '../../auth/postLoginRedirect'
import { BrowserCompatibilityAlert } from '../../components/BrowserCompatibilityAlert'
import { useI18n } from '../../i18n/I18nProvider'
import { useAuthStore } from '../../stores/authStore'
import { useConfigStore } from '../../stores/configStore'

const { Paragraph, Title } = Typography

export function LoginPage() {
  const { t } = useI18n()
  const location = useLocation()
  const config = useConfigStore((s) => s.config)
  const accessToken = useAuthStore((s) => s.accessToken)

  const clientId = useMemo(() => resolveOAuthClientId(config), [config])
  const hasSecret = resolveOAuthClientSecret().length > 0

  if (accessToken) {
    return <Navigate to="/home/main" replace />
  }

  const startLogin = () => {
    if (!clientId) return
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
    const path =
      from?.pathname && from.pathname !== '/login'
        ? `${from.pathname}${from.search ?? ''}`
        : '/home/main'
    setPostLoginRedirect(path)
    window.location.href = buildOAuthAuthorizeUrl(clientId)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--ant-color-bg-layout)',
      }}
    >
      <Card style={{ width: 'min(420px, 100%)' }} bordered={false}>
        <Title level={4} style={{ marginTop: 0 }}>
          {t('login.title')}
        </Title>
        <BrowserCompatibilityAlert />
        <Paragraph type="secondary">
          {t('login.line1')}
          <code>/oauth/callback</code>
          {t('login.line2')}
        </Paragraph>
        {!clientId ? (
          <Alert
            type="warning"
            showIcon
            message={t('login.noClientId')}
            description={t('login.noClientIdDesc')}
            style={{ marginBottom: 16 }}
          />
        ) : null}
        {!hasSecret ? (
          <Alert
            type="info"
            showIcon
            message={t('login.noSecret')}
            description={t('login.noSecretDesc')}
            style={{ marginBottom: 16 }}
          />
        ) : null}
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            type="primary"
            size="large"
            block
            icon={<LoginOutlined />}
            disabled={!clientId || !hasSecret}
            onClick={() => startLogin()}
          >
            {t('login.goAuthorize')}
          </Button>
        </Space>
      </Card>
    </div>
  )
}
