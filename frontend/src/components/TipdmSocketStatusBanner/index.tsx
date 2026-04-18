import { Alert, Button, Space } from 'antd'
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/I18nProvider'
import { reconnectTipdmSocketNow } from '../../realtime/tipdmSocketClient'
import { useAuthStore } from '../../stores/authStore'
import { useConfigStore } from '../../stores/configStore'
import { useTipdmSocketUiStore } from '../../stores/tipdmSocketUiStore'

/**
 * 登录且已加载配置时，提示实时通道断开/重连失败，避免用户误以为节点高亮仍可靠。
 */
export function TipdmSocketStatusBanner() {
  const { t } = useI18n()
  const accessToken = useAuthStore((s) => s.accessToken)
  const config = useConfigStore((s) => s.config)
  const phase = useTipdmSocketUiStore((s) => s.phase)
  const detail = useTipdmSocketUiStore((s) => s.detail)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (phase === 'connected') setDismissed(false)
  }, [phase])

  const shouldConnect = Boolean(accessToken && config)
  if (!shouldConnect || phase === 'inactive' || phase === 'connecting' || phase === 'connected') {
    return null
  }
  if (dismissed && (phase === 'disconnected' || phase === 'reconnect_failed')) {
    return null
  }

  const isFailed = phase === 'reconnect_failed'
  const desc =
    detail != null && detail.length > 0
      ? `${t('socketBanner.accuracyWarning')}${detail}`
      : t('socketBanner.descNoDetail')

  return (
    <Alert
      type={isFailed ? 'error' : 'warning'}
      showIcon
      closable
      onClose={() => setDismissed(true)}
      message={isFailed ? t('socketBanner.msgReconnectFailed') : t('socketBanner.msgDisconnected')}
      description={
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <span>{desc}</span>
          <Button size="small" type="primary" onClick={() => reconnectTipdmSocketNow()}>
            {t('socketBanner.reconnect')}
          </Button>
        </Space>
      }
      style={{ marginBottom: 16 }}
    />
  )
}
