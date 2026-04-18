import { create } from 'zustand'

/** 全局 TipDM Socket（流程运行高亮等）在 UI 上的连接阶段 */
export type TipdmSocketUiPhase = 'inactive' | 'connecting' | 'connected' | 'disconnected' | 'reconnect_failed'

type TipdmSocketUiState = {
  phase: TipdmSocketUiPhase
  /** 断开原因、连接错误、重连进度等（短句） */
  detail: string | null
  /** 数据源同步等旁路事件，供 `DatasourceSocketNotifyBridge` 弹出 Message */
  datasourceNotifySeq: number
  datasourceNotifyText: string
  patch: (next: { phase: TipdmSocketUiPhase; detail?: string | null }) => void
  emitDatasourceSocketNotify: (text: string) => void
}

export const useTipdmSocketUiStore = create<TipdmSocketUiState>((set) => ({
  phase: 'inactive',
  detail: null,
  datasourceNotifySeq: 0,
  datasourceNotifyText: '',
  patch: ({ phase, detail }) =>
    set((s) => ({
      phase,
      detail: detail !== undefined ? detail : phase === 'connected' || phase === 'inactive' ? null : s.detail,
    })),
  emitDatasourceSocketNotify: (text) =>
    set((s) => ({
      datasourceNotifySeq: s.datasourceNotifySeq + 1,
      datasourceNotifyText: text.trim() || '数据源状态已更新',
    })),
}))
