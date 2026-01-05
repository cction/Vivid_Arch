const WHATAI_BASE_URL = process.env.WHATAI_BASE_URL || 'https://api.whatai.cc'
const GRSAI_BASE_URL = process.env.GRSAI_BASE_URL || 'https://grsai.dakka.com.cn'

function safeDecodeURIComponent(value) {
  try { return decodeURIComponent(value) } catch { return value }
}

function findNextNamedParamIndex(query, from) {
  for (let i = query.indexOf('&', from); i !== -1; i = query.indexOf('&', i + 1)) {
    const rest = query.slice(i + 1)
    const eq = rest.indexOf('=')
    if (eq <= 0) continue
    const name = rest.slice(0, eq)
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return i
  }
  return -1
}

function extractQueryValue(query, key, mode) {
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

function maskKey(key) {
  const s = String(key || '')
  if (!s) return ''
  if (s.length <= 12) return `${s.slice(0, 2)}...${s.slice(-2)}`
  return `${s.slice(0, 6)}...${s.slice(-4)}`
}

function parseInjectedKeysFromUrl(urlStr) {
  const u = new URL(urlStr)
  const protocolOk = u.protocol === 'http:' || u.protocol === 'https:'
  const pathOk = u.pathname === '/'
  const search = u.search || ''
  if (!protocolOk || !pathOk || !search.startsWith('?')) return null
  const query = search.slice(1)
  const hasKey1 = query.includes('key1=')
  const hasKey2 = query.includes('key2=')
  if (!hasKey1 && !hasKey2) return null
  const apiKey = hasKey1 ? safeDecodeURIComponent(extractQueryValue(query, 'key1', 'nextAmp')) : ''
  const grsaiApiKey = hasKey2 ? safeDecodeURIComponent(extractQueryValue(query, 'key2', 'nextAmp')) : ''
  if (!apiKey && !grsaiApiKey) return null
  return { apiKey, grsaiApiKey }
}

async function fetchTextWithDebug(url, init) {
  const r = await fetch(url, init)
  const ct = r.headers.get('content-type') || ''
  const text = await r.text().catch(() => '')
  return { ok: r.ok, status: r.status, statusText: r.statusText, contentType: ct, text }
}

async function validateWhataiKey(key) {
  const headers = new Headers({ Accept: 'application/json' })
  headers.set('Authorization', `Bearer ${key}`)
  return fetchTextWithDebug(`${WHATAI_BASE_URL}/v1/token/quota`, { method: 'GET', headers })
}

async function validateGrsaiKey(key) {
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' })
  headers.set('Authorization', `Bearer ${key}`)
  const body = JSON.stringify({ model: 'nano-banana-fast', prompt: 'ping', aspectRatio: '1:1', webHook: '-1' })
  return fetchTextWithDebug(`${GRSAI_BASE_URL}/v1/draw/nano-banana`, { method: 'POST', headers, body })
}

function parseArgs(argv) {
  const args = { url: '', dryRun: false }
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true
    else if (!args.url) args.url = a
  }
  if (!args.url) args.url = process.env.URL_KEYS_TEST_URL || ''
  return args
}

async function main() {
  const { url, dryRun } = parseArgs(process.argv)
  if (!url) {
    console.error('[verify-url-keys] missing url. usage:')
    console.error('  node scripts/verify-url-keys.mjs \"https://host/?key1=...&key2=...\"')
    console.error('  URL_KEYS_TEST_URL=... node scripts/verify-url-keys.mjs')
    process.exit(2)
  }

  console.log('[verify-url-keys] input', { url })
  let keys = null
  try { keys = parseInjectedKeysFromUrl(url) } catch (e) { keys = null; console.error('[verify-url-keys] parse failed', String(e && e.message || e)) }

  if (!keys) {
    console.log('[verify-url-keys] no injectable keys detected (requires http/https + pathname \"/\" + query contains key1/key2)')
    process.exit(1)
  }

  const k1 = keys.apiKey || ''
  const k2 = keys.grsaiApiKey || ''

  console.log('[verify-url-keys] parsed', {
    hasKey1: Boolean(k1),
    hasKey2: Boolean(k2),
    key1Length: k1.length,
    key2Length: k2.length,
    key1Masked: maskKey(k1),
    key2Masked: maskKey(k2),
    key2HasAmpTail: k2.includes('&'),
  })

  console.log('[verify-url-keys] will apply to localStorage', {
    WHATAI_API_KEY: Boolean(k1) ? `set(${k1.length})` : 'remove',
    GRSAI_API_KEY: Boolean(k2) ? `set(${k2.length})` : 'remove',
  })

  if (dryRun) {
    console.log('[verify-url-keys] dry-run enabled, skip network validation')
    process.exit(0)
  }

  let allOk = true

  if (k1) {
    const r1 = await validateWhataiKey(k1)
    const preview = r1.text.length > 240 ? `${r1.text.slice(0, 240)}...[truncated ${r1.text.length - 240} chars]` : r1.text
    console.log('[verify-url-keys] whatai quota', { ok: r1.ok, status: r1.status, contentType: r1.contentType, preview })
    if (!r1.ok) allOk = false
  } else {
    console.log('[verify-url-keys] whatai quota skipped (no key1)')
  }

  if (k2) {
    const r2 = await validateGrsaiKey(k2)
    const preview = r2.text.length > 240 ? `${r2.text.slice(0, 240)}...[truncated ${r2.text.length - 240} chars]` : r2.text
    console.log('[verify-url-keys] grsai draw', { ok: r2.ok, status: r2.status, contentType: r2.contentType, preview })
    if (!r2.ok) allOk = false
  } else {
    console.log('[verify-url-keys] grsai draw skipped (no key2)')
  }

  process.exit(allOk ? 0 : 1)
}

main().catch((e) => {
  console.error('[verify-url-keys] failed', String(e && e.message || e))
  process.exit(1)
})
