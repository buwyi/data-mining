/**
 * TipDM `GET /api/project/node/{id}/log` 等接口的路径参数 `id` 为 **Long**（与 `JobProvider` 里
 * `Long.parseLong(node.getId())` / 日志文件名 `{clientId}.log` 一致），须为纯数字或至少以数字开头。
 */
export function tipdmClientIdForNodeFilesystemApis(nodeId: string): string {
  const s = String(nodeId).trim()
  if (s.length === 0) {
    throw new Error('节点 id 为空，无法请求日志或报告')
  }
  if (/^\d+$/.test(s)) return s
  const portLike = s.match(/^(\d+)_\d+_\d+$/)
  if (portLike) return portLike[1]
  const prefix = s.match(/^(\d+)_/)
  if (prefix) return prefix[1]
  throw new Error(
    `节点 id「${s}」无法映射为 TipDM 所需的数字 clientId（请使用流程 JSON 中节点的 id，勿使用端口 id）`,
  )
}
