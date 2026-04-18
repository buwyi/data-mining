import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { connectTipdmSocket, disconnectTipdmSocket } from '../../realtime/tipdmSocketClient'
import { useAuthStore } from '../../stores/authStore'
import { useConfigStore } from '../../stores/configStore'

/** 配置就绪且已登录时维持全局 Socket，与旧版 TipDM 行为一致 */
export function RealtimeSocketBridge() {
  const { config } = useConfigStore(useShallow((s) => ({ config: s.config })))
  const token = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!config || !token) {
      disconnectTipdmSocket()
      return
    }
    return connectTipdmSocket(config, token)
  }, [config, token])

  return null
}
