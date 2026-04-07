import { useConfigStore } from '../stores/configStore'

function parseEnvInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export function useComponentTreeRootIds(): {
  systemRootCatId: number
  personalRootCatId: number
} {
  const config = useConfigStore((s) => s.config)
  return {
    systemRootCatId:
      config?.componentSystemCatId ?? parseEnvInt(import.meta.env.VITE_COMPONENT_SYSTEM_CAT_ID, 1),
    personalRootCatId:
      config?.componentPersonalCatId ?? parseEnvInt(import.meta.env.VITE_COMPONENT_PERSONAL_CAT_ID, 2),
  }
}
