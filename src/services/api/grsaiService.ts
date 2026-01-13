import { withRetry } from '@/utils/retry'
import { preprocessUplinkImages } from '@/utils/uplinkPreprocess'
import { sanitizeErrorMessage } from '@/utils/sanitizeErrorMessage'

const GRSAI_BASE_URL = (() => {
  const raw = process.env.GRSAI_BASE_URL || 'https://grsai.dakka.com.cn'
  try {
    if (raw.startsWith('http')) {
      const u = new URL(raw)
      return `${u.protocol}//${u.host}`
    }
    return 'https://grsai.dakka.com.cn'
  } catch {
    return 'https://grsai.dakka.com.cn'
  }
})()
const GRSAI_API_KEY = process.env.GRSAI_API_KEY
const PROXY_VIA_VITE = (process.env.PROXY_VIA_VITE || 'true') === 'true'
const IS_BROWSER = typeof window !== 'undefined'

function normalizeBase64(b64: string): string {
  let s = b64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4
  if (pad === 2) s += '=='
  else if (pad === 3) s += '='
  else if (pad !== 0) { while (s.length % 4 !== 0) s += '=' }
  return s
}

function stripBase64Header(input: string): string {
  const idx = input.indexOf('base64,')
  if (idx >= 0) return input.substring(idx + 7)
  return input.replace(/^data:.*?;base64,?/i, '')
}

function detectMimeFromBase64(b64: string): string {
  try {
    const bin = atob(b64.slice(0, 64))
    if (bin.length >= 4) {
      const sig = [bin.charCodeAt(0), bin.charCodeAt(1), bin.charCodeAt(2), bin.charCodeAt(3)]
      if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47) return 'image/png'
      if (sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff) return 'image/jpeg'
      if (bin.startsWith('GIF8')) return 'image/gif'
      if (bin.startsWith('RIFF')) return 'image/webp'
    }
  } catch { void 0 }
  return 'image/png'
}

function parseDataUrl(input: string): { mime: string; base64: string } | null {
  if (!input.startsWith('data:')) return null
  const comma = input.indexOf(',')
  if (comma <= 0) return null
  const meta = input.slice(0, comma)
  const raw = input.slice(comma + 1)
  const metaMimeMatch = /data:(.*?)(;base64)?$/i.exec(meta)
  const mime = (metaMimeMatch && metaMimeMatch[1]) ? metaMimeMatch[1] : 'image/png'
  const base64 = normalizeBase64(stripBase64Header(raw))
  return { mime, base64 }
}

async function resolveToGrsaiUrl(href: string, mimeType?: string): Promise<{ url: string; kind: 'http' | 'data' | 'fetched' | 'unknown' }> {
  const s = String(href || '')
  if (/^https?:\/\//i.test(s)) {
    if (typeof fetch === 'function' && typeof FileReader !== 'undefined') {
      try {
        const r = await fetch(s)
        const blob = await r.blob()
        const reader = new FileReader()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(reader.error || new Error('FileReader failed'))
          reader.readAsDataURL(blob)
        })
        const outMime = (blob.type && blob.type.startsWith('image/')) ? blob.type : (mimeType || 'image/png')
        const outComma = dataUrl.indexOf(',')
        const outRaw = outComma >= 0 ? dataUrl.slice(outComma + 1) : dataUrl
        const outB64 = normalizeBase64(stripBase64Header(outRaw))
        return { url: `data:${outMime};base64,${outB64}`, kind: 'fetched' }
      } catch (err) {
        try { console.debug('[grsai] resolve http image failed', { href: s.slice(0, 120), err: err instanceof Error ? err.message : String(err) }) } catch { void 0 }
      }
    }
    return { url: s, kind: 'http' }
  }
  if (s.startsWith('data:')) {
    const comma = s.indexOf(',')
    if (comma > 0) {
      const meta = s.slice(0, comma)
      const raw = s.slice(comma + 1)
      const metaMimeMatch = /data:(.*?)(;base64)?$/i.exec(meta)
      const mime = (metaMimeMatch && metaMimeMatch[1]) ? metaMimeMatch[1] : (mimeType || 'image/png')
      const b64 = normalizeBase64(stripBase64Header(raw))
      return { url: `data:${mime};base64,${b64}`, kind: 'data' }
    }
    return { url: s, kind: 'data' }
  }
  if (typeof fetch === 'function' && typeof FileReader !== 'undefined') {
    try {
      const r = await fetch(s)
      const blob = await r.blob()
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(reader.error || new Error('FileReader failed'))
        reader.readAsDataURL(blob)
      })
      const outMime = (blob.type && blob.type.startsWith('image/')) ? blob.type : (mimeType || 'image/png')
      const outComma = dataUrl.indexOf(',')
      const outRaw = outComma >= 0 ? dataUrl.slice(outComma + 1) : dataUrl
      const outB64 = normalizeBase64(stripBase64Header(outRaw))
      return { url: `data:${outMime};base64,${outB64}`, kind: 'fetched' }
    } catch (err) {
      try { console.debug('[grsai] resolve input image failed', { href: s.slice(0, 80), err: err instanceof Error ? err.message : String(err) }) } catch { void 0 }
      return { url: s, kind: 'unknown' }
    }
  }
  return { url: s, kind: 'unknown' }
}

 


function isGrsaiEnabled(): boolean {
  try {
    const clientKey = IS_BROWSER ? (localStorage.getItem('GRSAI_API_KEY') || '') : ''
    return Boolean(clientKey || GRSAI_API_KEY || PROXY_VIA_VITE)
  } catch {
    return Boolean(GRSAI_API_KEY || PROXY_VIA_VITE)
  }
}

async function grsaiFetch(path: string, init: RequestInit): Promise<Response> {
  const isDev = typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { DEV?: boolean } })?.env?.DEV === true
  const useDevProxy = IS_BROWSER && isDev && PROXY_VIA_VITE
  const routePath = path.startsWith('/') ? path : `/${path}`
  const proxyUrl = `/proxy-grsai${routePath}`
  const directUrl = `${GRSAI_BASE_URL}${routePath}`
  const headers = new Headers(init.headers || {})
  const clientKey = IS_BROWSER ? localStorage.getItem('GRSAI_API_KEY') || '' : ''
  if (clientKey) headers.set('Authorization', `Bearer ${clientKey}`)
  else if (GRSAI_API_KEY && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${GRSAI_API_KEY}`)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', 'en;q=0.8,zh;q=0.7')
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const finalInit: RequestInit = { ...init, headers }
  let resp: Response | null = null
  let firstError: unknown = null
  const primaryUrl = useDevProxy ? proxyUrl : directUrl
  try {
    resp = await withRetry(() => fetch(primaryUrl, finalInit), { retries: 3, baseDelayMs: 800 })
    if (useDevProxy && (!resp.ok && resp.status === 404)) { firstError = new Error('proxy 404'); resp = null }
  } catch (err) { firstError = err; resp = null }
  if (!resp) {
    try { resp = await withRetry(() => fetch(directUrl, finalInit), { retries: 3, baseDelayMs: 800 }) }
    catch (err2) { const e = firstError || err2; throw e instanceof Error ? e : new Error(String(e)) }
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    const maxLen = 400
    const preview = text.length > maxLen ? `${text.substring(0, maxLen)}...[truncated ${text.length - maxLen} chars]` : text
    throw new Error(sanitizeErrorMessage(`grsai API Error: ${resp.status} ${resp.statusText} ${preview}`))
  }
  return resp
}

const SUPPORTED_ASPECT_RATIOS = ['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'] as const
function isSupportedAspectRatioText(r: string | null | undefined): boolean {
  if (!r) return false
  const t = r.trim()
  return SUPPORTED_ASPECT_RATIOS.includes(t as (typeof SUPPORTED_ASPECT_RATIOS)[number])
}

type ImageItem = { url?: string; b64_json?: string }

function extractErrorMessage(raw: { [k: string]: unknown }): string {
  const j = raw as unknown as { code?: number | string; msg?: string; error?: string; data?: { error?: string; failure_reason?: string; msg?: string } }
  if (j.error && typeof j.error === 'string' && j.error.trim()) return j.error.trim()
  if (j.msg && typeof j.msg === 'string' && j.msg.trim()) return j.msg.trim()
  if (j.data) {
    if (j.data.error && typeof j.data.error === 'string' && j.data.error.trim()) return j.data.error.trim()
    if (j.data.failure_reason && typeof j.data.failure_reason === 'string' && j.data.failure_reason.trim()) return j.data.failure_reason.trim()
    if (j.data.msg && typeof j.data.msg === 'string' && j.data.msg.trim()) return j.data.msg.trim()
  }
  return ''
}

export interface GrsaiResult {
  newImageBase64: string | null;
  newImageMimeType: string | null;
  textResponse: string | null;
  status?: 'succeeded' | 'failed' | 'timeout' | 'pending';
  taskId?: string;
  error?: string;
}

async function parseImageJson(json: { data?: unknown; results?: ImageItem[]; [k: string]: unknown }, usedModel: string, taskId?: string): Promise<GrsaiResult> {
  let item: ImageItem | undefined
  if (json && Array.isArray((json as { data?: ImageItem[] }).data)) item = (json as { data?: ImageItem[] }).data![0]
  else if (json && Array.isArray(json.results)) item = json.results[0]
  else {
    const d = (json as { data?: { results?: ImageItem[] } }).data
    if (d && Array.isArray(d.results)) item = d.results[0]
  }
  if (item?.b64_json) {
    const base64 = normalizeBase64(stripBase64Header(String(item.b64_json)))
    const mime = detectMimeFromBase64(base64)
    return { newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功生成图像`, status: 'succeeded', taskId }
  }
  if (item?.url) {
    let lastError: Error | null = null
    try {
      const r = await fetch(String(item.url))
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`)
      const blob = await r.blob()
      const reader = new FileReader()
      return await new Promise((resolve) => {
        reader.onload = () => {
          let base64 = (reader.result as string).split(',')[1]
          base64 = normalizeBase64(base64)
          const mime = blob.type && blob.type.startsWith('image/') ? blob.type : detectMimeFromBase64(base64)
          resolve({ newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功生成图像`, status: 'succeeded', taskId })
        }
        reader.readAsDataURL(blob)
      })
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
    if (lastError) {
      const msg = sanitizeErrorMessage(lastError.message)
      return { newImageBase64: null, newImageMimeType: null, textResponse: `图像生成失败：无法获取生成结果 (${msg})`, status: 'failed', taskId, error: msg }
    }
  }
  return { newImageBase64: null, newImageMimeType: null, textResponse: '图像生成失败：未找到输出', status: 'failed', taskId, error: '未找到输出' }
}

async function pollDrawResult(id: string, responseFormat: 'url' | 'b64_json', usedModel: string): Promise<GrsaiResult> {
  const lower = (usedModel || '').toLowerCase()
  const isPro = lower.includes('pro') || lower.endsWith('-2')
  const maxTries = isPro ? 60 : 25
  const delayMs = isPro ? 2000 : 1400
  for (let i = 0; i < maxTries; i++) {
    const resp = await grsaiFetch('/v1/draw/result', { method: 'POST', body: JSON.stringify({ id }) })
    const ct = resp.headers.get('content-type') || ''
    const text = await resp.text()
    if (!ct.includes('application/json')) throw new Error(`非 JSON 返回 (${ct}) ${text.slice(0,200)}`)
    const json = JSON.parse(text) as { code?: number; msg?: string; error?: string; data?: { results?: ImageItem[]; status?: string; progress?: number; error?: string; failure_reason?: string } }
    const hasResults = json && json.data && Array.isArray(json.data.results) && json.data.results.length > 0
    if (hasResults) return parseImageJson(json as { data?: { results?: ImageItem[] }; [k: string]: unknown }, usedModel, id)
    const status = json && json.data && json.data.status
    const errMsg = (json && (json.error || '')) || (json && json.data && (json.data.error || json.data.failure_reason || '')) || ''
    if (status === 'failed') return { newImageBase64: null, newImageMimeType: null, textResponse: `图像生成失败：${errMsg || '未知错误'}`, status: 'failed', taskId: id, error: errMsg || '未知错误' }
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return { newImageBase64: null, newImageMimeType: null, textResponse: '图像生成失败：获取结果超时', status: 'timeout', taskId: id, error: '获取结果超时' }
}

export async function getDrawResultOnce(taskId: string): Promise<GrsaiResult> {
  try {
    const resp = await grsaiFetch('/v1/draw/result', { method: 'POST', body: JSON.stringify({ id: taskId }) })
    const ct = resp.headers.get('content-type') || ''
    const text = await resp.text()
    if (!ct.includes('application/json')) return { newImageBase64: null, newImageMimeType: null, textResponse: `非 JSON 返回 (${ct})`, status: 'failed', taskId, error: `非 JSON 返回 (${ct})` }
    const json = JSON.parse(text) as { code?: number; msg?: string; error?: string; data?: { results?: ImageItem[]; status?: string; progress?: number; error?: string; failure_reason?: string } }
    const hasResults = json && json.data && Array.isArray(json.data.results) && json.data.results.length > 0
    if (hasResults) return parseImageJson(json as { data?: { results?: ImageItem[] }; [k: string]: unknown }, 'unknown', taskId)
    
    const status = json && json.data && json.data.status
    const errMsg = (json && (json.error || '')) || (json && json.data && (json.data.error || json.data.failure_reason || '')) || ''
    
    if (status === 'failed') {
      const safe = sanitizeErrorMessage(errMsg || '未知错误')
      return { newImageBase64: null, newImageMimeType: null, textResponse: `图像生成失败：${safe}`, status: 'failed', taskId, error: safe }
    }
    // pending or processing
    return { newImageBase64: null, newImageMimeType: null, textResponse: '仍在生成中', status: 'pending', taskId }
  } catch (err) {
    const msg = sanitizeErrorMessage(err)
    return { newImageBase64: null, newImageMimeType: null, textResponse: `查询失败: ${msg}`, status: 'failed', taskId, error: msg }
  }
}

export async function generateImageFromText(
  prompt: string,
  model?: 'nano-banana' | 'nano-banana-fast' | 'nano-banana-pro' | 'nano-banana-pro-cl',
  opts?: { aspectRatio?: string; imageSize?: '1K' | '2K' | '4K'; responseFormat?: 'url' | 'b64_json' }
): Promise<GrsaiResult>
{
  if (!isGrsaiEnabled()) {
    return { newImageBase64: null, newImageMimeType: null, textResponse: 'grsai API 未配置或未启用', status: 'failed', error: 'API not enabled' }
  }
  try {
    const usedModel = model || 'nano-banana-fast'
    const body = {
      model: usedModel,
      prompt,
      aspectRatio: (opts?.aspectRatio && isSupportedAspectRatioText(opts.aspectRatio)) ? opts.aspectRatio.trim() : 'auto',
      imageSize: opts?.imageSize,
      webHook: '-1'
    } as Record<string, unknown>
    const resp = await grsaiFetch('/v1/draw/nano-banana', { method: 'POST', body: JSON.stringify(body) })
    const ct = resp.headers.get('content-type') || ''
    const text = await resp.text()
    if (!ct.includes('application/json')) throw new Error(`非 JSON 返回 (${ct}) ${text.slice(0,200)}`)
    const json = JSON.parse(text) as { code?: number | string; msg?: string; error?: string; results?: ImageItem[]; id?: string; task_id?: string; data?: { id?: string; results?: ImageItem[]; error?: string; failure_reason?: string; msg?: string } }
    {
      const r0 = await parseImageJson(json as { data?: ImageItem[]; results?: ImageItem[] }, usedModel)
      if (r0.newImageBase64) return r0
    }
    const errText = extractErrorMessage(json)
    const id = String((json && (json.id || json.task_id)) || (json && json.data && json.data.id) || '')
    if (id) {
      return await pollDrawResult(id, 'url', usedModel)
    }
    if (errText) {
      const safe = sanitizeErrorMessage(errText)
      return { newImageBase64: null, newImageMimeType: null, textResponse: `图像生成失败：${safe}`, status: 'failed', error: safe }
    }
    try {
      const preview = text.length > 240 ? `${text.slice(0, 240)}...[truncated ${text.length - 240} chars]` : text
      console.debug('[grsai generateImageFromText] no results and no id', { usedModel, preview })
    } catch { void 0 }
    return { newImageBase64: null, newImageMimeType: null, textResponse: '图像生成失败：未找到输出', status: 'failed', error: '未找到输出' }
  } catch (error) {
    const msg = sanitizeErrorMessage(error)
    return { newImageBase64: null, newImageMimeType: null, textResponse: `图像生成失败: ${msg}`, status: 'failed', error: msg }
  }
}

type ImageInput = { href: string; mimeType: string }

export async function editImage(
  prompt: string,
  images: ImageInput[],
  opts?: { aspectRatio?: string; imageSize?: '1K' | '2K' | '4K'; responseFormat?: 'url' | 'b64_json'; model?: 'nano-banana' | 'nano-banana-fast' | 'nano-banana-pro' | 'nano-banana-pro-cl' }
): Promise<GrsaiResult>
{
  if (!isGrsaiEnabled()) {
    return { newImageBase64: null, newImageMimeType: null, textResponse: 'grsai API 未配置或未启用', status: 'failed', error: 'API not enabled' }
  }
  try {
    const usedModel = opts?.model || 'nano-banana-fast'
    const urls: string[] = []
    const uplinkInputs: Array<{ href: string; mimeType?: string }> = []
    const uplinkIndexMap: number[] = []
    for (let i = 0; i < images.length; i++) {
      const inHref = images[i].href
      const inMime = images[i].mimeType || 'image/png'
      const resolved = await resolveToGrsaiUrl(inHref, inMime)
      const parsed = parseDataUrl(resolved.url)
      if (parsed) {
        uplinkInputs.push({ href: parsed.base64, mimeType: parsed.mime })
        uplinkIndexMap.push(urls.length)
        urls.push('')
      } else {
        urls.push(resolved.url)
      }
      try {
        const preview = resolved.url.startsWith('data:') ? resolved.url.slice(0, 64) + '...' : resolved.url.slice(0, 120)
        console.debug('[grsai editImage] input url', { idx: i, kind: resolved.kind, preview })
      } catch { void 0 }
    }
    if (uplinkInputs.length > 0) {
      const uplink = await preprocessUplinkImages(uplinkInputs, { maxLongEdge: 2048, debugLabel: 'grsai/editImage' })
      for (let i = 0; i < uplink.images.length; i++) {
        const out = uplink.images[i]
        const at = uplinkIndexMap[i]
        urls[at] = `data:${out.mimeType};base64,${out.base64}`
      }
    }
    const body = {
      model: usedModel,
      prompt,
      aspectRatio: (opts?.aspectRatio && isSupportedAspectRatioText(opts.aspectRatio)) ? opts.aspectRatio.trim() : 'auto',
      imageSize: opts?.imageSize,
      urls,
      webHook: '-1'
    } as Record<string, unknown>
    const resp = await grsaiFetch('/v1/draw/nano-banana', { method: 'POST', body: JSON.stringify(body) })
    const ct = resp.headers.get('content-type') || ''
    const text = await resp.text()
    if (!ct.includes('application/json')) throw new Error(`非 JSON 返回 (${ct}) ${text.slice(0,200)}`)
    const json = JSON.parse(text) as { code?: number | string; msg?: string; error?: string; results?: ImageItem[]; id?: string; task_id?: string; data?: { id?: string; results?: ImageItem[]; error?: string; failure_reason?: string; msg?: string } }
    {
      const r0 = await parseImageJson(json as { data?: ImageItem[]; results?: ImageItem[] }, usedModel)
      if (r0.newImageBase64) return r0
    }
    const errText = extractErrorMessage(json)
    const id = String((json && (json.id || json.task_id)) || (json && json.data && json.data.id) || '')
    if (id) {
      return await pollDrawResult(id, 'url', usedModel)
    }
    if (errText) {
      const safe = sanitizeErrorMessage(errText)
      return { newImageBase64: null, newImageMimeType: null, textResponse: `图像编辑失败：${safe}`, status: 'failed', error: safe }
    }
    try {
      const preview = text.length > 240 ? `${text.slice(0, 240)}...[truncated ${text.length - 240} chars]` : text
      console.debug('[grsai editImage] no results and no id', { usedModel, preview })
    } catch { void 0 }
    return { newImageBase64: null, newImageMimeType: null, textResponse: '图像编辑失败：未找到输出', status: 'failed', error: '未找到输出' }
  } catch (error) {
    const msg = sanitizeErrorMessage(error)
    return { newImageBase64: null, newImageMimeType: null, textResponse: `图像编辑失败: ${msg}`, status: 'failed', error: msg }
  }
}

export const Grsai_API = { generateImageFromText, editImage, isEnabled: isGrsaiEnabled }
