/** 列表「同步状态」文案 → antd Tag 颜色（宽松匹配中英文） */
export function syncStatusTagColor(text: string): 'success' | 'processing' | 'error' | 'default' {
  if (/失败|错误|fail|error|abort/i.test(text)) return 'error'
  if (/成功|完成|success|done|\bok\b/i.test(text)) return 'success'
  if (/进行中|同步中|排队|等待|running|pending|queued|syncing/i.test(text)) return 'processing'
  return 'default'
}
