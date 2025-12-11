const IS_BROWSER = typeof window !== 'undefined';

export function normalizeBase64(b64: string): string {
  let s = b64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  else if (pad !== 0) { while (s.length % 4 !== 0) s += '='; }
  return s;
}

export function stripBase64Header(input: string): string {
  const idx = input.indexOf('base64,');
  if (idx >= 0) return input.substring(idx + 7);
  return input.replace(/^data:.*?;base64,?/i, '');
}

export const PLACEHOLDER_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

export function detectMimeFromBase64(b64: string): string {
  try {
    const bin = atob(b64.slice(0, 64));
    if (bin.length >= 4) {
      const sig = [bin.charCodeAt(0), bin.charCodeAt(1), bin.charCodeAt(2), bin.charCodeAt(3)];
      if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47) return 'image/png';
      if (sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff) return 'image/jpeg';
      if (bin.startsWith('GIF8')) return 'image/gif';
      if (bin.startsWith('RIFF')) return 'image/webp';
    }
  } catch { return 'image/png'; }
  return 'image/png';
}

export function extractDataUrlFromText(input: string): { base64: string; mime: string } | null {
  const m = input.match(/data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=_-]+)/);
  if (!m) return null;
  const mime = m[1];
  const raw = m[2];
  const b64 = normalizeBase64(raw);
  const outMime = mime.startsWith('image/') ? mime : detectMimeFromBase64(b64);
  return { base64: b64, mime: outMime };
}

export function extractInlineData(part: unknown): { base64: string; mime: string } | null {
  const p = part as { inline_data?: { data?: unknown; mime_type?: unknown }; inlineData?: { data?: unknown; mimeType?: unknown } };
  const data = p?.inline_data?.data ?? p?.inlineData?.data;
  const mime = p?.inline_data?.mime_type ?? p?.inlineData?.mimeType;
  if (!data) return null;
  const b64 = normalizeBase64(stripBase64Header(String(data)));
  const outMime = (mime && String(mime).startsWith('image/')) ? String(mime) : detectMimeFromBase64(b64);
  return { base64: b64, mime: outMime };
}

export function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function readUInt16BE(bytes: Uint8Array, offset: number): number { return (bytes[offset] << 8) | bytes[offset + 1]; }
function readUInt32BE(bytes: Uint8Array, offset: number): number { return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0; }

export function getImageSizeFromBytes(bytes: Uint8Array): { width: number; height: number } | null {
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

export async function getImageSize(base64: string, mimeType?: string): Promise<{ width: number; height: number } | null> {
  const s = await getBase64ImageSize(base64, mimeType);
  if (s) return s;
  const b64 = normalizeBase64(stripBase64Header(base64));
  const bytes = decodeBase64ToBytes(b64);
  return getImageSizeFromBytes(bytes);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const meta = parts[0];
  const base64 = normalizeBase64(parts[1] ?? parts[0]);
  const mimeMatch = /data:(.*?);base64/.exec(meta);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export async function computeAspectRatioFromBase64(base64: string, mimeType?: string): Promise<string | null> {
  if (!IS_BROWSER) return null;
  try {
    const rawInAr = stripBase64Header(base64);
    const normInAr = normalizeBase64(rawInAr);
    const detectedAr = detectMimeFromBase64(normInAr);
    const useMimeAr = (mimeType && mimeType.startsWith('image/')) ? mimeType : detectedAr;
    const url = `data:${useMimeAr};base64,${normInAr}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loaded = await new Promise<HTMLImageElement>((resolve, reject) => { img.onload = () => resolve(img); img.onerror = () => reject(new Error('Failed to load base64 image for aspect ratio')); img.src = url; });
    let w = loaded.naturalWidth || loaded.width;
    let h = loaded.naturalHeight || loaded.height;
    if (!w || !h) return null;
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const g = gcd(w, h);
    const ar = `${Math.round(w / g)}:${Math.round(h / g)}`;
    return ar;
  } catch { return null; }
}

export async function getBase64ImageSize(base64: string, mimeType?: string): Promise<{ width: number; height: number } | null> {
  if (!IS_BROWSER) return null;
  const raw = stripBase64Header(base64);
  const b64 = normalizeBase64(raw);
  const detected = detectMimeFromBase64(b64);
  const useMime = (mimeType && mimeType.startsWith('image/')) ? mimeType : detected;
  const dataUrl = `data:${useMime};base64,${b64}`;
  const tryLoad = async (src: string): Promise<HTMLImageElement> => {
    return await new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = () => reject(new Error('Failed to load base64 image for size')); img.src = src; });
  };
  try {
    const loaded = await tryLoad(dataUrl);
    const w = loaded.naturalWidth || loaded.width;
    const h = loaded.naturalHeight || loaded.height;
    if (!w || !h) return null;
    return { width: w, height: h };
  } catch { return null; }
}

export async function getImageSizeFromBlob(blob: Blob): Promise<{ width: number; height: number } | null> {
  if (typeof window === 'undefined') return null;
  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(blob);
      const w = bmp.width;
      const h = bmp.height;
      try { bmp.close(); } catch { /* noop */ }
      return w && h ? { width: w, height: h } : null;
    }
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Failed to load blob image for size')); i.src = url; });
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      return w && h ? { width: w, height: h } : null;
    } finally { URL.revokeObjectURL(url); }
  } catch { return null; }
}

export async function resizeBlobToMax(blob: Blob, mimeType?: string, maxWidth = 2048, maxHeight = 2048): Promise<{ dataUrl: string; width: number; height: number; scale: number } | null> {
  if (typeof window === 'undefined') return null;
  try {
    let imgBitmap: ImageBitmap | null = null;
    let imgEl: HTMLImageElement | null = null;
    let width = 0, height = 0;
    if (typeof createImageBitmap === 'function') {
      imgBitmap = await createImageBitmap(blob);
      width = imgBitmap.width;
      height = imgBitmap.height;
    } else {
      const url = URL.createObjectURL(blob);
      try {
        imgEl = await new Promise<HTMLImageElement>((resolve, reject) => { const el = new Image(); el.onload = () => resolve(el); el.onerror = () => reject(new Error('Failed to load blob image for resize')); el.src = url; });
        width = imgEl.naturalWidth || imgEl.width;
        height = imgEl.naturalHeight || imgEl.height;
      } finally { URL.revokeObjectURL(url); }
    }
    if ((!imgBitmap && !imgEl) || !width || !height) return null;
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    const targetW = Math.max(1, Math.floor(width * scale));
    const targetH = Math.max(1, Math.floor(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetW; canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (imgBitmap) { ctx.drawImage(imgBitmap, 0, 0, targetW, targetH); try { imgBitmap.close(); } catch { /* noop */ } }
    else if (imgEl) { ctx.drawImage(imgEl, 0, 0, targetW, targetH); }
    const outMime = (mimeType && mimeType.startsWith('image/')) ? mimeType : 'image/png';
    const dataUrl = canvas.toDataURL(outMime);
    return { dataUrl, width: targetW, height: targetH, scale };
  } catch { return null; }
}

export async function resizeBase64ToMax(base64: string, mimeType?: string, maxWidth = 2048, maxHeight = 2048): Promise<{ base64: string; width: number; height: number; scale: number } | null> {
  const size = await getImageSize(base64, mimeType);
  if (!size) return null;
  const { width, height } = size;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  if (scale >= 1) return { base64, width, height, scale: 1 };
  const targetW = Math.max(1, Math.floor(width * scale));
  const targetH = Math.max(1, Math.floor(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const url = `data:${mimeType || 'image/png'};base64,${normalizeBase64(stripBase64Header(base64))}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.onerror = () => reject(new Error('Failed to load image during resize')); i.src = url; });
  ctx.drawImage(img, 0, 0, targetW, targetH);
  const out = canvas.toDataURL(mimeType || 'image/png').split(',')[1] || base64;
  return { base64: out, width: targetW, height: targetH, scale };
}

export async function scaleBase64ByFactor(base64: string, mimeType: string | undefined, factor: number): Promise<{ base64: string; width: number; height: number } | null> {
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
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.onerror = () => reject(new Error('Failed to load image during scale')); i.src = url; });
  ctx.drawImage(img, 0, 0, targetW, targetH);
  const out = canvas.toDataURL(mimeType || 'image/png').split(',')[1] || base64;
  return { base64: out, width: targetW, height: targetH };
}

export async function letterboxToAspectRatio(base64: string, mimeType: string, targetAspectRatio: string): Promise<string> {
  if (!IS_BROWSER) return base64;
  const [twStr, thStr] = targetAspectRatio.split(':');
  const tw = parseInt(twStr, 10);
  const th = parseInt(thStr, 10);
  if (!tw || !th) return base64;
  const url = `data:${mimeType};base64,${base64}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Failed to load image for letterbox AR')); i.src = url; });
  const cw = img.naturalWidth || img.width;
  const ch = img.naturalHeight || img.height;
  if (!cw || !ch) return base64;
  const currentRatio = cw / ch;
  let canvasW = cw;
  let canvasH = Math.round(cw / (tw / th));
  if ((tw / th) > currentRatio) { canvasH = ch; canvasW = Math.round(ch * (tw / th)); }
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return base64;
  ctx.clearRect(0, 0, canvasW, canvasH);
  let drawW = canvasW;
  let drawH = Math.round(drawW / currentRatio);
  if (drawH > canvasH) { drawH = canvasH; drawW = Math.round(drawH * currentRatio); }
  const dx = Math.round((canvasW - drawW) / 2);
  const dy = Math.round((canvasH - drawH) / 2);
  ctx.drawImage(img, dx, dy, drawW, drawH);
  const out = canvas.toDataURL(mimeType).split(',')[1] || base64;
  return out;
}

export async function letterboxToFixedSize(base64: string, mimeType: string, targetW: number, targetH: number): Promise<string> {
  if (!IS_BROWSER) return base64;
  if (!targetW || !targetH) return base64;
  const url = `data:${mimeType};base64,${base64}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Failed to load image for letterbox fixed size')); i.src = url; });
  const cw = img.naturalWidth || img.width;
  const ch = img.naturalHeight || img.height;
  if (!cw || !ch) return base64;
  const currentRatio = cw / ch;
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return base64;
  ctx.clearRect(0, 0, targetW, targetH);
  let drawW = targetW;
  let drawH = Math.round(drawW / currentRatio);
  if (drawH > targetH) { drawH = targetH; drawW = Math.round(drawH * currentRatio); }
  const dx = Math.round((targetW - drawW) / 2);
  const dy = Math.round((targetH - drawH) / 2);
  ctx.drawImage(img, dx, dy, drawW, drawH);
  const out = canvas.toDataURL(mimeType).split(',')[1] || base64;
  return out;
}

export async function loadImageWithFallback(base64: string, mimeType: string): Promise<{ img: HTMLImageElement; href: string }> {
  const raw = stripBase64Header(base64);
  const norm = normalizeBase64(raw);
  const primaryUrl = `data:${mimeType};base64,${norm}`;
  const tryLoad = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => resolve(i); i.onerror = () => reject(new Error('Image load failed')); i.src = src; });
  try {
    const img = await tryLoad(primaryUrl);
    return { img, href: primaryUrl };
  } catch {
    const resized = await resizeBase64ToMax(base64, mimeType);
    if (!resized) throw new Error('Fallback load failed');
    const fallbackUrl = `data:${mimeType};base64,${resized.base64}`;
    const img = await tryLoad(fallbackUrl);
    return { img, href: fallbackUrl };
  }
}
