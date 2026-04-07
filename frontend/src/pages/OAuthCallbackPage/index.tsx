import { LoadingOutlined } from '@ant-design/icons'
import { Alert, Card, Spin, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exchangeAuthorizationCode } from '../../api/oauthApi'
import { fetchTokenInfo } from '../../api/tokenApi'
import { getOAuthRedirectUri } from '../../auth/oauthPaths'
import { resolveOAuthClientId, resolveOAuthClientSecret } from '../../auth/oauthClient'
import { consumePostLoginRedirect } from '../../auth/postLoginRedirect'
import { useConfigStore } from '../../stores/configStore'
import { useAuthStore } from '../../stores/authStore'

const { Paragraph, Text, Title } = Typography

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

export function OAuthCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const config = useConfigStore((s) => s.config)
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setTokenUser = useAuthStore((s) => s.setTokenUser)

  const [fetchError, setFetchError] = useState<string | null>(null)

  const oauthError = params.get('error')
  const oauthErrorDesc = params.get('error_description')
  const code = params.get('code')

  const paramError = useMemo(() => {
    if (oauthError) return oauthErrorDesc ?? oauthError
    if (!code) return '缺少授权码（code），请从登录入口重新发起授权。'
    const clientId = resolveOAuthClientId(config)
    const clientSecret = resolveOAuthClientSecret()
    if (!clientId || !clientSecret) return '未配置 OAuth 客户端 ID 或 client_secret，无法换票。'
    return null
  }, [code, config, oauthError, oauthErrorDesc])

  const displayError = paramError ?? fetchError

  useEffect(() => {
    if (paramError || !code) return undefined

    const clientId = resolveOAuthClientId(config)
    const clientSecret = resolveOAuthClientSecret()
    if (!clientId || !clientSecret) return undefined

    const ac = new AbortController()

    void (async () => {
      try {
        const redirectUri = getOAuthRedirectUri()
        const token = await exchangeAuthorizationCode(
          {
            code,
            redirectUri,
            clientId,
            clientSecret,
          },
          { signal: ac.signal },
        )
        setAccessToken(token)
        try {
          const info = await fetchTokenInfo()
          setTokenUser({
            username: typeof info.username === 'string' ? info.username : '',
            permissions: Array.isArray(info.permissions) ? info.permissions : [],
          })
        } catch {
          setTokenUser({ username: '', permissions: [] })
        }
        const next = consumePostLoginRedirect()
        navigate(next, { replace: true })
      } catch (e) {
        if (isAbortError(e)) return
        setFetchError(e instanceof Error ? e.message : '换票失败')
      }
    })()

    return () => ac.abort()
  }, [code, config, navigate, paramError, setAccessToken, setTokenUser])

  if (displayError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Card style={{ width: 'min(480px, 100%)' }}>
          <Title level={4}>登录未完成</Title>
          <Alert type="error" message={displayError} showIcon style={{ marginTop: 12 }} />
          <Paragraph style={{ marginTop: 16 }}>
            <Text type="secondary">请关闭本页或</Text>{' '}
            <a href="/login">返回登录页</a>
          </Paragraph>
        </Card>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <Spin indicator={<LoadingOutlined spin style={{ fontSize: 32 }} />} />
      <Text type="secondary">正在完成登录…</Text>
    </div>
  )
}
