import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { appMessagesEn } from '../locales/app/en'
import { appMessagesZhCN, type AppMessageKey } from '../locales/app/zh-CN'

export type AppLocale = 'zh-CN' | 'en'

const CATALOG: Record<AppLocale, Record<AppMessageKey, string>> = {
  'zh-CN': appMessagesZhCN,
  en: appMessagesEn,
}

function resolveInitialLocale(): AppLocale {
  const fromEnv = import.meta.env.VITE_DEFAULT_LOCALE
  if (fromEnv === 'en' || fromEnv === 'zh-CN') return fromEnv
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('app.locale')
    if (stored === 'en' || stored === 'zh-CN') return stored
  }
  return 'zh-CN'
}

type I18nContextValue = {
  locale: AppLocale
  setLocale: (next: AppLocale) => void
  t: (key: AppMessageKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  let out = template
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, String(v))
  }
  return out
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(resolveInitialLocale)

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem('app.locale', next)
    } catch {
      /* ignore quota / private mode */
    }
  }, [])

  const t = useCallback(
    (key: AppMessageKey, vars?: Record<string, string | number>) => {
      const raw = CATALOG[locale][key]
      return interpolate(raw, vars)
    },
    [locale],
  )

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return ctx
}
