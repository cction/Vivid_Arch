import { useCallback } from 'react';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { Element } from '@/types';
import { mergeLayersToImageElement } from '@/features/layerMerge';

type Deps = {
  elementsRef: MutableRefObject<Element[]>;
  selectedElementIds: string[];
  getDescendants: (id: string, all: Element[]) => Element[];
  commitAction: (updater: (prev: Element[]) => Element[]) => void;
  generateId: () => string;
  setError: Dispatch<SetStateAction<string | null>>;
  zoom: number;
};

export function useLayerMerge({ elementsRef, selectedElementIds, getDescendants, commitAction, generateId, setError, zoom }: Deps) {
  const handleMergeLayers = useCallback(async (mode: 'selected' | 'visible') => {
    try {
      const result = await mergeLayersToImageElement({
        elements: elementsRef.current,
        selectedElementIds,
        mode,
        getDescendants,
        generateId,
        zoom,
      });

      if (!result) return;

      const { newImage, idsToMerge } = result;

      commitAction(prev => {
        const keep = prev.filter(el => !idsToMerge.has(el.id));
        return [...keep, newImage];
      });
    } catch (e) {
      console.error(e);
      setError('合并图层失败：' + (e as Error).message);
    }
  }, [elementsRef, selectedElementIds, getDescendants, commitAction, generateId, setError, zoom]);

  return { handleMergeLayers };
}
