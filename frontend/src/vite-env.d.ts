/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 运行时配置文件 URL，默认 `/config.json`（对应 `public/config.json`） */
  readonly VITE_APP_CONFIG_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
