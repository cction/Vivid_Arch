import { detectMimeFromBase64, getImageSize, normalizeBase64, resizeBase64ToMax, stripBase64Header } from '@/utils/image';

export type UplinkImageInput = {
  href: string;
  mimeType?: string;
};

export type UplinkPreprocessedImage = {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  scale: number;
};

export type UplinkPreprocessResult = {
  images: UplinkPreprocessedImage[];
  mask?: UplinkPreprocessedImage;
};

async function resizeBase64ToExact(
  base64: string,
  mimeType: string,
  targetW: number,
  targetH: number
): Promise<{ base64: string; width: number; height: number } | null> {
  if (typeof window === 'undefined') return null;
  const w = Math.max(1, Math.floor(targetW));
  const h = Math.max(1, Math.floor(targetH));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const url = `data:${mimeType};base64,${normalizeBase64(stripBase64Header(base64))}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to load image during resize'));
    i.src = url;
  });
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL(mimeType).split(',')[1] || base64;
  return { base64: out, width: w, height: h };
}

function resolveMime(inputBase64: string, mimeType?: string): string {
  const m = (mimeType || '').trim();
  if (m.startsWith('image/')) return m;
  const raw = normalizeBase64(stripBase64Header(inputBase64));
  return detectMimeFromBase64(raw);
}

export async function preprocessUplinkImages(
  images: UplinkImageInput[],
  opts?: { mask?: UplinkImageInput; maxLongEdge?: number; debugLabel?: string }
): Promise<UplinkPreprocessResult> {
  const maxLongEdge = Math.max(1, Math.floor(opts?.maxLongEdge ?? 2048));
  const debugLabel = (opts?.debugLabel || '').trim();

  const outImages: UplinkPreprocessedImage[] = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const rawBase64 = normalizeBase64(stripBase64Header(img.href));
    const mime = resolveMime(rawBase64, img.mimeType);
    const size = await getImageSize(rawBase64, mime);
    if (!size) {
      outImages.push({ base64: rawBase64, mimeType: mime, width: 0, height: 0, originalWidth: 0, originalHeight: 0, scale: 1 });
      continue;
    }
    const scale = Math.min(maxLongEdge / Math.max(size.width, size.height), 1);
    const scaled = await resizeBase64ToMax(rawBase64, mime, maxLongEdge, maxLongEdge);
    const finalB64 = scaled?.base64 ?? rawBase64;
    const finalW = scaled?.width ?? size.width;
    const finalH = scaled?.height ?? size.height;
    outImages.push({
      base64: finalB64,
      mimeType: mime,
      width: finalW,
      height: finalH,
      originalWidth: size.width,
      originalHeight: size.height,
      scale
    });
  }

  let outMask: UplinkPreprocessedImage | undefined;
  if (opts?.mask) {
    const rawMaskBase64 = normalizeBase64(stripBase64Header(opts.mask.href));
    const maskMime = resolveMime(rawMaskBase64, opts.mask.mimeType);
    const ref = outImages[0];
    const refW = ref?.width || 0;
    const refH = ref?.height || 0;
    const maskSize = await getImageSize(rawMaskBase64, maskMime);
    if (refW && refH && maskSize) {
      const resized = await resizeBase64ToExact(rawMaskBase64, maskMime, refW, refH);
      const finalB64 = resized?.base64 ?? rawMaskBase64;
      const finalW = resized?.width ?? maskSize.width;
      const finalH = resized?.height ?? maskSize.height;
      outMask = {
        base64: finalB64,
        mimeType: maskMime,
        width: finalW,
        height: finalH,
        originalWidth: maskSize.width,
        originalHeight: maskSize.height,
        scale: ref?.scale ?? 1
      };
    } else {
      outMask = { base64: rawMaskBase64, mimeType: maskMime, width: 0, height: 0, originalWidth: 0, originalHeight: 0, scale: 1 };
    }
  }

  try {
    if (debugLabel) {
      const img0 = outImages[0];
      console.debug('[uplinkPreprocess]', {
        label: debugLabel,
        maxLongEdge,
        images: outImages.map((x) => ({
          mimeType: x.mimeType,
          original: `${x.originalWidth}x${x.originalHeight}`,
          final: `${x.width}x${x.height}`,
          scale: x.scale
        })),
        mask: outMask
          ? {
              mimeType: outMask.mimeType,
              original: `${outMask.originalWidth}x${outMask.originalHeight}`,
              final: `${outMask.width}x${outMask.height}`,
              scale: outMask.scale,
              alignedTo: img0 ? `${img0.width}x${img0.height}` : null
            }
          : null
      });
    }
  } catch {
    void 0;
  }

  return { images: outImages, mask: outMask };
}

