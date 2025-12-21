import type { Board, Element, ImageElement } from '@/types'
import { stringifyForStorage } from '@/utils/jsonStorage'
import { hrefToBlob, putImageBlob, getImageBlob, getKnownImageHashFromObjectUrl, getObjectUrlForImageHash, getBaseDir, ensureDirs, blobToDataUrl } from '@/services/imageStore'
import { slimBoardAsync, slimBoardForLocalStorage, pickRecentBoards, inflateBoardsForSession } from '@/services/boardSession'
const dbName = 'BananaPodDB'
const dbVersion = 3
let dbPromise: Promise<IDBDatabase> | null = null
const isBrowserEnv = (typeof window !== 'undefined')
const canUseIndexedDB = isBrowserEnv && (typeof indexedDB !== 'undefined')
let perfLastEnabledCheckAt = 0
let perfEnabledCached = false
let perfLogTimer: number | null = null
let perfCounters = { touch: 0, debounced: 0, idleRun: 0, save: 0, flush: 0 }
let perfLastSaveBackend: 'indexedDB' | 'localStorage' | 'server' | null = null
let perfLastStringifyMs: number | null = null
let perfLastStringifyVia: 'worker' | 'main' | null = null
function isForceLocalStorageEnabled(): boolean {
  if (!isBrowserEnv) return false
  try {
    return localStorage.getItem('BANANAPOD_DEBUG_FORCE_LOCALSTORAGE') === '1'
  } catch {
    return false
  }
}
function isPerfEnabled(): boolean {
  if (!isBrowserEnv) return false
  const now = Date.now()
  if (now - perfLastEnabledCheckAt < 1000) return perfEnabledCached
  perfLastEnabledCheckAt = now
  try {
    perfEnabledCached = localStorage.getItem('BANANAPOD_DEBUG_PERF') === '1'
  } catch {
    perfEnabledCached = false
  }
  return perfEnabledCached
}
function schedulePerfLog() {
  if (!isPerfEnabled()) return
  if (perfLogTimer != null) return
  perfLogTimer = setTimeout(() => {
    perfLogTimer = null
    const snapshot = {
      ...perfCounters,
      backend: perfLastSaveBackend,
      stringifyMs: perfLastStringifyMs,
      stringifyVia: perfLastStringifyVia,
      hasPending: Boolean(lastSessionPending),
      hasIdlePending: Boolean(lastSessionIdlePending),
      hasTimer: Boolean(lastSessionTimer),
      hasIdleHandle: Boolean(lastSessionIdleHandle),
    }
    perfCounters = { touch: 0, debounced: 0, idleRun: 0, save: 0, flush: 0 }
    perfLastSaveBackend = null
    perfLastStringifyMs = null
    perfLastStringifyVia = null
    console.log('[Perf][LastSession]', snapshot)
  }, 1000) as unknown as number
}

async function serverModules() {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const cryptoNode = await import('node:crypto')
  const { Blob } = await import('node:buffer')
  return { fs, path, cryptoNode, Blob }
}

function openDB(): Promise<IDBDatabase> {
  if (!canUseIndexedDB) throw new Error('IndexedDB not available')
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, dbVersion)
    req.onupgradeneeded = () => {
      const db = req.result
      if (db.objectStoreNames.contains('history')) db.deleteObjectStore('history')
      if (!db.objectStoreNames.contains('lastSession')) db.createObjectStore('lastSession')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}
async function slimElement(el: Element): Promise<Element> {
  if ((el as ImageElement).type === 'image') {
    const img = el as ImageElement
    let href = img.href
    if (!href.startsWith('image:')) {
      if (isBrowserEnv && !canUseIndexedDB) return { ...el }
      if (isBrowserEnv && href.startsWith('blob:')) {
        const knownHash = getKnownImageHashFromObjectUrl(href)
        if (knownHash) href = `image:${knownHash}`
      }
      if (!href.startsWith('image:')) {
        const blob = await hrefToBlob(href, img.mimeType)
        const hash = await putImageBlob(blob)
        href = `image:${hash}`
      }
    }
    const next: ImageElement = {
      id: img.id,
      type: 'image',
      x: img.x,
      y: img.y,
      href,
      width: img.width,
      height: img.height,
      mimeType: img.mimeType,
      name: img.name,
      isVisible: img.isVisible,
      isLocked: img.isLocked,
      parentId: img.parentId,
      borderRadius: img.borderRadius,
      opacity: img.opacity,
    }
    return next
  }
  return { ...el }
}


async function inflateElementToDataUrl(el: Element): Promise<Element> {
  if ((el as ImageElement).type === 'image') {
    const img = el as ImageElement
    if (img.href.startsWith('image:')) {
      const hash = img.href.slice('image:'.length)
      const blob = await getImageBlob(hash)
      if (blob) {
        const objectUrl = getObjectUrlForImageHash(hash, blob)
        if (objectUrl) return { ...img, href: objectUrl, mimeType: blob.type || img.mimeType }
        const dataUrl = await blobToDataUrl(blob)
        return { ...img, href: dataUrl, mimeType: blob.type || img.mimeType }
      }
    }
  }
  return el
}

const lastSessionLocalStorageKey = 'bananapod:lastSession'
let lastSessionSaveCount = 0

async function saveLastSessionToIndexedDB(payload: { boards: Board[]; activeBoardId: string }) {
  const picked = pickRecentBoards(payload, 5)
  const slimmed = await Promise.all(picked.boards.map(b => slimBoardAsync(b, slimElement)))
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('lastSession', 'readwrite')
    const store = tx.objectStore('lastSession')
    const data = { timestamp: Date.now(), boards: slimmed, activeBoardId: picked.activeBoardId }
    try {
      store.put(data, 'data')
    } catch {
      try {
        store.put(JSON.stringify(data), 'data-json')
      } catch (err2) {
        return reject(err2 as Error)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function saveLastSessionToLocalStorage(payload: { boards: Board[]; activeBoardId: string }) {
  const picked = pickRecentBoards(payload, 5)
  const slimmed = picked.boards.map(slimBoardForLocalStorage)
  const data = { timestamp: Date.now(), boards: slimmed, activeBoardId: picked.activeBoardId }
  const r = await stringifyForStorage(data)
  perfLastSaveBackend = 'localStorage'
  perfLastStringifyMs = r.ms
  perfLastStringifyVia = r.via
  schedulePerfLog()
  localStorage.setItem(lastSessionLocalStorageKey, r.json)
}

export async function saveLastSession(payload: { boards: Board[]; activeBoardId: string }) {
  perfCounters.save += 1
  schedulePerfLog()
  lastSessionSaveCount += 1
  if (isBrowserEnv) {
    if (canUseIndexedDB && !isForceLocalStorageEnabled()) {
      try {
        await saveLastSessionToIndexedDB(payload)
        perfLastSaveBackend = 'indexedDB'
        schedulePerfLog()
        if (lastSessionSaveCount <= 2) console.log('[LastSession] saved to indexedDB')
        return
      } catch (err) {
        console.warn('[LastSession] indexedDB save failed, falling back to localStorage', err)
      }
    }

    try {
      await saveLastSessionToLocalStorage(payload)
      if (lastSessionSaveCount <= 2) console.log('[LastSession] saved to localStorage')
    } catch (err) {
      console.warn('[LastSession] localStorage save failed', err)
    }
    return
  }

  {
    const picked = pickRecentBoards(payload, 5)
    const slimmed = await Promise.all(picked.boards.map(b => slimBoardAsync(b, slimElement)))
    await ensureDirs()
    const { fs, path } = await serverModules()
    const base = getBaseDir()
    const data = { timestamp: Date.now(), boards: slimmed, activeBoardId: picked.activeBoardId }
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
    const json = JSON.stringify(data)
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
    perfLastSaveBackend = 'server'
    perfLastStringifyMs = Math.max(0, t1 - t0)
    perfLastStringifyVia = 'main'
    schedulePerfLog()
    await fs.writeFile(path.join(base, 'lastSession.json'), json)
  }
}
let lastSessionTimer: number | null = null
let lastSessionPending: { boards: Board[]; activeBoardId: string } | null = null
let lastSessionIdleHandle: number | null = null
let lastSessionIdlePending: { boards: Board[]; activeBoardId: string } | null = null

function scheduleLastSessionSaveInIdle(payload: { boards: Board[]; activeBoardId: string }) {
  const ric = (typeof window !== 'undefined' && 'requestIdleCallback' in window)
    ? (window.requestIdleCallback as unknown as (cb: () => void, opts?: { timeout?: number }) => number)
    : null

  if (!ric) {
    perfCounters.idleRun += 1
    schedulePerfLog()
    void saveLastSession(payload)
    return
  }

  lastSessionIdlePending = payload
  if (lastSessionIdleHandle != null) return

  lastSessionIdleHandle = ric(async () => {
    lastSessionIdleHandle = null
    const p = lastSessionIdlePending
    lastSessionIdlePending = null
    if (!p) return
    perfCounters.idleRun += 1
    schedulePerfLog()
    await saveLastSession(p)
  }, { timeout: 2000 })
}

export function touchLastSessionPending(payload: { boards: Board[]; activeBoardId: string }) {
  perfCounters.touch += 1
  schedulePerfLog()
  lastSessionPending = payload
  saveLastSessionDebounced(payload)
}
export function saveLastSessionDebounced(payload: { boards: Board[]; activeBoardId: string }, delay: number = 800) {
  perfCounters.debounced += 1
  schedulePerfLog()
  lastSessionPending = payload
  if (lastSessionTimer != null) {
    clearTimeout(lastSessionTimer)
  }
  lastSessionTimer = setTimeout(() => {
    const p = lastSessionPending
    lastSessionPending = null
    lastSessionTimer = null
    if (!p) return
    scheduleLastSessionSaveInIdle(p)
  }, delay) as unknown as number
}
export async function flushLastSessionSave() {
  perfCounters.flush += 1
  schedulePerfLog()
  if (lastSessionTimer != null) {
    clearTimeout(lastSessionTimer)
    lastSessionTimer = null
  }
  const cic = (typeof window !== 'undefined' && 'cancelIdleCallback' in window) ? (window.cancelIdleCallback as unknown as (id: number) => void) : null
  if (cic && lastSessionIdleHandle != null) {
    cic(lastSessionIdleHandle)
    lastSessionIdleHandle = null
  }
  const pending = lastSessionPending ?? lastSessionIdlePending
  lastSessionPending = null
  lastSessionIdlePending = null
  if (pending) {
    await saveLastSession(pending)
  }
}
export async function loadLastSession(): Promise<{ boards: Board[]; activeBoardId: string; timestamp: number } | null> {
  if (isBrowserEnv) {
    let raw: { boards: Board[]; activeBoardId: string; timestamp: number } | null = null
    if (canUseIndexedDB) {
      try {
        const db = await openDB()
        raw = await new Promise<{ boards: Board[]; activeBoardId: string; timestamp: number } | null>((resolve, reject) => {
          const tx = db.transaction('lastSession', 'readonly')
          const store = tx.objectStore('lastSession')
          const req = store.get('data')
          req.onsuccess = () => {
            const data = req.result
            if (data) { resolve(data as { boards: Board[]; activeBoardId: string; timestamp: number }); return }
            const req2 = store.get('data-json')
            req2.onsuccess = () => {
              const j = req2.result
              if (!j) { resolve(null); return }
              try { resolve(JSON.parse(j as string) as { boards: Board[]; activeBoardId: string; timestamp: number }) } catch { resolve(null) }
            }
            req2.onerror = () => reject(req2.error)
          }
          req.onerror = () => reject(req.error)
        })
      } catch (err) {
        console.warn('[LastSession] indexedDB load failed, falling back to localStorage', err)
      }
    }

    if (!raw) {
      try {
        const txt = localStorage.getItem(lastSessionLocalStorageKey)
        raw = txt ? (JSON.parse(txt) as { boards: Board[]; activeBoardId: string; timestamp: number }) : null
      } catch (err) {
        console.warn('[LastSession] localStorage load failed', err)
        raw = null
      }
    }

    if (!raw) return null
    const boards = await inflateBoardsForSession(raw.boards, raw.timestamp, inflateElementToDataUrl)
    const picked = pickRecentBoards({ boards, activeBoardId: raw.activeBoardId }, 5)
    return { boards: picked.boards, activeBoardId: picked.activeBoardId, timestamp: raw.timestamp }
  }

  {
    try {
      await ensureDirs()
      const { fs, path } = await serverModules()
      const base = getBaseDir()
      const file = path.join(base, 'lastSession.json')
      const txt = await fs.readFile(file, 'utf-8')
      const raw = JSON.parse(txt) as { boards: Board[]; activeBoardId: string; timestamp: number }
      const boards = await inflateBoardsForSession(raw.boards, raw.timestamp, inflateElementToDataUrl)
      const picked = pickRecentBoards({ boards, activeBoardId: raw.activeBoardId }, 5)
      return { boards: picked.boards, activeBoardId: picked.activeBoardId, timestamp: raw.timestamp }
    } catch {
      return null
    }
  }
}
