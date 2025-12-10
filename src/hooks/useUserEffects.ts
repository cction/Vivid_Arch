import { useCallback, useEffect, useState } from 'react'
import type { UserEffect } from '@/types'

export function useUserEffects() {
  const [userEffects, setUserEffects] = useState<UserEffect[]>(() => {
    try {
      const saved = localStorage.getItem('userEffects')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('userEffects', JSON.stringify(userEffects))
    } catch {
      void 0
    }
  }, [userEffects])

  const addUserEffect = useCallback((effect: UserEffect) => {
    setUserEffects(prev => [...prev, effect])
  }, [])

  const deleteUserEffect = useCallback((id: string) => {
    setUserEffects(prev => prev.filter(effect => effect.id !== id))
  }, [])

  return { userEffects, addUserEffect, deleteUserEffect, setUserEffects }
}
