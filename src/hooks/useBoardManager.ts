import { useCallback } from 'react';
import { touchLastSessionPending } from '@/services/boardsStorage';
import type { Board, Element } from '@/types';
import { getElementBounds, computeImageClip } from '@/utils/canvas';
import type { ImageElement } from '@/types';

type Deps = {
  boards: Board[];
  activeBoardId: string;
  setBoards: (updater: (prev: Board[]) => Board[]) => void;
  setActiveBoardId: (id: string) => void;
  updateActiveBoard: (updater: (board: Board) => Board) => void;
  generateId: () => string;
};

export function useBoardManager({ boards, activeBoardId, setBoards, setActiveBoardId, updateActiveBoard, generateId }: Deps) {
  const createNewBoard = useCallback((name: string): Board => {
    const id = generateId();
    return { id, name, elements: [], history: [[]], historyIndex: 0, panOffset: { x: 0, y: 0 }, zoom: 1, canvasBackgroundColor: '#0F0D13', updatedAt: Date.now() };
  }, [generateId]);

  const handleAddBoard = useCallback(() => {
    const newBoard = createNewBoard(`Board ${boards.length + 1}`);
    setBoards(prev => { const next = [...prev, newBoard]; touchLastSessionPending({ boards: next, activeBoardId: newBoard.id }); return next; });
    setActiveBoardId(newBoard.id);
  }, [boards.length, createNewBoard, setBoards, setActiveBoardId]);

  const handleDuplicateBoard = useCallback((boardId: string) => {
    const boardToDuplicate = boards.find(b => b.id === boardId);
    if (!boardToDuplicate) return;
    const newBoard: Board = { ...boardToDuplicate, id: generateId(), name: `${boardToDuplicate.name} Copy`, history: [boardToDuplicate.elements], historyIndex: 0, updatedAt: Date.now() };
    setBoards(prev => { const next = [...prev, newBoard]; touchLastSessionPending({ boards: next, activeBoardId: newBoard.id }); return next; });
    setActiveBoardId(newBoard.id);
  }, [boards, generateId, setBoards, setActiveBoardId]);

  const handleDeleteBoard = useCallback((boardId: string) => {
    setBoards(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(b => b.id !== boardId);
      const newActiveId = activeBoardId === boardId && next.length > 0 ? next[0].id : activeBoardId;
      if (newActiveId !== activeBoardId) setActiveBoardId(newActiveId);
      touchLastSessionPending({ boards: next, activeBoardId: newActiveId });
      return next;
    });
  }, [activeBoardId, setBoards, setActiveBoardId]);

  const handleRenameBoard = useCallback((boardId: string, name: string) => {
    const now = Date.now();
    setBoards(prev => { const next = prev.map(b => (b.id === boardId ? { ...b, name, updatedAt: now } : b)); touchLastSessionPending({ boards: next, activeBoardId }); return next; });
  }, [activeBoardId, setBoards]);

  const handleSwitchBoard = useCallback((id: string) => {
    setActiveBoardId(id);
    touchLastSessionPending({ boards, activeBoardId: id });
  }, [boards, setActiveBoardId]);

  const handleCanvasBackgroundColorChange = useCallback((color: string) => {
    updateActiveBoard(b => ({ ...b, canvasBackgroundColor: color }));
  }, [updateActiveBoard]);

  const generateBoardThumbnail = useCallback((elements: Element[], bgColor: string): string => {
    const THUMB_WIDTH = 120;
    const THUMB_HEIGHT = 80;
    if (elements.length === 0) { const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}"><rect width="100%" height="100%" fill="${bgColor}" /></svg>`; return `data:image/svg+xml;base64,${btoa(emptySvg)}`; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => { const bounds = getElementBounds(el, elements); minX = Math.min(minX, bounds.x); minY = Math.min(minY, bounds.y); maxX = Math.max(maxX, bounds.x + bounds.width); maxY = Math.max(maxY, bounds.y + bounds.height); });
    const contentWidth = maxX - minX; const contentHeight = maxY - minY;
    if (contentWidth <= 0 || contentHeight <= 0) { const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}"><rect width="100%" height="100%" fill="${bgColor}" /></svg>`; return `data:image/svg+xml;base64,${btoa(emptySvg)}`; }
    const scale = Math.min(THUMB_WIDTH / contentWidth, THUMB_HEIGHT / contentHeight) * 0.9;
    const dx = (THUMB_WIDTH - contentWidth * scale) / 2 - minX * scale; const dy = (THUMB_HEIGHT - contentHeight * scale) / 2 - minY * scale;
    const clipDefs = elements.filter(el => el.type === 'image').map(el => {
      const clip = computeImageClip(el as ImageElement, 'thumb_clip_');
      return clip.r > 0 ? `<clipPath id="${clip.id}"><rect x="${clip.rect.x}" y="${clip.rect.y}" width="${clip.rect.width}" height="${clip.rect.height}" rx="${clip.r}" ry="${clip.r}" /></clipPath>` : '';
    }).join('');
    const svgContent = elements.map(el => {
      if (el.type === 'path') { const pathData = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '); return `<path d="${pathData}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${el.strokeOpacity || 1}" />`; }
      if (el.type === 'image') { const clip = computeImageClip(el as ImageElement, 'thumb_clip_'); const cp = clip.r > 0 ? ` clip-path="url(#${clip.id})"` : ''; return `<image href="${el.href}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" opacity="${typeof el.opacity === 'number' ? el.opacity / 100 : 1}"${cp} />`; }
      return '';
    }).join('');
    const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}"><rect width="100%" height="100%" fill="${bgColor}" /><defs>${clipDefs}</defs><g transform="translate(${dx} ${dy}) scale(${scale})">${svgContent}</g></svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(fullSvg)))}`;
  }, []);

  return { handleAddBoard, handleDuplicateBoard, handleDeleteBoard, handleRenameBoard, handleSwitchBoard, handleCanvasBackgroundColorChange, generateBoardThumbnail };
}
