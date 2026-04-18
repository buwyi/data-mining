import { App } from 'antd'
import { useEffect, useRef } from 'react'
import { useTipdmSocketUiStore } from '../../stores/tipdmSocketUiStore'

/** 订阅全局 Socket 旁路事件（如数据源同步），用 antd Message 提示 */
export function DatasourceSocketNotifyBridge() {
  const { message } = App.useApp()
  const seq = useTipdmSocketUiStore((s) => s.datasourceNotifySeq)
  const text = useTipdmSocketUiStore((s) => s.datasourceNotifyText)
  const prevSeq = useRef(0)

  useEffect(() => {
    if (seq <= 0 || seq === prevSeq.current) return
    prevSeq.current = seq
    message.open({
      type: 'info',
      content: text,
      duration: 6,
    })
  }, [message, seq, text])

  return null
}
