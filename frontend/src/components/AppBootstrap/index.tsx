import { ReloadOutlined } from '@ant-design/icons'
import { Button, Flex, Result, Spin, Typography } from 'antd'
import { useEffect, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useConfigStore } from '../../stores/configStore'

export function AppBootstrap({ children }: { children: ReactNode }) {
  const { status, error, load } = useConfigStore(
    useShallow((s) => ({ status: s.status, error: s.error, load: s.load })),
  )

  useEffect(() => {
    void load()
  }, [load])

  if (status === 'idle' || status === 'loading') {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }} vertical gap="middle">
        <Spin size="large" />
        <Typography.Text type="secondary">正在加载配置…</Typography.Text>
      </Flex>
    )
  }

  if (status === 'error') {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 24 }}>
        <Result
          status="error"
          title="配置加载失败"
          subTitle={error ?? '请检查网络与 config.json 是否可访问'}
          extra={
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => void load()}>
              重试
            </Button>
          }
        />
      </Flex>
    )
  }

  return <>{children}</>
}
