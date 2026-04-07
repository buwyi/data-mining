import { create } from 'zustand'

export type TokenUser = {
  username: string
  permissions: string[]
}

function readStoredAccessToken(): string | null {
  try {
    return localStorage.getItem('accessToken')
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
      if (accessToken) localStorage.setItem('accessToken', accessToken)
      else localStorage.removeItem('accessToken')
    } catch {
      /* ignore */
    }
  },
  setTokenUser: (tokenUser) => set({ tokenUser }),
  clearAuth: () => {
    set({ accessToken: null, tokenUser: null })
    try {
      localStorage.removeItem('accessToken')
    } catch {
      /* ignore */
    }
  },
}))
