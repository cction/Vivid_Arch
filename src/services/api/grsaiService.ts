import { withRetry } from '@/utils/retry'

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
  const useDevProxy = IS_BROWSER && (isDev || PROXY_VIA_VITE)
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
  if (!resp.ok) { const text = await resp.text().catch(() => '') ; throw new Error(`grsai API Error: ${resp.status} ${resp.statusText} ${text}`) }
  return resp
}

const SUPPORTED_ASPECT_RATIOS = ['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'] as const
function isSupportedAspectRatioText(r: string | null | undefined): boolean {
  if (!r) return false
  const t = r.trim()
  return SUPPORTED_ASPECT_RATIOS.includes(t as (typeof SUPPORTED_ASPECT_RATIOS)[number])
}

type ImageItem = { url?: string; b64_json?: string }
async function parseImageJson(json: { data?: unknown; results?: ImageItem[]; [k: string]: unknown }, usedModel: string): Promise<{ newImageBase64: string | null; newImageMimeType: string | null; textResponse: string | null }> {
  let item: ImageItem | undefined
  if (json && Array.isArray((json as { data?: ImageItem[] }).data)) item = (json as { data?: ImageItem[] }).data![0]
  else if (json && Array.isArray(json.results)) item = json.results[0]
  else {
    const d = (json as { data?: { results?: ImageItem[] } }).data
    if (d && Array.isArray(d.results)) item = d.results[0]
  }
  if (item?.url) {
    try {
      const r = await fetch(String(item.url))
      const blob = await r.blob()
      const reader = new FileReader()
      return await new Promise((resolve) => {
        reader.onload = () => {
          let base64 = (reader.result as string).split(',')[1]
          base64 = normalizeBase64(base64)
          const mime = blob.type && blob.type.startsWith('image/') ? blob.type : detectMimeFromBase64(base64)
          resolve({ newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功生成图像` })
        }
        reader.readAsDataURL(blob)
      })
    } catch { void 0 }
  }
  if (item?.b64_json) {
    const base64 = normalizeBase64(stripBase64Header(String(item.b64_json)))
    const mime = detectMimeFromBase64(base64)
    return { newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功生成图像` }
  }
  return { newImageBase64: null, newImageMimeType: null, textResponse: '图像生成失败：未找到输出' }
}

async function pollDrawResult(id: string, responseFormat: 'url' | 'b64_json', usedModel: string): Promise<{ newImageBase64: string | null; newImageMimeType: string | null; textResponse: string | null }> {
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
    if (hasResults) return parseImageJson(json as { data?: { results?: ImageItem[] }; [k: string]: unknown }, usedModel)
    const status = json && json.data && json.data.status
    const errMsg = (json && (json.error || '')) || (json && json.data && (json.data.error || json.data.failure_reason || '')) || ''
    if (status === 'failed') return { newImageBase64: null, newImageMimeType: null, textResponse: `图像生成失败：${errMsg || '未知错误'}` }
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  throw new Error('获取结果超时')
}

export async function generateImageFromText(
  prompt: string,
  model?: 'nano-banana' | 'nano-banana-pro',
  opts?: { aspectRatio?: string; imageSize?: '1K' | '2K' | '4K'; responseFormat?: 'url' | 'b64_json' }
): Promise<{ newImageBase64: string | null; newImageMimeType: string | null; textResponse: string | null }>
{
  if (!isGrsaiEnabled()) {
    return { newImageBase64: null, newImageMimeType: null, textResponse: 'grsai API 未配置或未启用' }
  }
  try {
    const usedModel = model || 'nano-banana'
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
    const json = JSON.parse(text) as { results?: ImageItem[]; id?: string; task_id?: string; data?: { id?: string; results?: ImageItem[] } }
    {
      const r0 = await parseImageJson(json as { data?: ImageItem[]; results?: ImageItem[] }, usedModel)
      if (r0.newImageBase64) return r0
    }
    const id = String((json && (json.id || json.task_id)) || (json && json.data && json.data.id) || '')
    if (id) {
      return await pollDrawResult(id, 'url', usedModel)
    }
    return { newImageBase64: null, newImageMimeType: null, textResponse: '图像生成失败：未找到输出' }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { newImageBase64: null, newImageMimeType: null, textResponse: `图像生成失败: ${msg}` }
  }
}

type ImageInput = { href: string; mimeType: string }

export async function editImage(
  prompt: string,
  images: ImageInput[],
  opts?: { aspectRatio?: string; imageSize?: '1K' | '2K' | '4K'; responseFormat?: 'url' | 'b64_json'; model?: 'nano-banana' | 'nano-banana-pro' }
): Promise<{ newImageBase64: string | null; newImageMimeType: string | null; textResponse: string | null }>
{
  if (!isGrsaiEnabled()) {
    return { newImageBase64: null, newImageMimeType: null, textResponse: 'grsai API 未配置或未启用' }
  }
  try {
    const usedModel = opts?.model || 'nano-banana'
    const urls: string[] = []
    for (let i = 0; i < images.length; i++) {
      const raw = normalizeBase64(stripBase64Header(images[i].href))
      const mime = images[i].mimeType || 'image/png'
      const dataUrl = `data:${mime};base64,${raw}`
      urls.push(dataUrl)
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
    const json = JSON.parse(text) as { results?: ImageItem[]; id?: string; task_id?: string; data?: { id?: string; results?: ImageItem[] } }
    {
      const r0 = await parseImageJson(json as { data?: ImageItem[]; results?: ImageItem[] }, usedModel)
      if (r0.newImageBase64) return r0
    }
    const id = String((json && (json.id || json.task_id)) || (json && json.data && json.data.id) || '')
    if (id) {
      return await pollDrawResult(id, 'url', usedModel)
    }
    return { newImageBase64: null, newImageMimeType: null, textResponse: '图像编辑失败：未找到输出' }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { newImageBase64: null, newImageMimeType: null, textResponse: `图像编辑失败: ${msg}` }
  }
}

export const Grsai_API = { generateImageFromText, editImage, isEnabled: isGrsaiEnabled }
