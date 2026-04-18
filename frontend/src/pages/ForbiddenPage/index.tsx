import { Button, Result, Typography } from 'antd'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nProvider'

const { Paragraph, Text } = Typography

export function ForbiddenPage() {
  const { t } = useI18n()
  const location = useLocation()
  const attempted =
    typeof location.state === 'object' &&
    location.state !== null &&
    'attemptedPath' in location.state &&
    typeof (location.state as { attemptedPath?: unknown }).attemptedPath === 'string'
      ? (location.state as { attemptedPath: string }).attemptedPath
      : null

  return (
    <Result
      status="403"
      title={t('forbidden.title')}
      subTitle={t('forbidden.subtitle')}
      extra={
        <Button type="primary">
          <Link to="/home/main">{t('forbidden.backHome')}</Link>
        </Button>
      }
    >
      {attempted ? (
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'left' }}>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('forbidden.attemptedPath')}
          </Paragraph>
          <Paragraph style={{ marginTop: 4 }}>
            <Text code>{attempted}</Text>
          </Paragraph>
        </div>
      ) : null}
    </Result>
  )
}
