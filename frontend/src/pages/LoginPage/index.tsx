import { LoginOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Space, Typography } from 'antd'
import { useMemo } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { buildOAuthAuthorizeUrl } from '../../auth/oauthPaths'
import { resolveOAuthClientId, resolveOAuthClientSecret } from '../../auth/oauthClient'
import { setPostLoginRedirect } from '../../auth/postLoginRedirect'
import { useConfigStore } from '../../stores/configStore'
import { useAuthStore } from '../../stores/authStore'

const { Paragraph, Title } = Typography

export function LoginPage() {
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
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
    setPostLoginRedirect(from && from !== '/login' ? from : '/home/main')
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
          登录
        </Title>
        <Paragraph type="secondary">
          使用与旧版 TipDM 相同的 OAuth 授权服务；授权成功后将回到本站的 <code>/oauth/callback</code>。
        </Paragraph>
        {!clientId ? (
          <Alert
            type="warning"
            showIcon
            message="未配置 OAuth 客户端 ID"
            description="请在 public/config.json 中设置 oauthClientId，或配置环境变量 VITE_OAUTH_CLIENT_ID。"
            style={{ marginBottom: 16 }}
          />
        ) : null}
        {!hasSecret ? (
          <Alert
            type="info"
            showIcon
            message="未配置 client_secret"
            description="换票需要 VITE_OAUTH_CLIENT_SECRET（开发环境 .env.local）。生产环境建议由后端代理换票，避免在浏览器暴露密钥。"
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
            前往授权登录
          </Button>
        </Space>
      </Card>
    </div>
  )
}
