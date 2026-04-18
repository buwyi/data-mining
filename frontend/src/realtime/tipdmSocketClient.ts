/**
 * TipDM `SocketIOServer` 为 Socket.IO **2.x**；须使用 `socket.io-client@2.x`。
 * 使用 3.x/4.x 客户端会出现「v2 server 与 v3/v4 client 不兼容」类错误；须保持 **2.x**（如 **2.5.0**，`v2-latest`；部分镜像未同步 2.4.1 可用 2.5.0）。
 */
import io from 'socket.io-client'
import { resolveSocketAccessTokenQueryParam } from '../config/accessTokenRuntime'
import type { AppRuntimeConfig } from '../types/appConfig'
import { useAuthStore } from '../stores/authStore'
import { useConfigStore } from '../stores/configStore'
import { useProjectStore } from '../stores/projectStore'
import { useTipdmSocketUiStore } from '../stores/tipdmSocketUiStore'
import { parseDatasourceSocketNotify } from './parseDatasourceSocketNotify'
import { parseTipdmSocketPayload } from './parseTipdmSocketPayload'

const DATASYNC_EVENT = 'dataSyncResult'

/** socket.io-client@2.x 实例（本文件用到的 API 子集） */
type IoClientSocket = {
  connected: boolean
  on(ev: string, fn: (...args: unknown[]) => void): IoClientSocket
  off(ev: string, fn?: (...args: unknown[]) => void): IoClientSocket
  removeAllListeners(ev?: string): IoClientSocket
  close(): void
}

let socket: IoClientSocket | null = null

/** 取消 `workFlowId` 与 store 的联动订阅（在断开连接时释放） */
let flowStoreUnsub: (() => void) | null = null

/** 当前在 socket 上监听的流程事件名（等于 `workFlowId`） */
let subscribedFlowEventName: string | null = null

function dispatchFlowPayload(eventName: string, args: unknown[]): void {
  const ev = parseTipdmSocketPayload(eventName, args)
  if (ev) {
    useProjectStore.getState().applyRemoteFlowSocketEvent(ev)
    return
  }
  if (
    import.meta.env.DEV &&
    subscribedFlowEventName !== null &&
    eventName === subscribedFlowEventName
  ) {
    console.debug('[tipdm-socket] workflow event not parsed', { eventName, firstArg: args[0] })
  }
}

function onDataSyncResult(...args: unknown[]): void {
  const dsText = parseDatasourceSocketNotify(DATASYNC_EVENT, args)
  if (dsText) useTipdmSocketUiStore.getState().emitDatasourceSocketNotify(dsText)
}

function onSubscribedFlowEvent(...args: unknown[]): void {
  if (subscribedFlowEventName === null) return
  dispatchFlowPayload(subscribedFlowEventName, args)
}

function clearFlowEventListener(s: IoClientSocket): void {
  if (subscribedFlowEventName !== null) {
    s.off(subscribedFlowEventName, onSubscribedFlowEvent)
    subscribedFlowEventName = null
  }
}

function syncFlowEventSubscription(s: IoClientSocket, workFlowId: string | null): void {
  clearFlowEventListener(s)
  if (workFlowId === null) return
  const id = String(workFlowId).trim()
  if (id.length === 0) return
  subscribedFlowEventName = id
  s.on(id, onSubscribedFlowEvent)
}

export function disconnectTipdmSocket(): void {
  flowStoreUnsub?.()
  flowStoreUnsub = null
  if (socket) {
    clearFlowEventListener(socket)
    socket.removeAllListeners()
    socket.close()
    socket = null
  }
  useTipdmSocketUiStore.getState().patch({ phase: 'inactive', detail: null })
}

/** 手动触发一次连接（与 `RealtimeSocketBridge` 使用相同配置） */
export function reconnectTipdmSocketNow(): void {
  const config = useConfigStore.getState().config
  const token = useAuthStore.getState().accessToken
  if (!config || !token) return
  connectTipdmSocket(config, token)
}

/**
 * `io(url, { query })`：**始终**包含 `accessToken`（TipDM `SocketServer` 硬编码读取）；若配置了其它 query 名则一并附带同值。
 * 具名订阅：`dataSyncResult`；流程进度为 **动态事件名 = 当前 store 中的 `workFlowId`**（随运行开始/结束挂接/卸下）。
 */
export function connectTipdmSocket(config: AppRuntimeConfig, accessToken: string): () => void {
  disconnectTipdmSocket()
  useTipdmSocketUiStore.getState().patch({ phase: 'connecting', detail: null })
  const url = `http://${config.socketServer}:${config.socketPort}`
  /** TipDM `SocketServer` 仅 `getSingleUrlParam("accessToken")`，必须带该 query；可额外带自定义键以兼容魔改部署 */
  const tokenQueryKey = resolveSocketAccessTokenQueryParam()
  const query: Record<string, string> = { accessToken }
  if (tokenQueryKey !== 'accessToken') query[tokenQueryKey] = accessToken
  const s = io(url, {
    query,
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelayMax: 12000,
  }) as IoClientSocket
  socket = s

  s.on('connect', () => {
    useTipdmSocketUiStore.getState().patch({ phase: 'connected', detail: null })
    syncFlowEventSubscription(s, useProjectStore.getState().flowData.workFlowId)
    if (import.meta.env.DEV) {
      console.debug('[tipdm-socket] connected', url)
    }
  })
  s.on('disconnect', (...args: unknown[]) => {
    const reason = args[0]
    useTipdmSocketUiStore.getState().patch({
      phase: 'disconnected',
      detail: typeof reason === 'string' ? reason : 'disconnect',
    })
    if (import.meta.env.DEV) {
      console.debug('[tipdm-socket] disconnect', reason)
    }
  })
  s.on('connect_error', (...args: unknown[]) => {
    const err = args[0]
    const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'connect_error'
    useTipdmSocketUiStore.getState().patch({
      phase: 'disconnected',
      detail: msg,
    })
    if (import.meta.env.DEV) {
      console.debug('[tipdm-socket] connect_error', msg)
    }
  })
  s.on('reconnect_attempt', (...args: unknown[]) => {
    const attempt = args[0]
    useTipdmSocketUiStore.getState().patch({
      phase: 'connecting',
      detail: `正在重连（第 ${String(attempt)} 次）…`,
    })
  })
  s.on('reconnect', () => {
    useTipdmSocketUiStore.getState().patch({ phase: 'connected', detail: null })
    syncFlowEventSubscription(s, useProjectStore.getState().flowData.workFlowId)
  })
  s.on('reconnect_failed', () => {
    useTipdmSocketUiStore.getState().patch({
      phase: 'reconnect_failed',
      detail: '已达到最大重连次数',
    })
  })

  s.on(DATASYNC_EVENT, onDataSyncResult)

  let prevWf: string | null | undefined
  flowStoreUnsub = useProjectStore.subscribe((state) => {
    const wf = state.flowData.workFlowId
    if (wf === prevWf) return
    prevWf = wf
    if (socket !== null) syncFlowEventSubscription(socket, wf)
  })
  prevWf = useProjectStore.getState().flowData.workFlowId
  if (s.connected) {
    syncFlowEventSubscription(s, prevWf ?? null)
  }

  return () => {
    disconnectTipdmSocket()
  }
}
