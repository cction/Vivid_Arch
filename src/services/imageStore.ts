const isBrowserEnv = typeof window !== 'undefined'
const canUseIndexedDB = isBrowserEnv && typeof indexedDB !== 'undefined'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (!canUseIndexedDB) throw new Error('IndexedDB not available')
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('BananaPodDB', 4)
    req.onupgradeneeded = () => {
      const db = req.result
      if (db.objectStoreNames.contains('history')) db.deleteObjectStore('history')
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'hash' })
      if (!db.objectStoreNames.contains('lastSession')) db.createObjectStore('lastSession')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
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

export function getBaseDir() {
  const p = typeof process !== 'undefined' && process.env && process.env.BANANAPOD_DATA_DIR ? (process.env.BANANAPOD_DATA_DIR as string) : undefined
  return p || (typeof process !== 'undefined' && process.cwd ? process.cwd() + '/bananapod-data' : 'bananapod-data')
}

export async function ensureDirs() {
  const { fs, path } = await serverModules()
  const base = getBaseDir()
  await fs.mkdir(base, { recursive: true })
  await fs.mkdir(path.join(base, 'images'), { recursive: true })
}

export async function sha256Hex(ab: ArrayBuffer): Promise<string> {
  if (isBrowserEnv && typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const digest = await crypto.subtle.digest('SHA-256', ab)
    const bytes = new Uint8Array(digest)
    let hex = ''
    for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
    return hex
  }
  if (isBrowserEnv) {
    const bytes = new Uint8Array(ab)
    return `fnv1a64_${fnv1a64Hex(bytes)}`
  }
  const { cryptoNode } = await serverModules()
  const buf = Buffer.from(ab)
  return cryptoNode.createHash('sha256').update(buf).digest('hex')
}

export async function hrefToBlob(href: string, expectedMime?: string): Promise<Blob> {
  if (isBrowserEnv) {
    if (href.startsWith('data:')) {
      const comma = href.indexOf(',')
      const meta = href.substring(0, comma)
      const b64Raw = href.substring(comma + 1)
      const mimeMatch = /data:(.*?)(;base64)?$/i.exec(meta)
      const mime = mimeMatch && mimeMatch[1] ? mimeMatch[1] : expectedMime || 'application/octet-stream'
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
      const blob = new Blob([arr.buffer], { type: mime })
      return blob
    }
    const res = await fetch(href)
    const blob = await res.blob()
    if (expectedMime && blob.type && expectedMime !== blob.type) return new Blob([await blob.arrayBuffer()], { type: expectedMime })
    return blob
  }
  const { Blob: NodeBlob } = await serverModules()
  if (href.startsWith('data:')) {
    const comma = href.indexOf(',')
    const meta = href.substring(0, comma)
    const b64 = href.substring(comma + 1)
    const mimeMatch = /data:(.*?)(;base64)?$/i.exec(meta)
    const mime = mimeMatch && mimeMatch[1] ? mimeMatch[1] : expectedMime || 'application/octet-stream'
    const buf = Buffer.from(b64, 'base64')
    return new NodeBlob([buf], { type: mime })
  }
  const res = await fetch(href)
  const ab = await res.arrayBuffer()
  const mime = expectedMime || (res.headers.get('content-type') || 'application/octet-stream')
  return new NodeBlob([ab], { type: mime })
}

export async function putImageBlob(blob: Blob): Promise<string> {
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
  }
  await ensureDirs()
  const { fs, path } = await serverModules()
  const base = getBaseDir()
  const file = path.join(base, 'images', hash)
  await fs.writeFile(file, Buffer.from(ab))
  return hash
}

export async function getImageBlob(hash: string): Promise<Blob | null> {
  if (isBrowserEnv) {
    if (!canUseIndexedDB) return null
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readonly')
      const store = tx.objectStore('images')
      const req = store.get(hash)
      req.onsuccess = () => {
        const rec = req.result
        if (!rec) {
          resolve(null)
          return
        }
        resolve(rec.blob as Blob)
      }
      req.onerror = () => reject(req.error)
    })
  }
  try {
    await ensureDirs()
    const { fs, path, Blob: NodeBlob } = await serverModules()
    const base = getBaseDir()
    const file = path.join(base, 'images', hash)
    const buf = await fs.readFile(file)
    return new NodeBlob([buf], { type: 'application/octet-stream' })
  } catch {
    return null
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
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
    try {
      URL.revokeObjectURL(oldUrl)
    } catch (err) {
      void err
    }
  }
}

export function getKnownImageHashFromObjectUrl(url: string): string | null {
  return objectUrlToImageHash.get(url) || null
}

export function getObjectUrlForImageHash(hash: string, blob: Blob): string | null {
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
