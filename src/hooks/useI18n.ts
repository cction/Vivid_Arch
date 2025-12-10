import { useCallback, useState } from 'react'
import { translations } from '@/i18n/translations'

export function useI18n(initialLanguage: 'en' | 'ZH' = 'ZH') {
  const [language, setLanguage] = useState<'en' | 'ZH'>(initialLanguage)

  const t = useCallback((key: string, ...args: unknown[]): string => {
    const keys = key.split('.')
    let result: unknown = translations[language]
    for (const k of keys) {
      result = (result as Record<string, unknown> | undefined)?.[k]
    }
    if (typeof result === 'function') {
      return String((result as (...a: unknown[]) => unknown)(...args))
    }
    return String(result ?? key)
  }, [language])

  return { language, setLanguage, t }
}
