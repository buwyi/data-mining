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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
