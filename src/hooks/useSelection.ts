import { useCallback } from 'react';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { Element, GroupElement, Point } from '@/types';
import { getElementBounds } from '@/utils/canvas';

type Rect = { x: number; y: number; width: number; height: number };

type Deps = {
  elementsRef: MutableRefObject<Element[]>;
  selectedElementIds: string[];
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  commitAction: (updater: (prev: Element[]) => Element[]) => void;
  getDescendants: (id: string, all: Element[]) => Element[];
  generateId: () => string;
};

export function useSelection({ elementsRef, selectedElementIds, setSelectedElementIds, commitAction, getDescendants, generateId }: Deps) {
  const getSelectionBounds = useCallback((selectionIds: string[]): Rect => {
    const selectedElements = elementsRef.current.filter(el => selectionIds.includes(el.id));
    if (selectedElements.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedElements.forEach(el => {
      const bounds = getElementBounds(el, elementsRef.current);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [elementsRef]);

  const handleGroup = useCallback(() => {
    const selectedElements = elementsRef.current.filter(el => selectedElementIds.includes(el.id));
    if (selectedElements.length < 2) return;
    const bounds = getSelectionBounds(selectedElementIds);
    const newGroupId = generateId();
    const newGroup: GroupElement = { id: newGroupId, type: 'group', name: 'Group', x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    commitAction(prev => {
      const updatedElements = prev.map(el => (selectedElementIds.includes(el.id) ? { ...el, parentId: newGroupId } : el));
      return [...updatedElements, newGroup];
    });
    setSelectedElementIds([newGroupId]);
  }, [elementsRef, selectedElementIds, commitAction, setSelectedElementIds, generateId, getSelectionBounds]);

  const handleUngroup = useCallback(() => {
    if (selectedElementIds.length !== 1) return;
    const groupId = selectedElementIds[0];
    const group = elementsRef.current.find(el => el.id === groupId);
    if (!group || group.type !== 'group') return;
    const childrenIds: string[] = [];
    commitAction(prev => {
      return prev
        .map(el => {
          if (el.parentId === groupId) {
            childrenIds.push(el.id);
            return { ...el, parentId: undefined };
          }
          return el;
        })
        .filter(el => el.id !== groupId);
    });
    setSelectedElementIds(childrenIds);
  }, [elementsRef, selectedElementIds, commitAction, setSelectedElementIds]);

  const handleAlignSelection = useCallback((alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const selectedElements = elementsRef.current.filter(el => selectedElementIds.includes(el.id));
    if (selectedElements.length < 2) return;
    const selectionBounds = getSelectionBounds(selectedElementIds);
    const { x: minX, y: minY, width, height } = selectionBounds;
    const maxX = minX + width;
    const maxY = minY + height;
    const selectionCenterX = minX + width / 2;
    const selectionCenterY = minY + height / 2;
    commitAction(prev => {
      const elementsToUpdate = new Map<string, { dx: number; dy: number }>();
      selectedElements.forEach(el => {
        const bounds = getElementBounds(el, prev);
        let dx = 0;
        let dy = 0;
        switch (alignment) {
          case 'left': dx = minX - bounds.x; break;
          case 'center': dx = selectionCenterX - (bounds.x + bounds.width / 2); break;
          case 'right': dx = maxX - (bounds.x + bounds.width); break;
          case 'top': dy = minY - bounds.y; break;
          case 'middle': dy = selectionCenterY - (bounds.y + bounds.height / 2); break;
          case 'bottom': dy = maxY - (bounds.y + bounds.height); break;
        }
        if (dx !== 0 || dy !== 0) {
          const elementsToMove = [el, ...getDescendants(el.id, prev)];
          elementsToMove.forEach(elementToMove => {
            if (!elementsToUpdate.has(elementToMove.id)) {
              elementsToUpdate.set(elementToMove.id, { dx, dy });
            }
          });
        }
      });
      return prev.map((el): Element => {
        const delta = elementsToUpdate.get(el.id);
        if (!delta) return el;
        const { dx, dy } = delta;
        switch (el.type) {
          case 'image':
          case 'shape':
          case 'text':
          case 'group':
          case 'video':
            return { ...el, x: el.x + dx, y: el.y + dy };
          case 'arrow':
          case 'line':
            return { ...el, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) as [Point, Point] };
          case 'path':
            return { ...el, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
        }
      });
    });
  }, [elementsRef, selectedElementIds, commitAction, getDescendants, getSelectionBounds]);

  return { getSelectionBounds, handleGroup, handleUngroup, handleAlignSelection };
}
