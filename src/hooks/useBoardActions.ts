import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { touchLastSessionPending } from '@/services/boardsStorage';
import type { Board, Element } from '@/types';
import { commitBoardHistory, isHistoryV2, materializeElementsAt, toHistoryV2 } from '@/utils/history';

const MAX_HISTORY = 200;

let perfLastEnabledCheckAt = 0;
let perfEnabledCached = false;
let perfLogTimer: number | null = null;
let perfCounters = { update: 0, silentUpdate: 0, transientUpdate: 0, setElementsCommit: 0, setElementsSilent: 0, commitAction: 0, undo: 0, redo: 0 };
let perfLastSnapshot: { elements: number; historyLen: number; historyIndex: number; historyV: 1 | 2 } | null = null;
const isPerfEnabled = () => {
  if (typeof window === 'undefined') return false;
  const now = Date.now();
  if (now - perfLastEnabledCheckAt < 1000) return perfEnabledCached;
  perfLastEnabledCheckAt = now;
  try {
    perfEnabledCached = localStorage.getItem('BANANAPOD_DEBUG_PERF') === '1';
  } catch {
    perfEnabledCached = false;
  }
  return perfEnabledCached;
};
const schedulePerfLog = () => {
  if (!isPerfEnabled()) return;
  if (perfLogTimer != null) return;
  perfLogTimer = window.setTimeout(() => {
    perfLogTimer = null;
    const snapshot = { ...perfCounters, state: perfLastSnapshot };
    perfCounters = { update: 0, silentUpdate: 0, transientUpdate: 0, setElementsCommit: 0, setElementsSilent: 0, commitAction: 0, undo: 0, redo: 0 };
    perfLastSnapshot = null;
    console.log('[Perf][BoardActions]', snapshot);
  }, 1000);
};

let diffLastEnabledCheckAt = 0;
let diffEnabledCached = false;
const isHistoryDiffEnabled = () => {
  if (typeof window === 'undefined') return false;
  const now = Date.now();
  if (now - diffLastEnabledCheckAt < 1000) return diffEnabledCached;
  diffLastEnabledCheckAt = now;
  try {
    diffEnabledCached = localStorage.getItem('BANANAPOD_HISTORY_DIFF') === '1';
  } catch {
    diffEnabledCached = false;
  }
  return diffEnabledCached;
};

export function useBoardActions(
  activeBoardId: string,
  setBoards: Dispatch<SetStateAction<Board[]>>
) {
  const commitElementsToHistory = useCallback((board: Board, newElements: Element[]) => {
    const preferDiff = isHistoryDiffEnabled();
    const r = commitBoardHistory({
      history: board.history,
      historyIndex: board.historyIndex,
      prevElements: board.elements,
      nextElements: newElements,
      maxHistory: MAX_HISTORY,
      preferDiff,
    });
    return { ...board, elements: newElements, history: r.history, historyIndex: r.historyIndex };
  }, []);

  const updateActiveBoard = useCallback((updater: (board: Board) => Board) => {
    setBoards(prevBoards => {
      const now = Date.now();
      const next: Board[] = prevBoards.map(board => (board.id === activeBoardId ? { ...updater(board), updatedAt: now } : board));
      perfCounters.update += 1;
      const active = next.find(b => b.id === activeBoardId) || next[0];
      if (active) perfLastSnapshot = { elements: active.elements.length, historyLen: active.history.length, historyIndex: active.historyIndex, historyV: isHistoryV2(active.history) ? 2 : 1 };
      schedulePerfLog();
      touchLastSessionPending({ boards: next, activeBoardId });
      return next;
    });
  }, [activeBoardId, setBoards]);

  const updateActiveBoardSilent = useCallback((updater: (board: Board) => Board) => {
    setBoards(prevBoards => {
      const now = Date.now();
      const next: Board[] = prevBoards.map(board => (board.id === activeBoardId ? { ...updater(board), updatedAt: now } : board));
      perfCounters.silentUpdate += 1;
      const active = next.find(b => b.id === activeBoardId) || next[0];
      if (active) perfLastSnapshot = { elements: active.elements.length, historyLen: active.history.length, historyIndex: active.historyIndex, historyV: isHistoryV2(active.history) ? 2 : 1 };
      schedulePerfLog();
      touchLastSessionPending({ boards: next, activeBoardId });
      return next;
    });
  }, [activeBoardId, setBoards]);

  const updateActiveBoardTransient = useCallback((updater: (board: Board) => Board) => {
    setBoards(prevBoards => {
      const now = Date.now();
      const next: Board[] = prevBoards.map(board => (board.id === activeBoardId ? { ...updater(board), updatedAt: now } : board));
      perfCounters.transientUpdate += 1;
      const active = next.find(b => b.id === activeBoardId) || next[0];
      if (active) perfLastSnapshot = { elements: active.elements.length, historyLen: active.history.length, historyIndex: active.historyIndex, historyV: isHistoryV2(active.history) ? 2 : 1 };
      schedulePerfLog();
      return next;
    });
  }, [activeBoardId, setBoards]);

  const setElements = useCallback((updater: (prev: Element[]) => Element[], commit: boolean = true) => {
    if (commit) perfCounters.setElementsCommit += 1;
    else perfCounters.setElementsSilent += 1;
    schedulePerfLog();
    const apply = commit ? updateActiveBoard : updateActiveBoardTransient;
    apply(board => {
      const newElements = updater(board.elements);
      if (commit) {
        return commitElementsToHistory(board, newElements);
      } else {
        return { ...board, elements: newElements };
      }
    });
  }, [updateActiveBoard, updateActiveBoardTransient, commitElementsToHistory]);

  const commitAction = useCallback((updater: (prev: Element[]) => Element[]) => {
    perfCounters.commitAction += 1;
    schedulePerfLog();
    updateActiveBoard(board => {
      const newElements = updater(board.elements);
      return commitElementsToHistory(board, newElements);
    });
  }, [updateActiveBoard, commitElementsToHistory]);

  const handleUndo = useCallback(() => {
    perfCounters.undo += 1;
    schedulePerfLog();
    updateActiveBoard(board => {
      if (board.historyIndex <= 0) return board;
      const preferDiff = isHistoryDiffEnabled();
      const upgraded = preferDiff && !isHistoryV2(board.history) ? toHistoryV2(board.history, board.historyIndex) : null;
      const history = upgraded ? upgraded.history : board.history;
      const historyIndex = upgraded ? upgraded.historyIndex : board.historyIndex;
      const nextIndex = historyIndex - 1;
      const nextElements = materializeElementsAt(history, nextIndex);
      return { ...board, history, historyIndex: nextIndex, elements: nextElements };
    });
  }, [updateActiveBoard]);

  const handleRedo = useCallback(() => {
    perfCounters.redo += 1;
    schedulePerfLog();
    updateActiveBoard(board => {
      if (board.historyIndex >= board.history.length - 1) return board;
      const preferDiff = isHistoryDiffEnabled();
      const upgraded = preferDiff && !isHistoryV2(board.history) ? toHistoryV2(board.history, board.historyIndex) : null;
      const history = upgraded ? upgraded.history : board.history;
      const historyIndex = upgraded ? upgraded.historyIndex : board.historyIndex;
      const nextIndex = historyIndex + 1;
      const nextElements = materializeElementsAt(history, nextIndex);
      return { ...board, history, historyIndex: nextIndex, elements: nextElements };
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

  return { updateActiveBoard, updateActiveBoardSilent, updateActiveBoardTransient, setElements, commitAction, handleUndo, handleRedo, getDescendants };
}
