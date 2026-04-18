import type { ThemeConfig } from 'antd'
import type { AppRuntimeConfig } from '../types/appConfig'

/**
 * 从运行时配置与环境变量生成 Ant Design 5 `ConfigProvider` 的 `theme`。
 * `config.theme` 优先于 `VITE_ANTD_COLOR_PRIMARY`（仅主色）。
 */
export function buildAntdThemeFromRuntime(config: AppRuntimeConfig | null): ThemeConfig | undefined {
  const t = config?.theme
  const token: NonNullable<ThemeConfig['token']> = {}

  const fromConfigPrimary =
    typeof t?.colorPrimary === 'string' && t.colorPrimary.trim() ? t.colorPrimary.trim() : undefined
  const envPrimary = import.meta.env.VITE_ANTD_COLOR_PRIMARY
  const fromEnv =
    typeof envPrimary === 'string' && envPrimary.trim() ? envPrimary.trim() : undefined
  const primary = fromConfigPrimary ?? fromEnv
  if (primary) token.colorPrimary = primary

  const br = t?.borderRadius
  if (typeof br === 'number' && Number.isFinite(br) && br >= 0 && br <= 64) {
    token.borderRadius = br
  }

  if (Object.keys(token).length === 0) return undefined
  return { token }
}
