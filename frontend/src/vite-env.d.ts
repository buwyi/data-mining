/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 运行时配置文件 URL，默认 `/config.json`（对应 `public/config.json`） */
  readonly VITE_APP_CONFIG_URL?: string
  /** 组件树系统根分类 ID（数字字符串，可选） */
  readonly VITE_COMPONENT_SYSTEM_CAT_ID?: string
  /** 组件树个人根分类 ID（数字字符串，可选） */
  readonly VITE_COMPONENT_PERSONAL_CAT_ID?: string
  /** OAuth 客户端 ID（与 config `oauthClientId` 二选一或同时存在时优先 config） */
  readonly VITE_OAUTH_CLIENT_ID?: string
  /** OAuth client_secret，仅开发换票用；生产建议后端代理换票 */
  readonly VITE_OAUTH_CLIENT_SECRET?: string
  /** localStorage token 键名，覆盖默认 `accessToken` */
  readonly VITE_ACCESS_TOKEN_STORAGE_KEY?: string
  /** 业务 API 鉴权请求头名，默认 `accessToken` */
  readonly VITE_ACCESS_TOKEN_HEADER_NAME?: string
  /** 鉴权头值前缀，如 `Bearer ` */
  readonly VITE_ACCESS_TOKEN_HEADER_PREFIX?: string
  /** 分享链接额外 query 名，逗号/空格分隔 */
  readonly VITE_SHARE_ACCESS_TOKEN_QUERY_PARAMS?: string
  /** OAuth 换票路径（相对 httpOauth），默认 `accessToken` */
  readonly VITE_OAUTH_ACCESS_TOKEN_PATH?: string
  /** Socket 握手 query 参数名，默认 `accessToken`（须与后端 SocketServer 一致） */
  readonly VITE_SOCKET_ACCESS_TOKEN_QUERY_PARAM?: string
  /** 与 TipDM `system.properties` 的 `LOG_HOME` 一致；可被 `config.json` 的 `tipdmLogHome` 覆盖 */
  readonly VITE_TIPDM_LOG_HOME?: string
  /** Ant Design 主色（如 `#1677ff`）；可被 `config.json` 的 `theme.colorPrimary` 覆盖 */
  readonly VITE_ANTD_COLOR_PRIMARY?: string
  /** 应用文案语言：`zh-CN` | `en`（与 `I18nProvider` 一致；未设时读 localStorage `app.locale`） */
  readonly VITE_DEFAULT_LOCALE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
