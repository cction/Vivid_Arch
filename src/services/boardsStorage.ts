import type { Board, Element, ImageElement } from '@/types'
const dbName = 'BananaPodDB'
const dbVersion = 3
let dbPromise: Promise<IDBDatabase> | null = null
const isBrowserEnv = (typeof window !== 'undefined')
const canUseIndexedDB = isBrowserEnv && (typeof indexedDB !== 'undefined')
const canUseWebCrypto = isBrowserEnv
  && (typeof crypto !== 'undefined')
  && (crypto.subtle != null)
  && (typeof crypto.subtle.digest === 'function')
let perfLastEnabledCheckAt = 0
let perfEnabledCached = false
let perfLogTimer: number | null = null
let perfCounters = { touch: 0, debounced: 0, idleRun: 0, save: 0, flush: 0 }
let perfLastSaveBackend: 'indexedDB' | 'localStorage' | 'server' | null = null
let perfLastStringifyMs: number | null = null
let perfLastStringifyVia: 'worker' | 'main' | null = null
let perfLastImgDataUrlToBlobCount: number | null = null
let perfLastImgDataUrlToBlobMs: number | null = null
let perfLastImgDataUrlToBlobVia: 'fetch' | 'main' | 'mixed' | null = null
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
      imgDataUrlToBlobCount: perfLastImgDataUrlToBlobCount,
      imgDataUrlToBlobMs: perfLastImgDataUrlToBlobMs,
      imgDataUrlToBlobVia: perfLastImgDataUrlToBlobVia,
      hasPending: Boolean(lastSessionPending),
      hasIdlePending: Boolean(lastSessionIdlePending),
      hasTimer: Boolean(lastSessionTimer),
      hasIdleHandle: Boolean(lastSessionIdleHandle),
    }
    perfCounters = { touch: 0, debounced: 0, idleRun: 0, save: 0, flush: 0 }
    perfLastSaveBackend = null
    perfLastStringifyMs = null
    perfLastStringifyVia = null
    perfLastImgDataUrlToBlobCount = null
    perfLastImgDataUrlToBlobMs = null
    perfLastImgDataUrlToBlobVia = null
    console.log('[Perf][LastSession]', snapshot)
  }, 1000) as unknown as number
}

let stringifyWorkerUrl: string | null = null
let stringifyWorker: Worker | null = null
let stringifyReqId = 0
const stringifyPending = new Map<number, { resolve: (v: string) => void; reject: (e: unknown) => void; startedAt: number }>()

function canUseStringifyWorker(): boolean {
  return isBrowserEnv
    && (typeof Worker !== 'undefined')
    && (typeof Blob !== 'undefined')
    && (typeof URL !== 'undefined')
    && (typeof URL.createObjectURL === 'function')
}

function getStringifyWorker(): Worker | null {
  if (!canUseStringifyWorker()) return null
  if (stringifyWorker) return stringifyWorker

  const src = `
self.onmessage = (e) => {
  const id = e.data && e.data.id
  const data = e.data && e.data.data
  try {
    const json = JSON.stringify(data)
    self.postMessage({ id, json })
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) })
  }
}
`
  const blob = new Blob([src], { type: 'text/javascript' })
  stringifyWorkerUrl = URL.createObjectURL(blob)
  stringifyWorker = new Worker(stringifyWorkerUrl)
  stringifyWorker.onmessage = (e: MessageEvent) => {
    const id = e.data && e.data.id
    const pending = stringifyPending.get(id)
    if (!pending) return
    stringifyPending.delete(id)
    if (e.data && typeof e.data.json === 'string') {
      pending.resolve(e.data.json)
      return
    }
    pending.reject(new Error(e.data && e.data.error ? String(e.data.error) : 'worker stringify failed'))
  }
  stringifyWorker.onerror = (ev) => {
    const pendingAll = Array.from(stringifyPending.values())
    stringifyPending.clear()
    for (const p of pendingAll) p.reject(ev)
    try { stringifyWorker?.terminate() } catch (err) { void err }
    stringifyWorker = null
    if (stringifyWorkerUrl) {
      try { URL.revokeObjectURL(stringifyWorkerUrl) } catch (err) { void err }
    }
    stringifyWorkerUrl = null
  }
  return stringifyWorker
}

async function stringifyForStorage(data: unknown): Promise<{ json: string; ms: number; via: 'worker' | 'main' }> {
  const w = getStringifyWorker()
  if (!w) {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
    const json = JSON.stringify(data)
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
    return { json, ms: Math.max(0, t1 - t0), via: 'main' }
  }

  const id = ++stringifyReqId
  const startedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
  const p = new Promise<string>((resolve, reject) => {
    stringifyPending.set(id, { resolve, reject, startedAt })
  })
  w.postMessage({ id, data })
  const json = await p
  const endedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
  return { json, ms: Math.max(0, endedAt - startedAt), via: 'worker' }
}
async function serverModules() {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const cryptoNode = await import('node:crypto')
  const { Blob } = await import('node:buffer')
  return { fs, path, cryptoNode, Blob }
}

function fnv1a64Hex(bytes: Uint8Array): string {
  let h = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  for (let i = 0; i < bytes.length; i++) {
    h ^= BigInt(bytes[i])
    h = (h * prime) & 0xffffffffffffffffn
  }
  return h.toString(16).padStart(16, '0')
}
function getBaseDir() {
  const p = (typeof process !== 'undefined' && process.env && process.env.BANANAPOD_DATA_DIR) ? process.env.BANANAPOD_DATA_DIR as string : undefined
  return p || ((typeof process !== 'undefined' && process.cwd) ? (process.cwd() + '/bananapod-data') : 'bananapod-data')
}
async function ensureDirs() {
  const { fs, path } = await serverModules()
  const base = getBaseDir()
  await fs.mkdir(base, { recursive: true })
  await fs.mkdir(path.join(base, 'images'), { recursive: true })
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
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'hash' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}
async function sha256Hex(ab: ArrayBuffer): Promise<string> {
  if (isBrowserEnv) {
    if (canUseWebCrypto) {
      const digest = await crypto.subtle.digest('SHA-256', ab)
      const bytes = new Uint8Array(digest)
      let hex = ''
      for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
      return hex
    }
    const bytes = new Uint8Array(ab)
    return `fnv1a64_${fnv1a64Hex(bytes)}`
  }

  {
    const { cryptoNode } = await serverModules()
    const buf = Buffer.from(ab)
    return cryptoNode.createHash('sha256').update(buf).digest('hex')
  }
}

async function hrefToBlob(href: string, expectedMime?: string): Promise<Blob> {
  if (isBrowserEnv) {
    if (href.startsWith('data:')) {
      const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
      let via: 'fetch' | 'main' = 'fetch'
      let blob: Blob
      try {
        const res = await fetch(href)
        blob = await res.blob()
      } catch (err) {
        via = 'main'
        const comma = href.indexOf(',')
        const meta = href.substring(0, comma)
        const b64Raw = href.substring(comma + 1)
        const mimeMatch = /data:(.*?)(;base64)?$/i.exec(meta)
        const mime = (mimeMatch && mimeMatch[1]) ? mimeMatch[1] : (expectedMime || 'application/octet-stream')
        const b64 = (() => {
          let s = String(b64Raw).replace(/[\r\n\s]/g, '').replace(/-/g, '+').replace(/_/g, '/')
          const pad = s.length % 4
          if (pad === 2) s += '=='
          else if (pad === 3) s += '='
          else if (pad === 1) s += '==='
          return s
        })()
        const bin = atob(b64)
        const arr = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
        blob = new Blob([arr.buffer], { type: mime })
        void err
      }
      const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
      if (isPerfEnabled()) {
        perfLastImgDataUrlToBlobCount = (perfLastImgDataUrlToBlobCount ?? 0) + 1
        perfLastImgDataUrlToBlobMs = (perfLastImgDataUrlToBlobMs ?? 0) + Math.max(0, t1 - t0)
        perfLastImgDataUrlToBlobVia = (perfLastImgDataUrlToBlobVia == null || perfLastImgDataUrlToBlobVia === via) ? via : 'mixed'
        schedulePerfLog()
      }
      if (expectedMime && blob.type && expectedMime !== blob.type) return new Blob([await blob.arrayBuffer()], { type: expectedMime })
      return blob
    }
    const res = await fetch(href)
    const blob = await res.blob()
    if (expectedMime && blob.type && expectedMime !== blob.type) return new Blob([await blob.arrayBuffer()], { type: expectedMime })
    return blob
  } else {
    const { Blob } = await serverModules()
    if (href.startsWith('data:')) {
      const comma = href.indexOf(',')
      const meta = href.substring(0, comma)
      const b64 = href.substring(comma + 1)
      const mimeMatch = /data:(.*?)(;base64)?$/i.exec(meta)
      const mime = (mimeMatch && mimeMatch[1]) ? mimeMatch[1] : (expectedMime || 'application/octet-stream')
      const buf = Buffer.from(b64, 'base64')
      return new Blob([buf], { type: mime })
    }
    const res = await fetch(href)
    const ab = await res.arrayBuffer()
    const mime = expectedMime || (res.headers.get('content-type') || 'application/octet-stream')
    return new Blob([ab], { type: mime })
  }
}

async function putImageBlob(blob: Blob): Promise<string> {
  const ab = await blob.arrayBuffer()
  const hash = await sha256Hex(ab)
  if (isBrowserEnv) {
    if (!canUseIndexedDB) return hash
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('images', 'readwrite')
      const store = tx.objectStore('images')
      const getReq = store.get(hash)
      getReq.onsuccess = () => {
        if (!getReq.result) store.put({ hash, blob, mimeType: blob.type, size: ab.byteLength, savedAt: Date.now() })
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return hash
  } else {
    await ensureDirs()
    const { fs, path } = await serverModules()
    const base = getBaseDir()
    const file = path.join(base, 'images', hash)
    await fs.writeFile(file, Buffer.from(ab))
    return hash
  }
}

async function getImageBlob(hash: string): Promise<Blob | null> {
  if (isBrowserEnv) {
    if (!canUseIndexedDB) return null
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readonly')
      const store = tx.objectStore('images')
      const req = store.get(hash)
      req.onsuccess = () => {
        const rec = req.result
        if (!rec) { resolve(null); return }
        resolve(rec.blob as Blob)
      }
      req.onerror = () => reject(req.error)
    })
  } else {
    try {
      await ensureDirs()
      const { fs, path, Blob } = await serverModules()
      const base = getBaseDir()
      const file = path.join(base, 'images', hash)
      const buf = await fs.readFile(file)
      return new Blob([buf], { type: 'application/octet-stream' })
    } catch {
      return null
    }
  }
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


async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  const ab = await blob.arrayBuffer()
  const b64 = (typeof Buffer !== 'undefined') ? Buffer.from(ab).toString('base64') : ''
  if (!b64 && typeof btoa === 'function') {
    const bytes = new Uint8Array(ab)
    let binary = ''
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`
  }
  const mime = blob.type || 'application/octet-stream'
  return `data:${mime};base64,${b64}`
}

const imageHashToObjectUrl = new Map<string, string>()
const objectUrlToImageHash = new Map<string, string>()
const maxObjectUrlCache = 200

function rememberObjectUrl(hash: string, url: string) {
  if (!hash || !url) return
  if (imageHashToObjectUrl.has(hash)) imageHashToObjectUrl.delete(hash)
  imageHashToObjectUrl.set(hash, url)
  objectUrlToImageHash.set(url, hash)

  while (imageHashToObjectUrl.size > maxObjectUrlCache) {
    const first = imageHashToObjectUrl.entries().next().value as [string, string] | undefined
    if (!first) break
    const [oldHash, oldUrl] = first
    imageHashToObjectUrl.delete(oldHash)
    objectUrlToImageHash.delete(oldUrl)
    try { URL.revokeObjectURL(oldUrl) } catch (err) { void err }
  }
}

function getKnownImageHashFromObjectUrl(url: string): string | null {
  return objectUrlToImageHash.get(url) || null
}

function getObjectUrlForImageHash(hash: string, blob: Blob): string | null {
  if (!isBrowserEnv) return null
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null
  const cached = imageHashToObjectUrl.get(hash)
  if (cached) {
    rememberObjectUrl(hash, cached)
    return cached
  }
  const url = URL.createObjectURL(blob)
  rememberObjectUrl(hash, url)
  return url
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

async function slimBoardAsync(board: Board): Promise<Board> {
  const elements = board.elements.map(el => {
    return el
  })
  const resolved = await Promise.all(elements.map(slimElement))
  const slim: Board = {
    id: board.id,
    name: board.name,
    elements: resolved,
    history: [resolved],
    historyIndex: 0,
    panOffset: board.panOffset,
    zoom: board.zoom,
    canvasBackgroundColor: board.canvasBackgroundColor,
    updatedAt: board.updatedAt,
  }
  return slim
}

function slimBoardForLocalStorage(board: Board): Board {
  const elements = board.elements.map(el => ({ ...el }))
  return {
    id: board.id,
    name: board.name,
    elements,
    history: [elements],
    historyIndex: 0,
    panOffset: board.panOffset,
    zoom: board.zoom,
    canvasBackgroundColor: board.canvasBackgroundColor,
    updatedAt: board.updatedAt,
  }
}

function pickRecentBoards(payload: { boards: Board[]; activeBoardId: string }, max: number): { boards: Board[]; activeBoardId: string } {
  const indexed = payload.boards.map((b, idx) => ({ b, idx }))
  const sorted = indexed.sort((a, b) => {
    const ta = a.b.updatedAt ?? 0
    const tb = b.b.updatedAt ?? 0
    if (tb !== ta) return tb - ta
    return a.idx - b.idx
  })
  let selected = sorted.slice(0, max).map(x => x.b)

  const active = payload.boards.find(b => b.id === payload.activeBoardId)
  if (active && !selected.some(b => b.id === active.id)) {
    if (selected.length < max) selected = [...selected, active]
    else selected = [...selected.slice(0, Math.max(0, max - 1)), active]
  }

  const nextActiveId = selected.some(b => b.id === payload.activeBoardId) ? payload.activeBoardId : (selected[0]?.id || payload.activeBoardId)
  return { boards: selected, activeBoardId: nextActiveId }
}

const lastSessionLocalStorageKey = 'bananapod:lastSession'
let lastSessionSaveCount = 0

async function saveLastSessionToIndexedDB(payload: { boards: Board[]; activeBoardId: string }) {
  const picked = pickRecentBoards(payload, 5)
  const slimmed = await Promise.all(picked.boards.map(b => slimBoardAsync(b)))
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
    const slimmed = await Promise.all(picked.boards.map(b => slimBoardAsync(b)))
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
    const boards: Board[] = await Promise.all((raw.boards || []).map(async (b: Board) => {
      const inflatedEls = await Promise.all((b.elements || []).map(inflateElementToDataUrl))
      return { ...b, elements: inflatedEls, history: [inflatedEls], historyIndex: 0, updatedAt: b.updatedAt ?? raw.timestamp ?? Date.now() }
    }))
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
      const boards: Board[] = await Promise.all((raw.boards || []).map(async (b: Board) => {
        const inflatedEls = await Promise.all((b.elements || []).map(inflateElementToDataUrl))
        return { ...b, elements: inflatedEls, history: [inflatedEls], historyIndex: 0, updatedAt: b.updatedAt ?? raw.timestamp ?? Date.now() }
      }))
      const picked = pickRecentBoards({ boards, activeBoardId: raw.activeBoardId }, 5)
      return { boards: picked.boards, activeBoardId: picked.activeBoardId, timestamp: raw.timestamp }
    } catch {
      return null
    }
  }
}
