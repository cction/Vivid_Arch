import { useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Element, Point } from '@/types';

type Deps = {
  zoom: number;
  commitAction: (updater: (prev: Element[]) => Element[]) => void;
  getDescendants: (id: string, all: Element[]) => Element[];
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  handleAddImageElement: (file: File) => void;
  generateId: () => string;
};

export function useClipboard({ zoom, commitAction, getDescendants, setSelectedElementIds, handleAddImageElement, generateId }: Deps) {
  const handleCopyElement = useCallback((elementToCopy: Element) => {
    commitAction(prev => {
      const elementsToCopy = [elementToCopy, ...getDescendants(elementToCopy.id, prev)];
      const idMap = new Map<string, string>();

      const newElements: Element[] = elementsToCopy.map((el): Element => {
        const newId = generateId();
        idMap.set(el.id, newId);
        const dx = 20 / zoom;
        const dy = 20 / zoom;
        switch (el.type) {
          case 'path':
            return { ...el, id: newId, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
          case 'arrow':
            return { ...el, id: newId, points: [{ x: el.points[0].x + dx, y: el.points[0].y + dy }, { x: el.points[1].x + dx, y: el.points[1].y + dy }] as [Point, Point] };
          case 'line':
            return { ...el, id: newId, points: [{ x: el.points[0].x + dx, y: el.points[0].y + dy }, { x: el.points[1].x + dx, y: el.points[1].y + dy }] as [Point, Point] };
          case 'image':
          case 'shape':
          case 'text':
          case 'group':
          case 'video':
            return { ...el, id: newId, x: el.x + dx, y: el.y + dy };
        }
      });

      const finalNewElements: Element[] = newElements.map((el): Element => {
        const parentId = el.parentId ? idMap.get(el.parentId) : undefined;
        switch (el.type) {
          case 'image': return { ...el, parentId };
          case 'path': return { ...el, parentId };
          case 'shape': return { ...el, parentId };
          case 'text': return { ...el, parentId };
          case 'arrow': return { ...el, parentId };
          case 'line': return { ...el, parentId };
          case 'group': return { ...el, parentId };
          case 'video': return { ...el, parentId };
        }
      });

      setSelectedElementIds([idMap.get(elementToCopy.id)!]);
      return [...prev, ...finalNewElements];
    });
  }, [zoom, commitAction, getDescendants, setSelectedElementIds, generateId]);

  const handleDeleteElement = useCallback((id: string) => {
    commitAction(prev => {
      const idsToDelete = new Set([id]);
      getDescendants(id, prev).forEach(desc => idsToDelete.add(desc.id));
      return prev.filter(el => !idsToDelete.has(el.id));
    });
    setSelectedElementIds(prev => prev.filter(selId => selId !== id));
  }, [commitAction, setSelectedElementIds, getDescendants]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files && e.clipboardData.files[0];
      if (file && file.type.startsWith('image/')) {
        e.preventDefault();
        handleAddImageElement(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleAddImageElement]);

  return { handleCopyElement, handleDeleteElement };
}

