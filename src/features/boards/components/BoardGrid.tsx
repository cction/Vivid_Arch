import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Board } from '@/types';
import { MemoBoardItem } from './BoardItem';

type Props = {
  isOpen: boolean;
  boards: Board[];
  activeBoardId: string;
  onSwitchBoard: (id: string) => void;
  onRenameBoard: (id: string, name: string) => void;
  onDuplicateBoard: (id: string) => void;
  onDeleteBoard: (id: string) => void;
  generateBoardThumbnail: (elements: Board['elements']) => string;
};

export function BoardGrid({ isOpen, boards, activeBoardId, onSwitchBoard, onRenameBoard, onDuplicateBoard, onDeleteBoard, generateBoardThumbnail }: Props) {
  const [boardThumbs, setBoardThumbs] = useState<Record<string, string>>({});
  const boardsRef = useRef<Board[]>([]);
  useEffect(() => { boardsRef.current = boards; }, [boards]);

  const boardQueueRef = useRef<string[]>([]);
  const boardRunningRef = useRef(false);
  const boardWorkerRef = useRef<Worker | null>(null);
  const boardReqSeqRef = useRef(1);
  const boardReqMapRef = useRef<Record<number, string>>({});

  useEffect(() => {
    boardWorkerRef.current = new Worker(new URL('../../../workers/thumbWorker.ts', import.meta.url), { type: 'module' });
    const w = boardWorkerRef.current;
    w.onmessage = (e: MessageEvent) => {
      const { savedAt, thumbnail } = e.data as { savedAt: number; thumbnail: string };
      const boardId = boardReqMapRef.current[savedAt];
      if (boardId) {
        setBoardThumbs(prev => ({ ...prev, [boardId]: thumbnail }));
        delete boardReqMapRef.current[savedAt];
        if (boardRunningRef.current) {
          const nextBoard = boardQueueRef.current.shift();
          if (!nextBoard) { boardRunningRef.current = false; return; }
          const b = boardsRef.current.find(x => x.id === nextBoard);
          if (!b) { boardRunningRef.current = false; return; }
          const reqId = ++boardReqSeqRef.current;
          boardReqMapRef.current[reqId] = nextBoard;
          w.postMessage({ elements: b.elements, bgColor: b.canvasBackgroundColor, savedAt: reqId });
        }
      }
    };
    return () => { w.terminate(); };
  }, []);

  const boardsContainerRef = useRef<HTMLDivElement | null>(null);
  const boardElRefs = useRef<Record<string, HTMLElement>>({});
  const boardVisibleRef = useRef<Set<string>>(new Set());

  const scheduleBoardQueue = useCallback(() => {
    const candidates = boardsRef.current.filter(b => boardVisibleRef.current.has(b.id) && !boardThumbs[b.id]).map(b => b.id);
    if (candidates.length === 0) return;
    boardQueueRef.current = Array.from(new Set([...boardQueueRef.current, ...candidates]));
    if (boardRunningRef.current) return;
    boardRunningRef.current = true;
    const w = boardWorkerRef.current;
    const nextId = boardQueueRef.current.shift();
    if (!nextId || !w) { boardRunningRef.current = false; return; }
    const b = boardsRef.current.find(x => x.id === nextId);
    if (!b) { boardRunningRef.current = false; return; }
    const reqId = ++boardReqSeqRef.current;
    boardReqMapRef.current[reqId] = nextId;
    w.postMessage({ elements: b.elements, bgColor: b.canvasBackgroundColor, savedAt: reqId });
  }, [boardThumbs]);

  useEffect(() => {
    if (!isOpen) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const el = entry.target as HTMLElement;
        const id = String(el.dataset.boardid || '');
        if (!id) return;
        if (entry.isIntersecting) boardVisibleRef.current.add(id); else boardVisibleRef.current.delete(id);
      });
      scheduleBoardQueue();
    }, { root: boardsContainerRef.current || undefined, threshold: 0.1 });
    for (const el of Object.values(boardElRefs.current) as HTMLElement[]) { obs.observe(el); }
    return () => { obs.disconnect(); };
  }, [isOpen, boards, scheduleBoardQueue]);

  useEffect(() => {
    if (!isOpen) return;
    const firstSix = boards.slice(0, 6).map(b => b.id);
    boardQueueRef.current = Array.from(new Set([...boardQueueRef.current, ...firstSix]));
    scheduleBoardQueue();
  }, [isOpen, boards, scheduleBoardQueue]);

  const activeThumbTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    const id = activeBoardId;
    if (!id) return;
    if (!boardVisibleRef.current.has(id)) return;
    if (activeThumbTimerRef.current != null) {
      clearTimeout(activeThumbTimerRef.current);
      activeThumbTimerRef.current = null;
    }
    activeThumbTimerRef.current = window.setTimeout(() => {
      boardQueueRef.current = Array.from(new Set([...boardQueueRef.current, id]));
      scheduleBoardQueue();
    }, 300);
    return () => {
      if (activeThumbTimerRef.current != null) {
        clearTimeout(activeThumbTimerRef.current);
        activeThumbTimerRef.current = null;
      }
    };
  }, [isOpen, boards, activeBoardId, scheduleBoardQueue]);

  return (
    <div className="grid grid-cols-2 gap-2 content-start mb-3" ref={boardsContainerRef}>
      {boards.map(board => (
        <MemoBoardItem
          key={board.id}
          ref={el => { if (el) { boardElRefs.current[board.id] = el; } else { delete boardElRefs.current[board.id]; } }}
          dataBoardId={board.id}
          board={board}
          isActive={board.id === activeBoardId}
          thumbnail={boardThumbs[board.id] || generateBoardThumbnail(board.elements)}
          onClick={() => onSwitchBoard(board.id)}
          onRename={(name) => onRenameBoard(board.id, name)}
          onDuplicate={() => onDuplicateBoard(board.id)}
          onDelete={() => onDeleteBoard(board.id)}
        />
      ))}
    </div>
  );
}

