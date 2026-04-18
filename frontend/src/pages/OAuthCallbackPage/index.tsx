import { LoadingOutlined } from '@ant-design/icons'
import { Alert, Card, Spin, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exchangeAuthorizationCode } from '../../api/oauthApi'
import { fetchTokenInfo } from '../../api/tokenApi'
import { getOAuthRedirectUri } from '../../auth/oauthPaths'
import { resolveOAuthClientId, resolveOAuthClientSecret } from '../../auth/oauthClient'
import { consumePostLoginRedirect } from '../../auth/postLoginRedirect'
import { BrowserCompatibilityAlert } from '../../components/BrowserCompatibilityAlert'
import { useI18n } from '../../i18n/I18nProvider'
import { useConfigStore } from '../../stores/configStore'
import { useAuthStore } from '../../stores/authStore'

const { Paragraph, Text, Title } = Typography

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

export function OAuthCallbackPage() {
  const { t } = useI18n()
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
    if (!code) return t('oauthCallback.paramMissingCode')
    const clientId = resolveOAuthClientId(config)
    const clientSecret = resolveOAuthClientSecret()
    if (!clientId || !clientSecret) return t('oauthCallback.paramBadClientConfig')
    return null
  }, [code, config, oauthError, oauthErrorDesc, t])

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
            shareable: Array.isArray(info.shareable) ? info.shareable : [],
          })
        } catch {
          setTokenUser({ username: '', permissions: [], shareable: [] })
        }
        const next = consumePostLoginRedirect()
        navigate(next, { replace: true })
      } catch (e) {
        if (isAbortError(e)) return
        setFetchError(e instanceof Error ? e.message : t('oauthCallback.exchangeFailed'))
      }
    })()

    return () => ac.abort()
  }, [code, config, navigate, paramError, setAccessToken, setTokenUser, t])

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
          <Title level={4}>{t('oauthCallback.titleIncomplete')}</Title>
          <BrowserCompatibilityAlert style={{ marginBottom: 12 }} />
          <Alert type="error" message={displayError} showIcon style={{ marginTop: 12 }} />
          <Paragraph style={{ marginTop: 16 }}>
            <Text type="secondary">{t('oauthCallback.returnHintBefore')}</Text>{' '}
            <a href="/login">{t('oauthCallback.backLogin')}</a>
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
        padding: 24,
      }}
    >
      <BrowserCompatibilityAlert style={{ width: 'min(480px, 100%)' }} />
      <Spin indicator={<LoadingOutlined spin style={{ fontSize: 32 }} />} />
      <Text type="secondary">{t('oauthCallback.finishing')}</Text>
    </div>
  )
}
