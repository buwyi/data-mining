/** 与旧版 TipDM `static/config.json` 字段对齐的运行时配置 */
export interface AppRuntimeConfig {
  httpServer: string
  httpOauth: string
  httpClient: string
  socketServer: string
  socketPort: number
  title: string
  /** 数据源上传单文件大小上限（MB，与旧版 Vuex 字段名一致） */
  databaseUploadFileSize: number
  mode: string
}
