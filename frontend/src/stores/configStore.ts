import { create } from 'zustand'
import type { AppRuntimeConfig } from '../types/appConfig'
import { getAppConfigUrl } from '../config/appConfigUrl'
import { parseAppConfig } from '../config/parseAppConfig'

export type AppConfigStatus = 'idle' | 'loading' | 'ready' | 'error'

let loadSeq = 0

export type ConfigState = {
  status: AppConfigStatus
  config: AppRuntimeConfig | null
  error: string | null
  /** 拉取并校验 `config.json`，成功后写入 `config` 并更新 `document.title` */
  load: () => Promise<void>
}

export const useConfigStore = create<ConfigState>((set) => ({
  status: 'idle',
  config: null,
  error: null,
  load: async () => {
    const seq = ++loadSeq
    const url = getAppConfigUrl()
    set({ status: 'loading', error: null })

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
      if (seq !== loadSeq) return
      document.title = next.title
      set({ status: 'ready', config: next, error: null })
    } catch (e) {
      if (seq !== loadSeq) return
      const message = e instanceof Error ? e.message : '加载配置时发生未知错误'
      set({ status: 'error', config: null, error: message })
    }
  },
}))
