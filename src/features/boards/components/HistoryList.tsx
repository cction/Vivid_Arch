import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { HistoryBoardSnapshot } from '@/types';
import { getHistoryBoards, updateHistoryThumbnail } from '../../../services/boardsStorage';

type Props = {
  isOpen: boolean;
  generateBoardThumbnail: (elements: HistoryBoardSnapshot['elements']) => string;
  onImportHistoryBoard?: (snapshot: HistoryBoardSnapshot) => void;
};

export function HistoryList({ isOpen, generateBoardThumbnail, onImportHistoryBoard }: Props) {
  const [history, setHistory] = useState<HistoryBoardSnapshot[]>([]);
  useEffect(() => { if (!isOpen) return; getHistoryBoards().then(setHistory).catch(() => setHistory([])); }, [isOpen]);

  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const queueRef = useRef<number[]>([]);
  const runningRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const historyRef = useRef<HistoryBoardSnapshot[]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../../../workers/thumbWorker.ts', import.meta.url), { type: 'module' });
    const w = workerRef.current;
    w.onmessage = (e: MessageEvent) => {
      const { savedAt, thumbnail } = e.data as { savedAt: number; thumbnail: string };
      setThumbs(prev => ({ ...prev, [savedAt]: thumbnail }));
      updateHistoryThumbnail(savedAt, thumbnail).finally(() => {
        if (runningRef.current) {
          const next = queueRef.current.shift();
          if (next == null) { runningRef.current = false; return; }
          const h = historyRef.current.find(x => x.savedAt === next);
          if (!h) { w.postMessage({ elements: [], bgColor: '#000', savedAt: next }); return; }
          w.postMessage({ elements: h.elements, bgColor: h.canvasBackgroundColor, savedAt: h.savedAt });
        }
      });
    };
    return () => { w.terminate(); };
  }, []);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const elRefs = useRef<Record<number, HTMLElement>>({});
  const visibleRef = useRef<Set<number>>(new Set());

  const scheduleQueue = useCallback(() => {
    const candidates = history.filter(h => visibleRef.current.has(h.savedAt) && !h.thumbnail && !thumbs[h.savedAt]).map(h => h.savedAt);
    if (candidates.length === 0) return;
    queueRef.current = Array.from(new Set([...queueRef.current, ...candidates]));
    if (runningRef.current) return;
    runningRef.current = true;
    const w = workerRef.current;
    const nextId = queueRef.current.shift();
    if (nextId == null || !w) { runningRef.current = false; return; }
    const h = history.find(x => x.savedAt === nextId);
    if (!h) { runningRef.current = false; return; }
    w.postMessage({ elements: h.elements, bgColor: h.canvasBackgroundColor, savedAt: h.savedAt });
  }, [history, thumbs]);

  useEffect(() => {
    if (!isOpen) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const el = entry.target as HTMLElement;
        const id = Number(el.dataset.savedat);
        if (entry.isIntersecting) visibleRef.current.add(id); else visibleRef.current.delete(id);
      });
      scheduleQueue();
    }, { root: containerRef.current || undefined, threshold: 0.1 });
    for (const el of Object.values(elRefs.current) as HTMLElement[]) { obs.observe(el); }
    return () => { obs.disconnect(); };
  }, [isOpen, history, scheduleQueue]);

  return (
    <div>
      <h4 className="text-sm mb-2 font-semibold text-[var(--text-heading)]">历史图版（最多5个）</h4>
      <div ref={containerRef} className="grid grid-cols-2 gap-2 content-start overflow-y-auto">
        {history.slice(0,5).map(h => {
          const pad = (x: number) => String(x).padStart(2, '0');
          const d = new Date(h.savedAt);
          const code = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
          return (
            <div
              key={h.savedAt}
              className="group relative p-2 pod-list-item cursor-pointer"
              data-savedat={h.savedAt}
              ref={el => { if (el) { elRefs.current[h.savedAt] = el; } else { delete elRefs.current[h.savedAt]; } }}
              onClick={() => onImportHistoryBoard && onImportHistoryBoard(h)}
            >
              <div className="aspect-[3/2] w-full rounded-md mb-2 overflow-hidden border">
                <img src={h.thumbnail || thumbs[h.savedAt] || generateBoardThumbnail(h.elements)} alt={`${code} history`} className="w-full h-full object-cover" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm truncate">{code}</span>
              </div>
              <div className="text-[10px] text-gray-400">{d.toLocaleString()}</div>
            </div>
          );
        })}
        {history.length === 0 && (
          <div className="text-xs text-[var(--text-primary)]">暂无历史图版</div>
        )}
      </div>
    </div>
  );
}

