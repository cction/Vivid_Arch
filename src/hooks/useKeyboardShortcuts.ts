import { useEffect } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { Element, Tool } from '@/types';

type Editing = { id: string; text: string } | null;

type Deps = {
  editingElement: Editing;
  handleStopEditing: () => void;
  selectedElementIds: string[];
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  activeTool: Tool;
  setActiveTool: Dispatch<SetStateAction<Tool>>;
  handleUndo: () => void;
  handleRedo: () => void;
  commitAction: (updater: (prev: Element[]) => Element[]) => void;
  getDescendants: (id: string, all: Element[]) => Element[];
  elementsRef: MutableRefObject<Element[]>;
  spacebarDownTimeRef: MutableRefObject<number | null>;
  previousToolRef: MutableRefObject<Tool>;
  setSpacebarDownTime: (v: number | null) => void;
  setPreviousTool: (t: Tool) => void;
};

export function useKeyboardShortcuts({ editingElement, handleStopEditing, selectedElementIds, setSelectedElementIds, activeTool, setActiveTool, handleUndo, handleRedo, commitAction, getDescendants, elementsRef, spacebarDownTimeRef, previousToolRef, setSpacebarDownTime, setPreviousTool }: Deps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingElement) {
        if (e.key === 'Escape') handleStopEditing();
        return;
      }
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); handleRedo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !isTyping) {
        e.preventDefault();
        const all = elementsRef.current;
        const selectedRootIds = new Set<string>();
        for (let i = 0; i < all.length; i++) {
          let cur: Element | undefined = all[i];
          if (!cur || cur.isVisible === false || cur.isLocked === true) continue;
          while (cur && cur.parentId) {
            const parent = all.find(el => el.id === cur!.parentId);
            if (!parent) break;
            if (parent.isLocked) { cur = undefined; break; }
            cur = parent;
          }
          if (cur) selectedRootIds.add(cur.id);
        }
        setSelectedElementIds(Array.from(selectedRootIds));
        return;
      }
      if (!isTyping && (e.key === 'Delete' || e.key === 'Backspace') && selectedElementIds.length > 0) {
        e.preventDefault();
        commitAction(prev => {
          const idsToDelete = new Set(selectedElementIds);
          selectedElementIds.forEach(id => { getDescendants(id, prev).forEach(desc => idsToDelete.add(desc.id)); });
          return prev.filter(el => !idsToDelete.has(el.id));
        });
        setSelectedElementIds([]);
        return;
      }
      if (e.key === ' ' && !isTyping) {
        e.preventDefault();
        if (spacebarDownTimeRef.current === null) {
          setSpacebarDownTime(Date.now());
          setPreviousTool(activeTool);
          setActiveTool('pan');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && !editingElement) {
        const target = e.target as HTMLElement;
        const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        if (isTyping || spacebarDownTimeRef.current === null) return;
        e.preventDefault();
        const duration = Date.now() - spacebarDownTimeRef.current;
        setSpacebarDownTime(null);
        const toolBeforePan = previousToolRef.current;
        if (duration < 200) {
          if (toolBeforePan === 'pan') { setActiveTool('select'); }
          else if (toolBeforePan === 'select') { setActiveTool('pan'); }
          else { setActiveTool('select'); }
        } else {
          setActiveTool(toolBeforePan);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editingElement, handleStopEditing, handleUndo, handleRedo, selectedElementIds, activeTool, commitAction, getDescendants, elementsRef, setSelectedElementIds, setActiveTool, spacebarDownTimeRef, previousToolRef, setSpacebarDownTime, setPreviousTool]);
}
