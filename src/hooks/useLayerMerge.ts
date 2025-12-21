import { useCallback } from 'react';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { Element, ImageElement } from '@/types';
import { flattenElementsToImage } from '@/utils/canvas';
import { getUiRadiusLg } from '@/ui/standards';

type Deps = {
  elementsRef: MutableRefObject<Element[]>;
  selectedElementIds: string[];
  getDescendants: (id: string, all: Element[]) => Element[];
  commitAction: (updater: (prev: Element[]) => Element[]) => void;
  generateId: () => string;
  setError: Dispatch<SetStateAction<string | null>>;
};

export function useLayerMerge({ elementsRef, selectedElementIds, getDescendants, commitAction, generateId, setError }: Deps) {
  const handleMergeLayers = useCallback(async (mode: 'selected' | 'visible') => {
    const all = elementsRef.current;
    let idsToMerge = new Set<string>();
    if (mode === 'selected' && selectedElementIds.length > 0) {
      selectedElementIds.forEach(id => {
        idsToMerge.add(id);
        const el = all.find(e => e.id === id);
        if (el && el.type === 'group') {
          getDescendants(id, all).forEach(desc => idsToMerge.add(desc.id));
        }
      });
    } else {
      all.forEach(el => {
        if (el.isVisible !== false) {
          idsToMerge.add(el.id);
          if (el.type === 'group') {
            getDescendants(el.id, all).forEach(desc => idsToMerge.add(desc.id));
          }
        }
      });
    }

    const elementsToFlatten = all.filter(el => idsToMerge.has(el.id) && el.type !== 'group');
    if (elementsToFlatten.length === 0) return;

    try {
      const flattened = await flattenElementsToImage(elementsToFlatten);
      const newImage: ImageElement = {
        id: generateId(),
        type: 'image',
        name: 'Merged Image',
        x: flattened.x,
        y: flattened.y,
        width: flattened.width,
        height: flattened.height,
        href: flattened.href,
        mimeType: flattened.mimeType,
        borderRadius: getUiRadiusLg(),
        isLocked: false,
        isVisible: true,
      };
      commitAction(prev => {
        const keep = prev.filter(el => !idsToMerge.has(el.id));
        return [...keep, newImage];
      });
    } catch (e) {
      console.error(e);
      setError('合并图层失败：' + (e as Error).message);
    }
  }, [elementsRef, selectedElementIds, getDescendants, commitAction, generateId, setError]);

  return { handleMergeLayers };
}
