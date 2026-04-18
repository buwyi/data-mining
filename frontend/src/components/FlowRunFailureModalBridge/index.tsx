import { App } from 'antd'
import { useEffect, useRef } from 'react'
import { useProjectStore } from '../../stores/projectStore'

/** 消费 store 中的 `runFailureAlert`，弹出错误提示（须在 `<App>` 内挂载） */
export function FlowRunFailureModalBridge() {
  const runFailureAlert = useProjectStore((s) => s.flowData.runFailureAlert)
  const clearRunFailureAlert = useProjectStore((s) => s.clearRunFailureAlert)
  const { modal } = App.useApp()
  const lastShownKey = useRef<number | null>(null)

  useEffect(() => {
    if (!runFailureAlert) return
    if (lastShownKey.current === runFailureAlert.key) return
    lastShownKey.current = runFailureAlert.key
    modal.error({
      title: runFailureAlert.title,
      width: 520,
      content: (
        <div style={{ whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto' }}>
          {runFailureAlert.message}
        </div>
      ),
      onOk: () => clearRunFailureAlert(),
      onCancel: () => clearRunFailureAlert(),
    })
    clearRunFailureAlert()
  }, [runFailureAlert, clearRunFailureAlert, modal])

  return null
}
