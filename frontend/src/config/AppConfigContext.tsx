import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppRuntimeConfig } from '../types/appConfig'
import { getAppConfigUrl } from './appConfigUrl'
import { parseAppConfig } from './parseAppConfig'

export type AppConfigStatus = 'idle' | 'loading' | 'ready' | 'error'

export type AppConfigContextValue = {
  status: AppConfigStatus
  config: AppRuntimeConfig | null
  error: string | null
  reload: () => Promise<void>
}

const AppConfigContext = createContext<AppConfigContextValue | null>(null)

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppConfigStatus>('idle')
  const [config, setConfig] = useState<AppRuntimeConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestSeq = useRef(0)

  const reload = useCallback(async () => {
    const seq = ++requestSeq.current
    const url = getAppConfigUrl()
    setStatus('loading')
    setError(null)

    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`请求配置失败：${res.status} ${res.statusText}`)
      }
      let json: unknown
      try {
        json = await res.json()
      } catch {
        throw new Error('配置文件不是合法的 JSON')
      }
      const next = parseAppConfig(json)
      if (seq !== requestSeq.current) return
      document.title = next.title
      setConfig(next)
      setStatus('ready')
      setError(null)
    } catch (e) {
      if (seq !== requestSeq.current) return
      const message = e instanceof Error ? e.message : '加载配置时发生未知错误'
      setConfig(null)
      setStatus('error')
      setError(message)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const value = useMemo(
    (): AppConfigContextValue => ({
      status,
      config,
      error,
      reload,
    }),
    [status, config, error, reload],
  )

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>
}

export function useAppConfig(): AppConfigContextValue {
  const ctx = useContext(AppConfigContext)
  if (!ctx) {
    throw new Error('useAppConfig 必须在 AppConfigProvider 内使用')
  }
  return ctx
}

/** 仅在配置已成功加载后使用；否则会抛错（用于路由内页面）。 */
export function useAppConfigReady(): AppRuntimeConfig {
  const { status, config } = useAppConfig()
  if (status !== 'ready' || !config) {
    throw new Error('useAppConfigReady 仅在配置加载完成后可用')
  }
  return config
}
