import { ReloadOutlined } from '@ant-design/icons'
import { Button, Flex, Result, Spin, Typography } from 'antd'
import { useEffect, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { checkAccessToken } from '../../api/tokenApi'
import { useI18n } from '../../i18n/I18nProvider'
import { useAuthStore } from '../../stores/authStore'
import { useConfigStore } from '../../stores/configStore'

export function AppBootstrap({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { status, error, load } = useConfigStore(
    useShallow((s) => ({ status: s.status, error: s.error, load: s.load })),
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (status !== 'ready') return
    const token = useAuthStore.getState().accessToken
    if (!token) return
    void checkAccessToken().catch(() => {
      useAuthStore.getState().clearAuth()
    })
  }, [status])

  if (status === 'idle' || status === 'loading') {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }} vertical gap="middle">
        <Spin size="large" />
        <Typography.Text type="secondary">{t('bootstrap.loadingConfig')}</Typography.Text>
      </Flex>
    )
  }

  if (status === 'error') {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 24 }}>
        <Result
          status="error"
          title={t('bootstrap.configErrorTitle')}
          subTitle={error ?? t('bootstrap.configErrorHint')}
          extra={
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => void load()}>
              {t('bootstrap.retry')}
            </Button>
          }
        />
      </Flex>
    )
  }

  return <>{children}</>
}
