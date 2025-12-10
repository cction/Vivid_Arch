import React, { useEffect, useMemo, useState } from 'react'
import { loadLastSession, pushHistoryBoard, pruneHistory, flushLastSessionSave } from '../services/boardsStorage'
import { SessionRestoreDialog } from '../components/SessionRestoreDialog'

import type { Board } from '@/types'
export const StartupGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false)
  const [last, setLast] = useState<{ boards: Board[]; activeBoardId: string; timestamp: number } | null>(null)
  const [decision, setDecision] = useState<'continue' | 'new' | null>(null)

  useEffect(() => {
    let cancelled = false
    loadLastSession().then(data => { if (!cancelled) setLast(data) }).finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    const handler = () => { flushLastSessionSave() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])
  useEffect(() => {
    const interval = setInterval(() => { flushLastSessionSave() }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleContinue = () => {
    if (last) {
      window.__BANANAPOD_INITIAL_BOARDS__ = last.boards
      window.__BANANAPOD_INITIAL_ACTIVE_BOARD_ID__ = last.activeBoardId
      Promise.all(last.boards.map((b: Board) => pushHistoryBoard(b))).then(() => pruneHistory(5)).catch(() => {})
    }
    setDecision('continue')
  }

  const handleNew = () => {
    if (last) {
      Promise.all(last.boards.map((b: Board) => pushHistoryBoard(b))).then(() => pruneHistory(5)).catch(() => {})
    }
    setDecision('new')
  }

  const showDialog = useMemo(() => ready && last && !decision, [ready, last, decision])

  if (showDialog) {
    const active = last!.boards.find((b: Board) => b.id === last!.activeBoardId) || last!.boards[0]
    return <SessionRestoreDialog onContinue={handleContinue} onNew={handleNew} lastName={active?.name} lastTime={last!.timestamp} />
  }

  return <>{children}</>
}