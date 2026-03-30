import { create } from 'zustand'

/** 当前工程 / Flow 编辑上下文（阶段 2 起对齐 Vuex project 模块） */
export type ProjectState = {
  currentProjectId: string | null
  setCurrentProjectId: (id: string | null) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProjectId: null,
  setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),
}))
