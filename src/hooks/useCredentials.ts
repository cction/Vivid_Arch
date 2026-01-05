import { useEffect, useState } from 'react'

function isEmbeddedInIFrame(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function findNextNamedParamIndex(query: string, from: number): number {
  for (let i = query.indexOf('&', from); i !== -1; i = query.indexOf('&', i + 1)) {
    const rest = query.slice(i + 1)
    const eq = rest.indexOf('=')
    if (eq <= 0) continue
    const name = rest.slice(0, eq)
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return i
  }
  return -1
}

function extractQueryValue(query: string, key: string, mode: 'nextAmp' | 'nextNamedOrEnd'): string {
  const token = `${key}=`
  const start = query.indexOf(token)
  if (start < 0) return ''
  const valueStart = start + token.length
  if (valueStart >= query.length) return ''

  let end = query.length
  if (mode === 'nextAmp') {
    const nextAmp = query.indexOf('&', valueStart)
    if (nextAmp !== -1) end = nextAmp
  } else {
    const nextNamed = findNextNamedParamIndex(query, valueStart)
    if (nextNamed !== -1) end = nextNamed
  }

  return query.slice(valueStart, end)
}

function tryGetInjectedKeysFromUrl(): { apiKey: string; grsaiApiKey: string } | null {
  if (typeof window === 'undefined') return null
  if (!isEmbeddedInIFrame()) return null

  const { protocol, pathname, search } = window.location
  if (!protocol || (protocol !== 'http:' && protocol !== 'https:')) return null
  if (pathname !== '/') return null
  if (!search || !search.startsWith('?')) return null

  const query = search.slice(1)
  const hasKey1 = query.includes('key1=')
  const hasKey2 = query.includes('key2=')
  if (!hasKey1 && !hasKey2) return null

  const apiKey = hasKey1 ? safeDecodeURIComponent(extractQueryValue(query, 'key1', 'nextAmp')) : ''
  const grsaiApiKey = hasKey2 ? safeDecodeURIComponent(extractQueryValue(query, 'key2', 'nextNamedOrEnd')) : ''

  if (!apiKey && !grsaiApiKey) return null
  return { apiKey, grsaiApiKey }
}

export function useCredentials() {
  const [injectedKeys] = useState<{ apiKey: string; grsaiApiKey: string } | null>(() => tryGetInjectedKeysFromUrl())
  const [apiKey, setApiKey] = useState<string>(() => {
    if (injectedKeys?.apiKey) return injectedKeys.apiKey
    try { return localStorage.getItem('WHATAI_API_KEY') || '' } catch { return '' }
  })
  const [grsaiApiKey, setGrsaiApiKey] = useState<string>(() => {
    if (injectedKeys?.grsaiApiKey) return injectedKeys.grsaiApiKey
    try { return localStorage.getItem('GRSAI_API_KEY') || '' } catch { return '' }
  })
  const [systemToken, setSystemToken] = useState<string>(() => {
    try { return localStorage.getItem('WHATAI_SYSTEM_TOKEN') || '' } catch { return '' }
  })
  const [userId, setUserId] = useState<string>(() => {
    try { return localStorage.getItem('WHATAI_USER_ID') || '' } catch { return '' }
  })
  const [isKeyInputLocked] = useState<boolean>(() => Boolean(injectedKeys))

  useEffect(() => {
    if (!injectedKeys) return

    try {
      if (injectedKeys.apiKey) localStorage.setItem('WHATAI_API_KEY', injectedKeys.apiKey)
      else localStorage.removeItem('WHATAI_API_KEY')
    } catch { void 0 }
    try {
      if (injectedKeys.grsaiApiKey) localStorage.setItem('GRSAI_API_KEY', injectedKeys.grsaiApiKey)
      else localStorage.removeItem('GRSAI_API_KEY')
    } catch { void 0 }

    try {
      console.log('[Credentials] url injected keys enabled', {
        iframe: true,
        path: window.location.pathname,
        hasKey1: Boolean(injectedKeys.apiKey),
        hasKey2: Boolean(injectedKeys.grsaiApiKey),
        key1Length: injectedKeys.apiKey.length,
        key2Length: injectedKeys.grsaiApiKey.length,
      })
    } catch { void 0 }
  }, [injectedKeys])

  useEffect(() => {
    try { if (apiKey) localStorage.setItem('WHATAI_API_KEY', apiKey); else localStorage.removeItem('WHATAI_API_KEY') } catch { void 0 }
  }, [apiKey])

  useEffect(() => {
    try { if (grsaiApiKey) localStorage.setItem('GRSAI_API_KEY', grsaiApiKey); else localStorage.removeItem('GRSAI_API_KEY') } catch { void 0 }
  }, [grsaiApiKey])

  useEffect(() => {
    try { if (systemToken) localStorage.setItem('WHATAI_SYSTEM_TOKEN', systemToken); else localStorage.removeItem('WHATAI_SYSTEM_TOKEN') } catch { void 0 }
  }, [systemToken])

  useEffect(() => {
    try { if (userId) localStorage.setItem('WHATAI_USER_ID', userId); else localStorage.removeItem('WHATAI_USER_ID') } catch { void 0 }
  }, [userId])

  return { apiKey, setApiKey, grsaiApiKey, setGrsaiApiKey, systemToken, setSystemToken, userId, setUserId, isKeyInputLocked }
}
