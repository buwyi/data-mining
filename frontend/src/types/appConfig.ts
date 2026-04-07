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
  /**
   * 组件树「系统组件」根分类 ID（`GET /api/cat/{id}/childs`）。
   * 缺省时使用环境变量 `VITE_COMPONENT_SYSTEM_CAT_ID`，再缺省为 `1`。
   */
  componentSystemCatId?: number
  /**
   * 组件树「个人/我的组件」根分类 ID。
   * 缺省时使用 `VITE_COMPONENT_PERSONAL_CAT_ID`，再缺省为 `2`。
   */
  componentPersonalCatId?: number
  /** OAuth `client_id`（可替代环境变量 `VITE_OAUTH_CLIENT_ID`） */
  oauthClientId?: string
}
