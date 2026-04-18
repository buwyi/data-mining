import { useShallow } from 'zustand/react/shallow'
import { useConfigStore, type AppConfigStatus } from '../stores/configStore'
import type { AppRuntimeConfig } from '../types/appConfig'

export type UseAppConfigResult = {
  status: AppConfigStatus
  config: AppRuntimeConfig | null
  error: string | null
  /** 与历史命名一致，等价于 `useConfigStore.getState().load` */
  reload: () => Promise<void>
}

export function useAppConfig(): UseAppConfigResult {
  return useConfigStore(
    useShallow((s) => ({
      status: s.status,
      config: s.config,
      error: s.error,
      reload: s.load,
    })),
  )
}

/** 仅在配置已成功加载后使用；否则会抛错（用于路由内页面）。 */
export function useAppConfigReady(): AppRuntimeConfig {
  const status = useConfigStore((s) => s.status)
  const config = useConfigStore((s) => s.config)
  if (status !== 'ready' || !config) {
    throw new Error('useAppConfigReady 仅在配置加载完成后可用')
  }
  return config
}
