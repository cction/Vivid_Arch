import type { Board } from '@/types'

declare global {
  interface Window {
    __BANANAPOD_INITIAL_BOARDS__?: Board[]
    __BANANAPOD_INITIAL_ACTIVE_BOARD_ID__?: string
    requestIdleCallback?: (callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void, options?: { timeout?: number }) => number
    cancelIdleCallback?: (handle: number) => void
  }
}

export {}