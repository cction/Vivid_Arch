import { useEffect, useState } from 'react'

export function useCredentials() {
  const [apiKey, setApiKey] = useState<string>(() => {
    try { return localStorage.getItem('WHATAI_API_KEY') || '' } catch { return '' }
  })
  const [grsaiApiKey, setGrsaiApiKey] = useState<string>(() => {
    try { return localStorage.getItem('GRSAI_API_KEY') || '' } catch { return '' }
  })
  const [systemToken, setSystemToken] = useState<string>(() => {
    try { return localStorage.getItem('WHATAI_SYSTEM_TOKEN') || '' } catch { return '' }
  })
  const [userId, setUserId] = useState<string>(() => {
    try { return localStorage.getItem('WHATAI_USER_ID') || '' } catch { return '' }
  })

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

  return { apiKey, setApiKey, grsaiApiKey, setGrsaiApiKey, systemToken, setSystemToken, userId, setUserId }
}
