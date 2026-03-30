import { create } from 'zustand'

/**
 * 数据源与上传流程（阶段 4 扩展）。
 * 上传大小上限等见 `useConfigStore` → `config.databaseUploadFileSize`。
 */
export type DatasourceState = Record<string, never>

export const useDatasourceStore = create<DatasourceState>(() => ({}))
