import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { touchLastSessionPending } from '@/services/boardsStorage';
import type { Board, Element } from '@/types';

export function useBoardActions(
  activeBoardId: string,
  setBoards: Dispatch<SetStateAction<Board[]>>
) {
  const updateActiveBoard = useCallback((updater: (board: Board) => Board) => {
    setBoards(prevBoards => {
      const now = Date.now();
      const next: Board[] = prevBoards.map(board => (board.id === activeBoardId ? { ...updater(board), updatedAt: now } : board));
      touchLastSessionPending({ boards: next, activeBoardId });
      return next;
    });
  }, [activeBoardId, setBoards]);

  const updateActiveBoardSilent = useCallback((updater: (board: Board) => Board) => {
    setBoards(prevBoards => {
      const now = Date.now();
      const next: Board[] = prevBoards.map(board => (board.id === activeBoardId ? { ...updater(board), updatedAt: now } : board));
      touchLastSessionPending({ boards: next, activeBoardId });
      return next;
    });
  }, [activeBoardId, setBoards]);

  const setElements = useCallback((updater: (prev: Element[]) => Element[], commit: boolean = true) => {
    const apply = commit ? updateActiveBoard : updateActiveBoardSilent;
    apply(board => {
      const newElements = updater(board.elements);
      if (commit) {
        const newHistory = [...board.history.slice(0, board.historyIndex + 1), newElements];
        return { ...board, elements: newElements, history: newHistory, historyIndex: newHistory.length - 1 };
      } else {
        const tempHistory = [...board.history];
        tempHistory[board.historyIndex] = newElements;
        return { ...board, elements: newElements, history: tempHistory };
      }
    });
  }, [updateActiveBoard, updateActiveBoardSilent]);

  const commitAction = useCallback((updater: (prev: Element[]) => Element[]) => {
    updateActiveBoard(board => {
      const newElements = updater(board.elements);
      const newHistory = [...board.history.slice(0, board.historyIndex + 1), newElements];
      return { ...board, elements: newElements, history: newHistory, historyIndex: newHistory.length - 1 };
    });
  }, [updateActiveBoard]);

  const handleUndo = useCallback(() => {
    updateActiveBoard(board => {
      if (board.historyIndex > 0) {
        return { ...board, historyIndex: board.historyIndex - 1, elements: board.history[board.historyIndex - 1] };
      }
      return board;
    });
  }, [updateActiveBoard]);

  const handleRedo = useCallback(() => {
    updateActiveBoard(board => {
      if (board.historyIndex < board.history.length - 1) {
        return { ...board, historyIndex: board.historyIndex + 1, elements: board.history[board.historyIndex + 1] };
      }
      return board;
    });
  }, [updateActiveBoard]);

  const getDescendants = useCallback(function walk(elementId: string, allElements: Element[]): Element[] {
    const out: Element[] = [];
    const children = allElements.filter(el => el.parentId === elementId);
    for (const child of children) {
      out.push(child);
      if (child.type === 'group') {
        out.push(...walk(child.id, allElements));
      }
    }
    return out;
  }, []);

  return { updateActiveBoard, updateActiveBoardSilent, setElements, commitAction, handleUndo, handleRedo, getDescendants };
}
