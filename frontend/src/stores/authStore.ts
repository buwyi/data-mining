import { create } from 'zustand'
import { resolveAccessTokenStorageKey } from '../config/accessTokenRuntime'

export type TokenUser = {
  username: string
  permissions: string[]
  /** `GET /token/info` → `shareable`，用于数据源共享等 */
  shareable?: unknown[]
}

function readStoredAccessToken(): string | null {
  try {
    return localStorage.getItem(resolveAccessTokenStorageKey())
  } catch {
    return null
  }
}

export type AuthState = {
  accessToken: string | null
  tokenUser: TokenUser | null
  setAccessToken: (token: string | null) => void
  setTokenUser: (user: TokenUser | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: readStoredAccessToken(),
  tokenUser: null,
  setAccessToken: (accessToken) => {
    set({ accessToken })
    try {
      const key = resolveAccessTokenStorageKey()
      if (accessToken) localStorage.setItem(key, accessToken)
      else localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
  setTokenUser: (tokenUser) => set({ tokenUser }),
  clearAuth: () => {
    set({ accessToken: null, tokenUser: null })
    try {
      localStorage.removeItem(resolveAccessTokenStorageKey())
    } catch {
      /* ignore */
    }
  },
}))
