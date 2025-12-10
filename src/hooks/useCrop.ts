import { useCallback, useState } from 'react';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { Tool, Element, ImageElement } from '@/types';
type Rect = { x: number; y: number; width: number; height: number };

type Deps = {
  setActiveTool: Dispatch<SetStateAction<Tool>>;
  elementsRef: MutableRefObject<Element[]>;
  commitAction: (updater: (prev: Element[]) => Element[]) => void;
  setError: Dispatch<SetStateAction<string | null>>;
};

const SUPPORTED_CROP_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const;

const parseRatio = (r: string | null): number | null => {
  if (!r) return null;
  const parts = r.split(':');
  if (parts.length !== 2) return null;
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (!a || !b) return null;
  return a / b;
};

const nearestSupportedCropRatioBySize = (w?: number | null, h?: number | null): string | null => {
  if (!w || !h || w <= 0 || h <= 0) return null;
  const target = w / h;
  let best: string | null = null;
  let diffBest = Number.POSITIVE_INFINITY;
  for (const cand of SUPPORTED_CROP_RATIOS) {
    const [a, b] = cand.split(':').map(Number);
    if (!a || !b) continue;
    const val = a / b;
    const d = Math.abs(val - target);
    if (d < diffBest) { diffBest = d; best = cand; }
  }
  return best;
};

const fitCropToRatio = (element: ImageElement, ratioText: string): Rect => {
  const ar = parseRatio(ratioText) || (element.width / element.height);
  const W = element.width, H = element.height;
  let width: number, height: number;
  if (ar >= W / H) {
    width = W;
    height = Math.max(1, Math.round(width / ar));
  } else {
    height = H;
    width = Math.max(1, Math.round(height * ar));
  }
  const x = element.x + Math.round((W - width) / 2);
  const y = element.y + Math.round((H - height) / 2);
  return { x, y, width, height };
};

export function useCrop({ setActiveTool, elementsRef, commitAction, setError }: Deps) {
  const [croppingState, setCroppingState] = useState<{ elementId: string; originalElement: ImageElement; cropBox: Rect } | null>(null);
  const [cropAspectRatio, setCropAspectRatio] = useState<string | null>(null);

  const handleCropAspectRatioChange = useCallback((value: string | null) => {
    setCropAspectRatio(value);
    setCroppingState(prev => {
      if (!prev) return prev;
      const { originalElement } = prev;
      if (value && SUPPORTED_CROP_RATIOS.includes(value as (typeof SUPPORTED_CROP_RATIOS)[number])) {
        const nextBox = fitCropToRatio(originalElement, value);
        return { ...prev, cropBox: nextBox };
      }
      return prev;
    });
  }, []);

  const handleStartCrop = useCallback((element: ImageElement) => {
    setActiveTool('select');
    const auto = nearestSupportedCropRatioBySize(element.width, element.height);
    setCropAspectRatio(auto);
    const initialBox = auto ? fitCropToRatio(element, auto) : { x: element.x, y: element.y, width: element.width, height: element.height };
    setCroppingState({ elementId: element.id, originalElement: { ...element }, cropBox: initialBox });
  }, [setActiveTool]);

  const handleCancelCrop = useCallback(() => { setCroppingState(null); }, []);

  const handleConfirmCrop = useCallback(() => {
    if (!croppingState) return;
    const { elementId, cropBox } = croppingState;
    const elementToCrop = elementsRef.current.find(el => el.id === elementId) as ImageElement;
    if (!elementToCrop) { handleCancelCrop(); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = cropBox.width;
      canvas.height = cropBox.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setError('Failed to create canvas context for cropping.'); handleCancelCrop(); return; }
      const scaleX = img.width / elementToCrop.width;
      const scaleY = img.height / elementToCrop.height;
      let sx = (cropBox.x - elementToCrop.x) * scaleX;
      let sy = (cropBox.y - elementToCrop.y) * scaleY;
      let sWidth = cropBox.width * scaleX;
      let sHeight = cropBox.height * scaleY;
      if (sx < 0) { sWidth += sx; sx = 0; }
      if (sy < 0) { sHeight += sy; sy = 0; }
      if (sx + sWidth > img.width) { sWidth = img.width - sx; }
      if (sy + sHeight > img.height) { sHeight = img.height - sy; }
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, cropBox.width, cropBox.height);
      const newHref = canvas.toDataURL(elementToCrop.mimeType);
      commitAction(prev => prev.map(el => {
        if (el.id === elementId && el.type === 'image') {
          const updatedEl: ImageElement = { ...el, href: newHref, x: cropBox.x, y: cropBox.y, width: cropBox.width, height: cropBox.height };
          return updatedEl;
        }
        return el;
      }));
      handleCancelCrop();
    };
    img.onerror = () => { setError('Failed to load image for cropping.'); handleCancelCrop(); };
    img.src = (elementToCrop as ImageElement).href;
  }, [croppingState, elementsRef, commitAction, setError, handleCancelCrop]);

  return { croppingState, setCroppingState, cropAspectRatio, handleCropAspectRatioChange, handleStartCrop, handleCancelCrop, handleConfirmCrop };
}
