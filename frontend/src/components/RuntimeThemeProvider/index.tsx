import { ConfigProvider } from 'antd'
import { useMemo, type ReactNode } from 'react'
import { buildAntdThemeFromRuntime } from '../../config/buildAntdTheme'
import { useConfigStore } from '../../stores/configStore'

/**
 * 在 `AppBootstrap` 配置就绪后嵌套一层 `ConfigProvider`，合并 `config.json` / 环境变量中的主题 Token。
 */
export function RuntimeThemeProvider({ children }: { children: ReactNode }) {
  const cfg = useConfigStore((s) => s.config)
  const theme = useMemo(() => buildAntdThemeFromRuntime(cfg), [cfg])
  if (!theme) return <>{children}</>
  return <ConfigProvider theme={theme}>{children}</ConfigProvider>
}
