/** 与 Vite `public/config.json` 对应；部署时可通过环境变量指向 CDN 或其它路径 */
export function getAppConfigUrl(): string {
  return import.meta.env.VITE_APP_CONFIG_URL ?? '/config.json'
}
