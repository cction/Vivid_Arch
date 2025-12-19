import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Element } from '@/types';
import { IconButton } from '../../ui';
import { LayerItem } from './LayerPanelItem';

interface LayerPanelProps {
    isOpen: boolean;
    onClose: () => void;
    elements: Element[];
    selectedElementIds: string[];
    onSelectElement: (id: string | null) => void;
    onToggleVisibility: (id: string) => void;
    onToggleLock: (id: string) => void;
    onRenameElement: (id: string, name: string) => void;
    onReorder: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
    onMergeLayers?: (mode: 'selected' | 'visible') => void;
}

const LayerPanelImpl: React.FC<LayerPanelProps> = ({ isOpen, onClose, elements, selectedElementIds, onSelectElement, onToggleVisibility, onToggleLock, onRenameElement, onReorder, onMergeLayers }) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const scrollRafRef = useRef<number | null>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);

    const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, id: string) => {
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('pod-drop-active');
    }, []);
    
    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('pod-drop-active');
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetId: string) => {
        e.preventDefault();
        e.currentTarget.classList.remove('pod-drop-active');
        const draggedId = e.dataTransfer.getData('text/plain');

        const rect = e.currentTarget.getBoundingClientRect();
        const position = e.clientY - rect.top > rect.height / 2 ? 'after' : 'before';

        if (draggedId && targetId && draggedId !== targetId) {
            onReorder(draggedId, targetId, position);
        }
    }, [onReorder]);

    const orderedElements = useMemo(() => [...elements].reverse(), [elements]);
    const childrenByParentId = useMemo(() => {
        const map = new Map<string, Element[]>();
        for (const el of orderedElements) {
            const key = el.parentId ?? '';
            const existing = map.get(key);
            if (existing) existing.push(el);
            else map.set(key, [el]);
        }
        return map;
    }, [orderedElements]);
    
    const selectedIdSet = useMemo(() => new Set(selectedElementIds), [selectedElementIds]);
    const flattenedRows = useMemo(() => {
        const out: { element: Element; level: number }[] = [];
        const walk = (parentId: string, level: number) => {
            const children = childrenByParentId.get(parentId) ?? [];
            for (const el of children) {
                out.push({ element: el, level });
                walk(el.id, level + 1);
            }
        };
        walk('', 0);
        return out;
    }, [childrenByParentId]);

    const handleScroll = useCallback(() => {
        if (scrollRafRef.current != null) return;
        scrollRafRef.current = window.requestAnimationFrame(() => {
            scrollRafRef.current = null;
            const el = listRef.current;
            if (!el) return;
            setScrollTop(el.scrollTop);
        });
    }, []);

    useEffect(() => {
        return () => {
            if (scrollRafRef.current != null) window.cancelAnimationFrame(scrollRafRef.current);
        };
    }, []);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        setViewportHeight(el.clientHeight);
        const ro = new ResizeObserver(() => {
            setViewportHeight(el.clientHeight);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [isOpen]);

    const rowHeight = 32;
    const overscan = 8;
    const totalRows = flattenedRows.length;
    const totalHeight = totalRows * rowHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endIndex = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
    const visibleRows = flattenedRows.slice(startIndex, endIndex);

    if (!isOpen) return null;

    return (
        <div 
            ref={panelRef}
            className="absolute top-4 right-4 z-20 flex flex-col sm:w-60 md:w-64 lg:w-72 max-w-[90vw] h-[calc(100vh-2rem)] pod-panel overflow-hidden"
        >
            <div className="pod-panel-header">
                <h3 className="text-base font-semibold text-[var(--text-heading)]">Layers</h3>
                <div className="flex items-center gap-[var(--space-2)]">
                    {onMergeLayers && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onMergeLayers(selectedElementIds.length > 0 ? 'selected' : 'visible'); }}
                            className="pod-primary-button"
                            title="合并选中图层（未选中则合并可见图层）"
                        >
                            合并图层
                        </button>
                    )}
                    <IconButton onClick={onClose} aria-label="Close Layers">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </IconButton>
                </div>
            </div>
            <div ref={listRef} onScroll={handleScroll} className="flex-grow p-2 overflow-y-auto">
                <div style={{ position: 'relative', height: totalHeight }}>
                    {visibleRows.map((row, localIndex) => {
                        const absoluteIndex = startIndex + localIndex;
                        return (
                            <div
                                key={row.element.id}
                                data-id={row.element.id}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, row.element.id)}
                                style={{ position: 'absolute', top: absoluteIndex * rowHeight, left: 0, right: 0, height: rowHeight }}
                            >
                                <LayerItem
                                    element={row.element}
                                    level={row.level}
                                    isSelected={selectedIdSet.has(row.element.id)}
                                    onSelect={() => onSelectElement(row.element.id)}
                                    onToggleLock={() => onToggleLock(row.element.id)}
                                    onToggleVisibility={() => onToggleVisibility(row.element.id)}
                                    onRename={(name) => onRenameElement(row.element.id, name)}
                                    onDragStart={(e) => handleDragStart(e, row.element.id)}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, row.element.id)}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

function areLayerPanelPropsEqual(prev: LayerPanelProps, next: LayerPanelProps) {
    if (prev.isOpen !== next.isOpen) return false;
    if (!prev.isOpen && !next.isOpen) return true;
    if (prev.onClose !== next.onClose) return false;
    if (prev.onSelectElement !== next.onSelectElement) return false;
    if (prev.onToggleVisibility !== next.onToggleVisibility) return false;
    if (prev.onToggleLock !== next.onToggleLock) return false;
    if (prev.onRenameElement !== next.onRenameElement) return false;
    if (prev.onReorder !== next.onReorder) return false;
    if (prev.onMergeLayers !== next.onMergeLayers) return false;

    if (prev.selectedElementIds.length !== next.selectedElementIds.length) return false;
    for (let i = 0; i < prev.selectedElementIds.length; i++) {
        if (prev.selectedElementIds[i] !== next.selectedElementIds[i]) return false;
    }

    if (prev.elements.length !== next.elements.length) return false;
    for (let i = 0; i < prev.elements.length; i++) {
        const a = prev.elements[i];
        const b = next.elements[i];
        if (a.id !== b.id) return false;
        if ((a.parentId ?? '') !== (b.parentId ?? '')) return false;
        if (a.type !== b.type) return false;
        if ((a.name ?? '') !== (b.name ?? '')) return false;
        if ((a.isVisible ?? true) !== (b.isVisible ?? true)) return false;
        if ((a.isLocked ?? false) !== (b.isLocked ?? false)) return false;
    }
    return true;
}

export const LayerPanel = React.memo(LayerPanelImpl, areLayerPanelPropsEqual);
