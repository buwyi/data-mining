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
    /** TipDM `initData.sql` 中内置分类挂在 `dm_component.parent_id = 0`，对应 `GET /api/cat/0/childs` */
    systemRootCatId:
      config?.componentSystemCatId ?? parseEnvInt(import.meta.env.VITE_COMPONENT_SYSTEM_CAT_ID, 0),
    /** 个人/UDA 根在库中同样多为 `parent_id = 0` + `in_built = false`；与系统树共用 cat API 时由界面区分，见 ComponentLibraryTree */
    personalRootCatId:
      config?.componentPersonalCatId ?? parseEnvInt(import.meta.env.VITE_COMPONENT_PERSONAL_CAT_ID, 0),
  }
}
