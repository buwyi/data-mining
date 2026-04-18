/**
 * Socket 里 Quartz job 的 `nodeId`（即流程 JSON 里节点的 `id`）与 React Flow 节点 `id` 对齐。
 * 若画布 id 为 `纯数字_后缀`（端口等），而推送仅为纯数字，仍视为同一节点。
 */
export function tipdmCanvasNodeIdMatchesSocketJobId(canvasNodeId: string, socketJobId: string): boolean {
  const c = String(canvasNodeId).trim()
  const s = String(socketJobId).trim()
  if (!c || !s) return false
  if (c === s) return true
  if (!/^\d+$/.test(s)) return false
  return c.startsWith(`${s}_`)
}
