/** 与后端 `Result` 包装一致（见 operation-log/api-doc.md） */
export type ApiStatus = 'SUCCESS' | 'FAIL'

export type ApiResult<T> = {
  status: ApiStatus
  message?: string
  data?: T
}
