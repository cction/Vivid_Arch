const isBrowserEnv = typeof window !== 'undefined'

let stringifyWorkerUrl: string | null = null
let stringifyWorker: Worker | null = null
let stringifyReqId = 0
const stringifyPending = new Map<number, { resolve: (v: string) => void; reject: (e: unknown) => void; startedAt: number }>()

function canUseStringifyWorker(): boolean {
  return isBrowserEnv
    && typeof Worker !== 'undefined'
    && typeof Blob !== 'undefined'
    && typeof URL !== 'undefined'
    && typeof URL.createObjectURL === 'function'
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

export async function stringifyForStorage(data: unknown): Promise<{ json: string; ms: number; via: 'worker' | 'main' }> {
  const w = getStringifyWorker()
  if (!w) {
    const t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
    const json = JSON.stringify(data)
    const t1 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
    return { json, ms: Math.max(0, t1 - t0), via: 'main' }
  }

  const id = ++stringifyReqId
  const startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
  const p = new Promise<string>((resolve, reject) => {
    stringifyPending.set(id, { resolve, reject, startedAt })
  })
  w.postMessage({ id, data })
  const json = await p
  const endedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
  return { json, ms: Math.max(0, endedAt - startedAt), via: 'worker' }
}

