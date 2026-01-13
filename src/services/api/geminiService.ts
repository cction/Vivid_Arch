import { withRetry } from "@/utils/retry";
import { preprocessUplinkImages } from "@/utils/uplinkPreprocess";
import { sanitizeErrorMessage } from "@/utils/sanitizeErrorMessage";

const WHATAI_BASE_URL = process.env.WHATAI_BASE_URL || 'https://api.whatai.cc';
const WHATAI_API_KEY = process.env.WHATAI_API_KEY;
const WHATAI_TEXT_MODEL = process.env.WHATAI_TEXT_MODEL || 'gemini-2.0-flash-exp';
function getWhataiImageModel(): string {
  try {
    const v = typeof window !== 'undefined' ? (localStorage.getItem('WHATAI_IMAGE_MODEL') || undefined) : undefined;
    return v || (process.env.WHATAI_IMAGE_MODEL as string) || 'nano-banana';
  } catch {
    return (process.env.WHATAI_IMAGE_MODEL as string) || 'nano-banana';
  }
}
const WHATAI_VIDEO_MODEL = process.env.WHATAI_VIDEO_MODEL || 'vidu-1';
const PROXY_VIA_VITE = (process.env.PROXY_VIA_VITE || 'true') === 'true';
const WHATAI_STRICT_SIZE = (process.env.WHATAI_STRICT_SIZE || 'false') === 'true';

  const IS_BROWSER = typeof window !== 'undefined';
function normalizeBase64(b64: string): string {
  let s = b64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  else if (pad !== 0) {
    while (s.length % 4 !== 0) s += '=';
  }
  return s;
}
function stripBase64Header(input: string): string {
  const idx = input.indexOf('base64,');
  if (idx >= 0) return input.substring(idx + 7);
  return input.replace(/^data:.*?;base64,?/i, '');
}
function detectMimeFromBase64(b64: string): string {
  try {
    const bin = atob(b64.slice(0, 64));
    if (bin.length >= 4) {
      const sig = [bin.charCodeAt(0), bin.charCodeAt(1), bin.charCodeAt(2), bin.charCodeAt(3)];
      if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47) return 'image/png';
      if (sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff) return 'image/jpeg';
      if (bin.startsWith('GIF8')) return 'image/gif';
      if (bin.startsWith('RIFF')) return 'image/webp';
    }
  } catch { void 0; }
  return 'image/png';
}

function extractDataUrlFromText(input: string): { base64: string; mime: string } | null {
  const m = input.match(/data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=_-]+)/);
  if (!m) return null;
  const mime = m[1];
  const raw = m[2];
  const b64 = normalizeBase64(raw);
  const outMime = mime.startsWith('image/') ? mime : detectMimeFromBase64(b64);
  return { base64: b64, mime: outMime };
}

function extractFirstHttpUrl(input: string): string | null {
  const s = String(input);
  const m1 = s.match(/!\[[^\]]*\]\((https?:[^)\s]+)\)/i);
  if (m1 && m1[1]) return m1[1];
  const m2 = s.match(/!\{image\}\((https?:[^)\s]+)\)/i);
  if (m2 && m2[1]) return m2[1];
  const m3 = s.match(/(https?:\/\/[^\s)"'<>]+)/i);
  if (m3 && m3[1]) return m3[1];
  return null;
}

async function tryLoadImageBase64(url: string): Promise<{ base64: string; mime: string } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image load failed'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = normalizeBase64(dataUrl.split(',')[1] || '');
    return { base64, mime: 'image/png' };
  } catch {
    return null;
  }
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function readUInt16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}
function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function getImageSizeFromBytes(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 10) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    const width = readUInt32BE(bytes, 16);
    const height = readUInt32BE(bytes, 20);
    if (width && height) return { width, height };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      const length = readUInt16BE(bytes, i + 2);
      const isSOF = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
      if (isSOF) {
        const height = readUInt16BE(bytes, i + 5);
        const width = readUInt16BE(bytes, i + 7);
        if (width && height) return { width, height };
        break;
      }
      if (length < 2) break;
      i += 2 + length;
    }
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    if (width && height) return { width, height };
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const id0 = bytes[pos], id1 = bytes[pos + 1], id2 = bytes[pos + 2], id3 = bytes[pos + 3];
      const chunkSize = readUInt32BE(bytes, pos + 4);
      if (id0 === 0x56 && id1 === 0x50 && id2 === 0x38 && id3 === 0x58) {
        const w = (bytes[pos + 8 + 4] | (bytes[pos + 8 + 5] << 8) | (bytes[pos + 8 + 6] << 16)) + 1;
        const h = (bytes[pos + 8 + 7] | (bytes[pos + 8 + 8] << 8) | (bytes[pos + 8 + 9] << 16)) + 1;
        if (w && h) return { width: w >>> 0, height: h >>> 0 };
      }
      pos += 8 + chunkSize + (chunkSize % 2);
    }
  }
  return null;
}

async function getImageSize(base64: string, mimeType?: string): Promise<{ width: number; height: number } | null> {
  const s = await getBase64ImageSize(base64, mimeType);
  if (s) return s;
  const b64 = normalizeBase64(stripBase64Header(base64));
  const bytes = decodeBase64ToBytes(b64);
  return getImageSizeFromBytes(bytes);
}

function isWhataiEnabled(): boolean {
  try {
    const clientKey = IS_BROWSER ? (localStorage.getItem('WHATAI_API_KEY') || '') : '';
    return Boolean(clientKey || WHATAI_API_KEY || PROXY_VIA_VITE);
  } catch {
    return Boolean(WHATAI_API_KEY || PROXY_VIA_VITE);
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const meta = parts[0];
  const base64 = normalizeBase64(parts[1] ?? parts[0]);
  const mimeMatch = /data:(.*?);base64/.exec(meta);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

async function computeAspectRatioFromBase64(base64: string, mimeType?: string): Promise<string | null> {
  if (!IS_BROWSER) return null;
  try {
    const rawInAr = stripBase64Header(base64);
    const normInAr = normalizeBase64(rawInAr);
    const detectedAr = detectMimeFromBase64(normInAr);
    const useMimeAr = (mimeType && mimeType.startsWith('image/')) ? mimeType : detectedAr;
    const url = `data:${useMimeAr};base64,${normInAr}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load base64 image for aspect ratio'));
      img.src = url;
    });
    let w = loaded.naturalWidth || loaded.width;
    let h = loaded.naturalHeight || loaded.height;
    if (!w || !h) return null;
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const g = gcd(w, h);
    const ar = `${Math.round(w / g)}:${Math.round(h / g)}`;
    return ar;
  } catch (err) {
    console.warn('计算图片长宽比失败，回退默认:', err);
    return null;
  }
}

async function getBase64ImageSize(base64: string, mimeType?: string): Promise<{ width: number; height: number } | null> {
  if (!IS_BROWSER) return null;
  const raw = stripBase64Header(base64);
  const b64 = normalizeBase64(raw);
  const detected = detectMimeFromBase64(b64);
  const useMime = (mimeType && mimeType.startsWith('image/')) ? mimeType : detected;
  const dataUrl = `data:${useMime};base64,${b64}`;
  const tryLoad = async (src: string): Promise<HTMLImageElement> => {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load base64 image for size'));
      img.src = src;
    });
  };
  try {
    const loaded = await tryLoad(dataUrl);
    const w = loaded.naturalWidth || loaded.width;
    const h = loaded.naturalHeight || loaded.height;
    if (!w || !h) return null;
    return { width: w, height: h };
  } catch {
    return null;
  }
}

  async function scaleBase64ByFactor(base64: string, mimeType: string | undefined, factor: number): Promise<{ base64: string; width: number; height: number } | null> {
  if (factor === 1) {
    const size = await getImageSize(base64, mimeType);
    if (!size) return { base64, width: 0, height: 0 };
    return { base64, width: size.width, height: size.height };
  }
  const size = await getImageSize(base64, mimeType);
  if (!size) return null;
  const targetW = Math.max(1, Math.floor(size.width * factor));
  const targetH = Math.max(1, Math.floor(size.height * factor));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const url = `data:${mimeType || 'image/png'};base64,${base64}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to load image during scale'));
    i.src = url;
  });
  ctx.drawImage(img, 0, 0, targetW, targetH);
  const out = canvas.toDataURL(mimeType || 'image/png').split(',')[1] || base64;
  return { base64: out, width: targetW, height: targetH };
}


async function whataiFetch(path: string, init: RequestInit): Promise<Response> {
  let proxyOverride = ''
  try { proxyOverride = IS_BROWSER ? (localStorage.getItem('PROXY_VIA_VITE') || '') : '' } catch { proxyOverride = '' }
  const useDevProxy = IS_BROWSER && PROXY_VIA_VITE && proxyOverride !== 'off';
  const proxyUrl = `/proxy-whatai${path}`;
  const directUrl = `${WHATAI_BASE_URL}${path}`;
  const headers = new Headers(init.headers || {});
  const clientKey = IS_BROWSER ? localStorage.getItem('WHATAI_API_KEY') || '' : '';
  if (clientKey) headers.set('Authorization', `Bearer ${clientKey}`);
  else if (!useDevProxy && WHATAI_API_KEY) headers.set('Authorization', `Bearer ${WHATAI_API_KEY}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const finalInit: RequestInit = { ...init, headers };
  let resp: Response | null = null;
  let firstError: unknown = null;
  const primaryUrl = useDevProxy ? proxyUrl : directUrl;
  try {
    resp = await withRetry(() => fetch(primaryUrl, finalInit), { retries: 3, baseDelayMs: 800 });
    if (useDevProxy && (!resp.ok && resp.status === 404)) {
      resp = null;
      throw new Error('proxy 404');
    }
  } catch (err) {
    firstError = err;
  }
  if (!resp) {
    try {
      resp = await withRetry(() => fetch(directUrl, finalInit), { retries: 3, baseDelayMs: 800 });
    } catch (err2) {
      const e = firstError || err2;
      throw e instanceof Error ? e : new Error(String(e));
    }
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const maxLen = 400;
    const preview = text.length > maxLen ? `${text.substring(0, maxLen)}...[truncated ${text.length - maxLen} chars]` : text;
    throw new Error(sanitizeErrorMessage(`whatai API Error: ${resp.status} ${resp.statusText} ${preview}`));
  }
  return resp;
}

async function whataiChatCompletions(body: unknown): Promise<ChatCompletionResponse> {
  const resp = await whataiFetch('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  
  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await resp.text();
    throw new Error(sanitizeErrorMessage(`whatai returned non-JSON (${contentType}): ${text.substring(0, 200)}`));
  }
  
  return await resp.json();
}


type ImageInput = {
  href: string;
  mimeType: string;
};

type ChatContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
interface ChatMessage {
  content: string | Array<{ type?: string; image_url?: { url?: string }; inlineData?: { data?: string }; b64_json?: string }>;
}
interface ChatCompletionResponse {
  choices?: Array<{ message?: ChatMessage }>;
}
type VideoGenBody = {
  model: string;
  prompt: string;
  aspect_ratio: '16:9' | '9:16';
  duration: number;
  image?: string;
};

function isNanoBananaModel(m: string): boolean {
  const x = (m || '').toLowerCase();
  return x === 'nano-banana' || x === 'nano-banana-2';
}

interface ImageGenResponseItem { b64_json?: string; url?: string }
interface ImageGenResponse { data?: ImageGenResponseItem[] }

const SUPPORTED_ASPECT_RATIOS = ['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'] as const;
function isSupportedAspectRatioText(r: string | null | undefined): boolean {
  if (!r) return false;
  const t = r.trim();
  return SUPPORTED_ASPECT_RATIOS.includes(t as (typeof SUPPORTED_ASPECT_RATIOS)[number]);
}
function nearestSupportedAspectRatioBySize(w?: number | null, h?: number | null): string | null {
  if (!w || !h || w <= 0 || h <= 0) return null;
  const target = w / h;
  let best: string | null = null;
  let diffBest = Number.POSITIVE_INFINITY;
  for (const cand of SUPPORTED_ASPECT_RATIOS) {
    const [a, b] = cand.split(':').map((x) => Number(x));
    if (!a || !b) continue;
    const val = a / b;
    const d = Math.abs(val - target);
    if (d < diffBest) { diffBest = d; best = cand; }
  }
  return best;
}

export async function generateImageFromText(prompt: string, model?: string, opts?: { aspectRatio?: string; imageSize?: '1K' | '2K' | '4K' }): Promise<{ 
  newImageBase64: string | null; 
  newImageMimeType: string | null; 
  textResponse: string | null; 
}> {
  if (!isWhataiEnabled()) {
    return {
      newImageBase64: null,
      newImageMimeType: null,
      textResponse: "whatai API 未配置或未启用"
    };
  }

  try {
    const usedModel = model || getWhataiImageModel();
    if (isNanoBananaModel(usedModel)) {
      const ar = (opts?.aspectRatio && isSupportedAspectRatioText(opts.aspectRatio)) ? opts.aspectRatio.trim() : '3:4';
      const lowerModel = (usedModel || '').toLowerCase().trim();
      const rawWantSize = opts?.imageSize || '1K';
      const wantSize = lowerModel === 'nano-banana-2' ? rawWantSize : undefined;
      const ignoredSize = lowerModel !== 'nano-banana-2' && rawWantSize !== '1K';
      const responseFormat: 'url' | 'b64_json' = wantSize && wantSize !== '1K' ? 'b64_json' : 'url';
      const body = {
        model: usedModel,
        prompt,
        aspect_ratio: ar,
        response_format: responseFormat,
        image_size: wantSize,
      } as Record<string, unknown>;
      try { console.debug('[generateImage] images/generations', { model: usedModel, aspectRatio: ar, imageSize: wantSize || 'n/a', responseFormat, ignoredSize }); } catch { void 0; }
      const resp = await whataiFetch('/v1/images/generations', { method: 'POST', body: JSON.stringify(body) });
      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const tx = await resp.text();
        throw new Error(`images/generations 返回非 JSON (${ct}): ${tx.substring(0, 200)}`);
      }
      const json: ImageGenResponse = await resp.json();
      const item = json?.data && json.data[0];
      if (item?.url) {
        const r = await fetch(String(item.url));
        const ct2 = r.headers.get('content-type') || '';
        if (!ct2.startsWith('image/')) {
          return { newImageBase64: null, newImageMimeType: null, textResponse: `图像获取失败：非图像内容(${ct2 || 'unknown'})` };
        }
        const blob = await r.blob();
        const reader = new FileReader();
        return await new Promise((resolve) => {
          reader.onload = () => {
            let base64 = (reader.result as string).split(',')[1];
            base64 = normalizeBase64(base64);
            const mime = (blob.type && blob.type.startsWith('image/')) ? blob.type : detectMimeFromBase64(base64);
            void getImageSize(base64, mime).then((size) => {
              try { if (size) console.debug('[generateImage] size', { model: usedModel, requested: wantSize || 'n/a', width: size.width, height: size.height }); } catch { void 0; }
            }).catch(() => void 0);
            resolve({ newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功生成图像` });
          };
          reader.readAsDataURL(blob);
        });
      }
      if (item?.b64_json) {
        const base64 = normalizeBase64(stripBase64Header(String(item.b64_json)));
        const mime = detectMimeFromBase64(base64);
        void getImageSize(base64, mime).then((size) => {
          try { if (size) console.debug('[generateImage] size', { model: usedModel, requested: wantSize || 'n/a', width: size.width, height: size.height }); } catch { void 0; }
        }).catch(() => void 0);
        return { newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功生成图像` };
      }
      return { newImageBase64: null, newImageMimeType: null, textResponse: '图像生成失败：未找到输出' };
    }
    return { newImageBase64: null, newImageMimeType: null, textResponse: `当前模型不支持该生图协议: ${usedModel}` };
  } catch (error) {
    console.error('whatai 图像生成失败:', error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error)));
    const safe = sanitizeErrorMessage(error);
    return {
      newImageBase64: null,
      newImageMimeType: null,
      textResponse: `图像生成失败: ${safe}`
    };
  }
}

export async function editImage(
  prompt: string,
  images: ImageInput[],
  opts?: { aspectRatio?: string; imageSize?: '1K' | '2K' | '4K'; strictSize?: boolean; mask?: ImageInput; model?: string }
): Promise<{ newImageBase64: string | null; newImageMimeType: string | null; textResponse: string | null }> {
  if (!isWhataiEnabled()) {
    return {
      newImageBase64: null,
      newImageMimeType: null,
      textResponse: "whatai API 未配置或未启用"
    };
  }

  try {
    const usedModel = opts?.model || getWhataiImageModel();
    let desiredAspectRatio = (opts?.aspectRatio && isSupportedAspectRatioText(opts.aspectRatio)) ? opts.aspectRatio.trim() : undefined;
    const strictSize = Boolean(opts?.strictSize ?? WHATAI_STRICT_SIZE);

    if (isNanoBananaModel(usedModel)) {
      const uplinkImages: Array<{ href: string; mimeType?: string }> = [];
      for (const img of images) {
        const rawB64 = normalizeBase64(stripBase64Header(img.href));
        const mime = (img.mimeType && img.mimeType.startsWith('image/')) ? img.mimeType : detectMimeFromBase64(rawB64);
        const ratioText = desiredAspectRatio || await computeAspectRatioFromBase64(rawB64, mime) || '3:4';
        uplinkImages.push({ href: rawB64, mimeType: mime });
        desiredAspectRatio = ratioText;
      }
      const uplink = await preprocessUplinkImages(uplinkImages, {
        maxLongEdge: 1536,
        mask: opts?.mask ? { href: opts.mask.href, mimeType: opts.mask.mimeType } : undefined,
        debugLabel: 'whatai/editImage'
      });
      const body = new FormData();
      body.append('model', usedModel);
      body.append('prompt', prompt);
      if (desiredAspectRatio) body.append('aspect_ratio', desiredAspectRatio);
      if ((usedModel || '').toLowerCase().trim() === 'nano-banana-2' && opts?.imageSize) body.append('image_size', opts.imageSize);
      try { console.debug('[editImage] request form data', { desiredAspectRatio, imagesCount: uplink.images.length }); } catch { void 0; }
      for (let i = 0; i < uplink.images.length; i++) {
        const img = uplink.images[i];
        const mime = img?.mimeType || 'image/png';
        const dataUrl = `data:${mime};base64,${img.base64}`;
        const blob = dataUrlToBlob(dataUrl);
        body.append('image', blob, `image${i}.${mime.split('/')[1] || 'png'}`);
      }
      if (uplink.mask) {
        const maskMime = uplink.mask.mimeType || 'image/png';
        const maskDataUrl = `data:${maskMime};base64,${uplink.mask.base64}`;
        const maskBlob = dataUrlToBlob(maskDataUrl);
        body.append('mask', maskBlob, `mask.${maskMime.split('/')[1] || 'png'}`);
      }
      const resp = await whataiFetch('/v1/images/edits', { method: 'POST', body: body });
      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const tx = await resp.text();
        throw new Error(`images/edits 返回非 JSON (${ct}): ${tx.substring(0, 200)}`);
      }
      const json: ImageGenResponse = await resp.json();
      const item = json?.data && json.data[0];
      if (item?.url) {
        const r = await fetch(String(item.url));
        const ct2 = r.headers.get('content-type') || '';
        if (!ct2.startsWith('image/')) {
          return { newImageBase64: null, newImageMimeType: null, textResponse: `图像编辑失败：非图像内容(${ct2 || 'unknown'})` };
        }
        const blob = await r.blob();
        const reader = new FileReader();
        return await new Promise((resolve) => {
          reader.onload = async () => {
            let base64 = (reader.result as string).split(',')[1];
            base64 = normalizeBase64(base64);
            const mime = (blob.type && blob.type.startsWith('image/')) ? blob.type : detectMimeFromBase64(base64);
            let targetW: number | null = null;
            let targetH: number | null = null;
            if (desiredAspectRatio) {
              const parts = desiredAspectRatio.split(':');
              if (parts.length === 2) {
                const a = Number(parts[0]);
                const b = Number(parts[1]);
                if (a && b) {
                  const size = await getImageSize(base64, mime);
                  if (size) {
                    const nearest = nearestSupportedAspectRatioBySize(size.width, size.height);
                    if (nearest) {
                      const ps = nearest.split(':');
                      const arW = Number(ps[0]);
                      const arH = Number(ps[1]);
                      if (arW && arH) {
                        targetW = Math.max(1, Math.round(size.width));
                        targetH = Math.max(1, Math.round(targetW / (arW / arH)));
                        const scale = Math.min(targetW / size.width, targetH / size.height);
                        if (scale !== 1) {
                          const scaled = await scaleBase64ByFactor(base64, mime, scale);
                          if (scaled) {
                            base64 = scaled.base64;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            resolve({ newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` });
          };
          reader.readAsDataURL(blob);
        });
      }
      if (item?.b64_json) {
        const base64 = normalizeBase64(stripBase64Header(String(item.b64_json)));
        const mime = detectMimeFromBase64(base64);
        return { newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` };
      }
      return { newImageBase64: null, newImageMimeType: null, textResponse: '图像编辑失败：未找到输出' };
    }
    const content: ChatContentPart[] = [];
    const outputInstr = '只输出一行 data:image/png;base64,<...> 不要输出其它文字';
    const textPayload = opts?.aspectRatio ? `${prompt}\n[aspect_ratio:${opts.aspectRatio}]\n${outputInstr}` : `${prompt}\n${outputInstr}`;
    content.push({ type: "text", text: textPayload });
    const uplink = await preprocessUplinkImages(
      images.map((img) => {
        const raw = normalizeBase64(stripBase64Header(img.href));
        const mime = (img.mimeType && img.mimeType.startsWith('image/')) ? img.mimeType : detectMimeFromBase64(raw);
        return { href: raw, mimeType: mime };
      }),
      { maxLongEdge: 2048, debugLabel: 'whatai/chatCompletions' }
    );
    for (const img of uplink.images) {
      const mime = img.mimeType || 'image/png';
      const url = `data:${mime};base64,${img.base64}`;
      content.push({ type: 'image_url', image_url: { url } });
    }
    const chat = await whataiChatCompletions({ model: usedModel, messages: [{ role: "user", content }], max_tokens: 1000 });
    const msg = chat && chat.choices && chat.choices[0] && chat.choices[0].message;
    if (msg) {
      const mc = msg.content;
      if (typeof mc === 'string') {
        const s = mc as string;
        const ex = extractDataUrlFromText(s);
        if (ex) {
          let b64 = ex.base64;
          const mime = ex.mime;
          let targetW: number | null = null;
          let targetH: number | null = null;
          if (desiredAspectRatio) {
            const parts = desiredAspectRatio.split(':');
            if (parts.length === 2) {
              const a = Number(parts[0]);
              const b = Number(parts[1]);
              if (a && b) {
                const size = await getImageSize(b64, mime);
                if (size) {
                  const nearest = nearestSupportedAspectRatioBySize(size.width, size.height);
                  if (nearest) {
                    const ps = nearest.split(':');
                    const arW = Number(ps[0]);
                    const arH = Number(ps[1]);
                    if (arW && arH) {
                      targetW = Math.max(1, Math.round(size.width));
                      targetH = Math.max(1, Math.round(targetW / (arW / arH)));
                      const scale = Math.min(targetW / size.width, targetH / size.height);
                      if (scale !== 1) {
                        const scaled = await scaleBase64ByFactor(b64, mime, scale);
                        if (scaled) {
                          b64 = scaled.base64;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          if (targetW && targetH) {
            try {
              const outSize = await getImageSize(b64, mime);
              const ok = outSize && outSize.width === targetW && outSize.height === targetH;
              if (!ok) {
                if (strictSize) {
                  return { newImageBase64: null, newImageMimeType: null, textResponse: `图像编辑失败：服务端未按尺寸输出（期望 ${targetW}x${targetH}）` };
                }
              }
            } catch { void 0; }
          }
          return { newImageBase64: b64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` };
        }
        if (s.includes('http')) {
          try {
            const urlText = extractFirstHttpUrl(s) || s;
            const r = await fetch(urlText);
            const blob = await r.blob();
            const reader = new FileReader();
            return await new Promise((resolve) => {
              reader.onload = async () => {
                let base64 = (reader.result as string).split(',')[1];
                base64 = normalizeBase64(base64);
                const mime = blob.type || detectMimeFromBase64(base64);
                let targetW: number | null = null;
                let targetH: number | null = null;
                if (desiredAspectRatio) {
                  const parts = desiredAspectRatio.split(':');
                  if (parts.length === 2) {
                    const a = Number(parts[0]);
                    const b = Number(parts[1]);
                    if (a && b) {
                      const size = await getImageSize(base64, mime);
                      if (size) {
                        const nearest = nearestSupportedAspectRatioBySize(size.width, size.height);
                        if (nearest) {
                          const ps = nearest.split(':');
                          const arW = Number(ps[0]);
                          const arH = Number(ps[1]);
                          if (arW && arH) {
                            targetW = Math.max(1, Math.round(size.width));
                            targetH = Math.max(1, Math.round(targetW / (arW / arH)));
                            const scale = Math.min(targetW / size.width, targetH / size.height);
                            if (scale !== 1) {
                              const scaled = await scaleBase64ByFactor(base64, mime, scale);
                              if (scaled) {
                                base64 = scaled.base64;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
                if (targetW && targetH) {
                  try {
                    const outSize = await getImageSize(base64, mime);
                    const ok = outSize && outSize.width === targetW && outSize.height === targetH;
                    if (!ok) {
                      if (strictSize) {
                        resolve({ newImageBase64: null, newImageMimeType: null, textResponse: `图像编辑失败：服务端未按尺寸输出（期望 ${targetW}x${targetH}）` });
                        return;
                      }
                    }
                  } catch { void 0; }
                }
                resolve({ newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` });
              };
              reader.readAsDataURL(blob);
            });
          } catch {
            const urlText = extractFirstHttpUrl(s);
            const viaImg = urlText ? await tryLoadImageBase64(urlText) : null;
            if (viaImg) return { newImageBase64: viaImg.base64, newImageMimeType: viaImg.mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` };
            return { newImageBase64: null, newImageMimeType: null, textResponse: '图像获取失败：无法创建画布' };
          }
        }
      }
      if (Array.isArray(mc)) {
        for (const part of mc) {
          if (part && part.type === 'image_url' && part.image_url && part.image_url.url) {
            const url = part.image_url.url as string;
            if (url.startsWith('data:image/')) {
              const ex2 = extractDataUrlFromText(url);
              if (!ex2) {
                continue;
              }
              return { newImageBase64: ex2.base64, newImageMimeType: ex2.mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` };
            } else {
              try {
                const r = await fetch(url);
                const ct3 = r.headers.get('content-type') || '';
                if (ct3.startsWith('image/')) {
                  const blob = await r.blob();
                  const reader = new FileReader();
                  return await new Promise((resolve) => {
                    reader.onload = () => {
                      let base64 = (reader.result as string).split(',')[1];
                      base64 = normalizeBase64(base64);
                      const mime = (blob.type && blob.type.startsWith('image/')) ? blob.type : detectMimeFromBase64(base64);
                      resolve({ newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` });
                    };
                    reader.readAsDataURL(blob);
                  });
                }
                const viaImg = await tryLoadImageBase64(url);
                if (viaImg) return { newImageBase64: viaImg.base64, newImageMimeType: viaImg.mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` };
                return { newImageBase64: null, newImageMimeType: null, textResponse: `图像编辑失败：非图像内容(${ct3 || 'unknown'})` };
              } catch {
                const viaImg = await tryLoadImageBase64(url);
                if (viaImg) return { newImageBase64: viaImg.base64, newImageMimeType: viaImg.mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` };
                return { newImageBase64: null, newImageMimeType: null, textResponse: '图像获取失败：无法创建画布' };
              }
            }
          }
        }
      }
    }
    return { newImageBase64: null, newImageMimeType: null, textResponse: "图像编辑失败：未找到输出" };
    
  } catch (error) {
    console.error('whatai 图像编辑失败:', error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error)));
    const safe = sanitizeErrorMessage(error);
    return {
      newImageBase64: null,
      newImageMimeType: null,
      textResponse: `图像编辑失败: ${safe}`
    };
  }
}

export async function generateVideo(
  prompt: string,
  aspectRatio: '16:9' | '9:16',
  onProgress: (message: string) => void,
  image?: ImageInput
): Promise<{ videoBlob: Blob; mimeType: string }> {
  if (!isWhataiEnabled()) {
    throw new Error("whatai API 未配置或未启用");
  }

  try {
    onProgress("正在使用 whatai 统一 API 生成视频...");

    const body: VideoGenBody = {
      model: WHATAI_VIDEO_MODEL,
      prompt: prompt,
      aspect_ratio: aspectRatio,
      duration: 5
    };

    let imageUrlForApi: string | undefined = undefined;
    if (image) {
      const maybeDataUrl = extractDataUrlFromText(image.href);
      let b64 = maybeDataUrl?.base64 || '';
      let mime = (image.mimeType && image.mimeType.startsWith('image/')) ? image.mimeType : (maybeDataUrl?.mime || 'image/png');

      if (!b64 && (image.href || '').includes('base64,')) {
        const raw = normalizeBase64(stripBase64Header(image.href));
        b64 = raw;
        mime = detectMimeFromBase64(raw);
      }

      if (!b64) {
        const viaCanvas = await tryLoadImageBase64(image.href);
        if (viaCanvas) {
          b64 = viaCanvas.base64;
          mime = viaCanvas.mime;
        }
      }

      if (b64) {
        const uplink = await preprocessUplinkImages(
          [{ href: b64, mimeType: mime }],
          { maxLongEdge: 2048, debugLabel: 'whatai/generateVideo' }
        );
        const out = uplink.images[0];
        const outMime = out?.mimeType || mime || 'image/png';
        const outB64 = out?.base64 || b64;
        imageUrlForApi = `data:${outMime};base64,${outB64}`;
        body.image = outB64;
      } else {
        imageUrlForApi = image.href;
      }
    }

    onProgress("正在发送视频生成请求...");
    
    const result = await whataiChatCompletions({
      model: WHATAI_VIDEO_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `生成视频：${prompt}，宽高比：${aspectRatio}` },
            ...(image ? [{ 
              type: "image_url", 
              image_url: { url: imageUrlForApi || image.href } 
            }] : [])
          ]
        }
      ],
      max_tokens: 1000
    });

    onProgress("视频生成完成，正在处理结果...");

    if (result.choices && result.choices[0] && result.choices[0].message) {
      const content = result.choices[0].message.content;
      if (typeof content === 'string') {
        if (content.includes('data:video/') || content.includes('http')) {
          const videoData = content.includes('data:video/') ? content : await fetch(content).then(r => r.blob());
          const blob = typeof videoData === 'string' ? dataUrlToBlob(videoData) : videoData;
          return { videoBlob: blob, mimeType: "video/mp4" };
        }
      }
    }

    throw new Error("视频生成失败：API 返回格式异常");
    
  } catch (error) {
    console.error('whatai 视频生成失败:', error);
    throw new Error(`视频生成失败: ${sanitizeErrorMessage(error)}`);
  }
}

type SimpleMessage = { role: 'system' | 'user'; content: string };

export async function generateText(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  if (!isWhataiEnabled()) {
    throw new Error("whatai API 未配置或未启用");
  }

  try {
    const messages: SimpleMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    
    messages.push({ role: "user", content: prompt });

    const body = {
      model: WHATAI_TEXT_MODEL,
      messages: messages,
      max_tokens: 2000,
      temperature: 0.7
    };

    const result = await whataiChatCompletions(body);
    
    if (result.choices && result.choices[0] && result.choices[0].message) {
      const c = result.choices[0].message.content;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) {
        const arr = c as Array<{ type?: string; text?: string }>;
        const textPart = arr.find((p) => p && p.type === 'text' && typeof p.text === 'string');
        if (textPart && textPart.text) return textPart.text;
        return JSON.stringify(c);
      }
    }
    
    throw new Error("文本生成失败：API 返回格式异常");
    
  } catch (error) {
    console.error('whatai 文本生成失败:', error);
    throw new Error(`文本生成失败: ${sanitizeErrorMessage(error)}`);
  }
}

export async function runSizeProbe(): Promise<{ png: { width: number; height: number } | null }> {
  const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YbODXcAAAAASUVORK5CYII=';
  const size = await getImageSize(pngB64, 'image/png');
  return { png: size || null };
}
