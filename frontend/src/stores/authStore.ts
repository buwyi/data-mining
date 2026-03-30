import { create } from 'zustand'

/** 登录态与令牌（阶段 6 对接 OAuth / 路由守卫时扩展 user、过期时间等） */
export type AuthState = {
  accessToken: string | null
  setAccessToken: (token: string | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  setAccessToken: (accessToken) => set({ accessToken }),
  clearAuth: () => set({ accessToken: null }),
}))
