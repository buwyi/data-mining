import { Alert } from 'antd'
import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { useI18n } from '../../i18n/I18nProvider'
import {
  isLikelyChromiumBrowser,
  persistBrowserHintDismissed,
  readBrowserHintDismissed,
} from '../../utils/chromiumBrowserHint'

/**
 * 与旧版 TipDM 类似：非 Chromium 浏览器提示使用 Chrome / Edge 以获得更好兼容性。
 * 关闭后写入 localStorage，本机不再弹出。
 */
export function BrowserCompatibilityAlert({ style }: { style?: CSSProperties }) {
  const { t } = useI18n()
  const [dismissed, setDismissed] = useState(() => readBrowserHintDismissed())

  const show = useMemo(() => !dismissed && !isLikelyChromiumBrowser(), [dismissed])

  const onClose = useCallback(() => {
    persistBrowserHintDismissed()
    setDismissed(true)
  }, [])

  if (!show) return null

  return (
    <Alert
      type="warning"
      showIcon
      closable
      onClose={onClose}
      message={t('browserCompat.message')}
      description={t('browserCompat.description')}
      style={{ marginBottom: 16, ...style }}
    />
  )
}
