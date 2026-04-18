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
   * 缺省时使用环境变量 `VITE_COMPONENT_SYSTEM_CAT_ID`，再缺省为 `0`（与 TipDM 官方 `dm_component.parent_id = 0` 根一致）。
   */
  componentSystemCatId?: number
  /**
   * 组件树「个人/我的组件」根分类 ID。
   * 缺省时使用 `VITE_COMPONENT_PERSONAL_CAT_ID`，再缺省为 `0`。
   */
  componentPersonalCatId?: number
  /** OAuth `client_id`（可替代环境变量 `VITE_OAUTH_CLIENT_ID`） */
  oauthClientId?: string

  // —— 部署差异：鉴权头、持久化键、外链 query、OAuth 换票路径、Socket 握手（默认与 TipDM 一致）——

  /** localStorage 中 token 的键名，默认 `accessToken` */
  accessTokenStorageKey?: string
  /** 业务 API 请求头名，默认 `accessToken`；可与 `accessTokenHeaderPrefix` 组合为 `Authorization` + `Bearer ` */
  accessTokenHeaderName?: string
  /** 头值前缀（如 `Bearer `），默认空串 */
  accessTokenHeaderPrefix?: string
  /** `/show?...` 分享预览除默认键外额外识别的 query 参数名 */
  shareAccessTokenQueryParams?: string[]
  /** `POST {httpOauth}/{path}` 换票路径，默认 `accessToken` */
  oauthAccessTokenPath?: string
  /** Socket.IO 连接 query 参数名，TipDM 为 `accessToken` */
  socketAccessTokenQueryParam?: string

  /**
   * 与 TipDM `sysconfig/system.properties` 中 **`LOG_HOME`** 保持一致（部署目录，非 URL）。
   * 用于「节点日志」弹窗展示预期文件路径 `{LOG_HOME}/{clientId}.log`，以及加载失败时的排错提示。
   * 缺省时可设环境变量 **`VITE_TIPDM_LOG_HOME`**。
   */
  tipdmLogHome?: string

  /** Ant Design 5 主题 Token（可选）；主色可被 `VITE_ANTD_COLOR_PRIMARY` 兜底 */
  theme?: {
    colorPrimary?: string
    /** 组件圆角基数（px），建议 0–16 */
    borderRadius?: number
  }
}
