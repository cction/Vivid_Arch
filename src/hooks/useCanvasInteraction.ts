import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { Board, Element, ImageElement, ShapeElement, TextElement, VideoElement, PathElement, ArrowElement, LineElement, Point, Tool, WheelAction } from '@/types';
import { getElementBounds } from '@/utils/canvas';
import { queryElementsInRect, queryElementsNearPoint } from '@/utils/spatialIndex';

type Rect = { x: number; y: number; width: number; height: number };
type Guide = { type: 'v' | 'h'; position: number; start: number; end: number };
const SNAP_THRESHOLD = 5;

const getPolygonBounds = (polygon: Point[]): Rect => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const isPointInPolygon = (point: Point, polygon: Point[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

type ResizeStartInfo = { originalElement: ImageElement | ShapeElement | TextElement | VideoElement; startCanvasPoint: Point; handle: string; shiftKey: boolean } | null;
type CropStartInfo = { originalCropBox: Rect; startCanvasPoint: Point } | null;

type Deps = {
  svgRef: MutableRefObject<SVGSVGElement | null>;
  elements: Element[];
  elementsRef: MutableRefObject<Element[]>;
  activeTool: Tool;
  setActiveTool: Dispatch<SetStateAction<Tool>>;
  drawingOptions: { strokeColor: string; strokeWidth: number };
  selectedElementIds: string[];
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  setEditingElement: Dispatch<SetStateAction<{ id: string; text: string } | null>>;
  editingElement: { id: string; text: string } | null;
  setElements: (updater: (prev: Element[]) => Element[], commit?: boolean) => void;
  commitAction: (updater: (prev: Element[]) => Element[]) => void;
  getDescendants: (id: string, all: Element[]) => Element[];
  setSelectionBox: Dispatch<SetStateAction<Rect | null>>;
  selectionBox: Rect | null;
  lassoPath: Point[] | null;
  setLassoPath: Dispatch<SetStateAction<Point[] | null>>;
  resizeStartInfo: MutableRefObject<ResizeStartInfo>;
  cropStartInfo: MutableRefObject<CropStartInfo>;
  currentDrawingElementId: MutableRefObject<string | null>;
  interactionMode: MutableRefObject<string | null>;
  startPoint: MutableRefObject<Point>;
  dragStartElementPositions: MutableRefObject<Map<string, { x: number; y: number } | Point[]>>;
  setInteractionMode: (v: string | null) => void;
  setStartPoint: (p: Point) => void;
  setResizeStartInfo: (info: ResizeStartInfo) => void;
  setCropStartInfo: (info: CropStartInfo) => void;
  setCurrentDrawingElementId: (id: string | null) => void;
  setDragStartElementPositions: (map: Map<string, { x: number; y: number } | Point[]>) => void;
  clearDragStartElementPositions: () => void;
  setAlignmentGuides: Dispatch<SetStateAction<Guide[]>>;
  updateActiveBoardSilent: (updater: (board: Board) => Board) => void;
  panRafRef: MutableRefObject<number | null>;
  panLastPointRef: MutableRefObject<Point | null>;
  wheelRafRef: MutableRefObject<number | null>;
  wheelLastEventRef: MutableRefObject<{ clientX: number; clientY: number; deltaX: number; deltaY: number; ctrlKey: boolean } | null>;
  setPanRaf: (v: number | null) => void;
  setPanLastPoint: (p: Point | null) => void;
  setWheelRaf: (v: number | null) => void;
  setWheelLastEvent: (ev: { clientX: number; clientY: number; deltaX: number; deltaY: number; ctrlKey: boolean } | null) => void;
  croppingState: { elementId: string; originalElement: ImageElement; cropBox: Rect } | null;
  setCroppingState: Dispatch<SetStateAction<{ elementId: string; originalElement: ImageElement; cropBox: Rect } | null>>;
  cropAspectRatio: string | null;
  wheelAction: WheelAction;
  zoom: number;
  panOffset: Point;
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; elementId: string | null } | null>>;
  contextMenu: { x: number; y: number; elementId: string | null } | null;
  generateId: () => string;
};

function parseRatio(r: string | null): number | null {
  if (!r) return null;
  const parts = r.split(':');
  if (parts.length !== 2) return null;
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (!a || !b) return null;
  return a / b;
}

function uniqueSorted(values: number[]): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || out[out.length - 1] !== v) out.push(v);
  }
  return out;
}

function findNearestValue(sorted: number[], target: number): number | null {
  if (sorted.length === 0) return null;
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const right = sorted[lo];
  if (lo === 0) return right;
  const left = sorted[lo - 1];
  return Math.abs(left - target) <= Math.abs(right - target) ? left : right;
}

export function useCanvasInteraction(deps: Deps) {
  const {
    svgRef, elements, elementsRef, activeTool, setActiveTool, drawingOptions, selectedElementIds, setSelectedElementIds,
    setEditingElement, editingElement, setElements, commitAction, getDescendants, setSelectionBox, selectionBox, lassoPath, setLassoPath,
    resizeStartInfo, cropStartInfo, currentDrawingElementId, interactionMode, startPoint, dragStartElementPositions,
    setInteractionMode, setStartPoint, setResizeStartInfo, setCropStartInfo, setCurrentDrawingElementId, setDragStartElementPositions, clearDragStartElementPositions,
    setAlignmentGuides, updateActiveBoardSilent, panRafRef, panLastPointRef, wheelRafRef, wheelLastEventRef, setPanRaf, setPanLastPoint, setWheelRaf, setWheelLastEvent,
    croppingState, setCroppingState, cropAspectRatio, wheelAction, zoom, panOffset, setContextMenu, contextMenu, generateId,
  } = deps;

  const elementsUpdateRafRef = useRef<number | null>(null);
  const pendingElementsUpdaterRef = useRef<((prev: Element[]) => Element[]) | null>(null);
  const guidesUpdateRafRef = useRef<number | null>(null);
  const pendingGuidesRef = useRef<Guide[] | null>(null);
  const dragStaticSnapLinesRef = useRef<{ v: number[]; h: number[] } | null>(null);

  const scheduleElementsUpdate = useCallback((updater: (prev: Element[]) => Element[]) => {
    const pending = pendingElementsUpdaterRef.current;
    pendingElementsUpdaterRef.current = pending ? (prev => updater(pending(prev))) : updater;
    if (elementsUpdateRafRef.current != null) return;
    elementsUpdateRafRef.current = requestAnimationFrame(() => {
      elementsUpdateRafRef.current = null;
      const u = pendingElementsUpdaterRef.current;
      pendingElementsUpdaterRef.current = null;
      if (!u) return;
      setElements(u, false);
    });
  }, [setElements]);

  const takePendingElementsUpdater = useCallback(() => {
    if (elementsUpdateRafRef.current != null) {
      cancelAnimationFrame(elementsUpdateRafRef.current);
      elementsUpdateRafRef.current = null;
    }
    const u = pendingElementsUpdaterRef.current;
    pendingElementsUpdaterRef.current = null;
    return u;
  }, []);

  const scheduleGuidesUpdate = useCallback((guides: Guide[]) => {
    pendingGuidesRef.current = guides;
    if (guidesUpdateRafRef.current != null) return;
    guidesUpdateRafRef.current = requestAnimationFrame(() => {
      guidesUpdateRafRef.current = null;
      const g = pendingGuidesRef.current;
      pendingGuidesRef.current = null;
      if (!g) return;
      setAlignmentGuides(g);
    });
  }, [setAlignmentGuides]);

  const flushGuidesUpdate = useCallback(() => {
    if (guidesUpdateRafRef.current != null) {
      cancelAnimationFrame(guidesUpdateRafRef.current);
      guidesUpdateRafRef.current = null;
    }
    const g = pendingGuidesRef.current;
    pendingGuidesRef.current = null;
    if (!g) return;
    setAlignmentGuides(g);
  }, [setAlignmentGuides]);

  useEffect(() => {
    return () => {
      if (elementsUpdateRafRef.current != null) {
        cancelAnimationFrame(elementsUpdateRafRef.current);
        elementsUpdateRafRef.current = null;
      }
      pendingElementsUpdaterRef.current = null;
      if (guidesUpdateRafRef.current != null) {
        cancelAnimationFrame(guidesUpdateRafRef.current);
        guidesUpdateRafRef.current = null;
      }
      pendingGuidesRef.current = null;
    };
  }, []);

  const getCanvasPoint = useCallback((screenX: number, screenY: number): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svgBounds = svgRef.current.getBoundingClientRect();
    const xOnSvg = screenX - svgBounds.left;
    const yOnSvg = screenY - svgBounds.top;
    return { x: (xOnSvg - panOffset.x) / zoom, y: (yOnSvg - panOffset.y) / zoom };
  }, [svgRef, panOffset, zoom]);

  const getSelectableElement = useCallback((elementId: string, allElements: Element[]): Element | null => {
    const element = allElements.find(el => el.id === elementId);
    if (!element || element.isLocked === true || element.isVisible === false) return null;
    let current = element;
    while (current.parentId) {
      const parent = allElements.find(el => el.id === current.parentId);
      if (!parent) return current;
      if (parent.isLocked) return null;
      current = parent;
    }
    return current;
  }, []);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (editingElement) return;
    if (contextMenu) setContextMenu(null);
    if (e.button === 1) { setInteractionMode('pan'); setStartPoint({ x: e.clientX, y: e.clientY }); e.preventDefault(); return; }
    setStartPoint({ x: e.clientX, y: e.clientY });
    const canvasStartPoint = getCanvasPoint(e.clientX, e.clientY);
    const target = e.target as SVGElement;
    const handleName = target.getAttribute('data-handle');

    if (croppingState) {
      if (handleName) { setInteractionMode(`crop-${handleName}`); setCropStartInfo({ originalCropBox: { ...croppingState.cropBox }, startCanvasPoint: canvasStartPoint }); }
      else {
        const { cropBox } = croppingState;
        if (canvasStartPoint.x >= cropBox.x && canvasStartPoint.x <= cropBox.x + cropBox.width && canvasStartPoint.y >= cropBox.y && canvasStartPoint.y <= cropBox.y + cropBox.height) {
          setInteractionMode('crop-move'); setCropStartInfo({ originalCropBox: { ...croppingState.cropBox }, startCanvasPoint: canvasStartPoint });
        }
      }
      return;
    }

    if (activeTool === 'text') {
      const newText: TextElement = { id: generateId(), type: 'text', name: 'Text', x: canvasStartPoint.x, y: canvasStartPoint.y, width: 150, height: 40, text: 'Text', fontSize: 24, fontColor: drawingOptions.strokeColor };
      setElements(prev => [...prev, newText]);
      setSelectedElementIds([newText.id]);
      setEditingElement({ id: newText.id, text: newText.text });
      setActiveTool('select');
      return;
    }
    if (activeTool === 'pan') { setInteractionMode('pan'); return; }
    if (handleName && activeTool === 'select' && selectedElementIds.length === 1) {
      setInteractionMode(`resize-${handleName}`);
      const element = elements.find(el => el.id === selectedElementIds[0]) as ImageElement | ShapeElement | TextElement | VideoElement;
      setResizeStartInfo({ originalElement: { ...element }, startCanvasPoint: canvasStartPoint, handle: handleName, shiftKey: e.shiftKey });
      return;
    }
    if (activeTool === 'draw' || activeTool === 'highlighter') {
      setInteractionMode('draw');
      const newPath: PathElement = { id: generateId(), type: 'path', name: 'Path', points: [canvasStartPoint], strokeColor: drawingOptions.strokeColor, strokeWidth: drawingOptions.strokeWidth, strokeOpacity: activeTool === 'highlighter' ? 0.5 : 1, x: 0, y: 0 };
      setCurrentDrawingElementId(newPath.id);
      setElements(prev => [...prev, newPath], false);
    } else if (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'triangle') {
      setInteractionMode('drawShape');
      const newShape: ShapeElement = { id: generateId(), type: 'shape', name: activeTool.charAt(0).toUpperCase() + activeTool.slice(1), shapeType: activeTool, x: canvasStartPoint.x, y: canvasStartPoint.y, width: 0, height: 0, strokeColor: drawingOptions.strokeColor, strokeWidth: drawingOptions.strokeWidth, fillColor: 'transparent' };
      setCurrentDrawingElementId(newShape.id);
      setElements(prev => [...prev, newShape], false);
    } else if (activeTool === 'arrow') {
      setInteractionMode('drawArrow');
      const newArrow: ArrowElement = { id: generateId(), type: 'arrow', name: 'Arrow', x: canvasStartPoint.x, y: canvasStartPoint.y, points: [canvasStartPoint, canvasStartPoint], strokeColor: drawingOptions.strokeColor, strokeWidth: drawingOptions.strokeWidth };
      setCurrentDrawingElementId(newArrow.id);
      setElements(prev => [...prev, newArrow], false);
    } else if (activeTool === 'line') {
      setInteractionMode('drawLine');
      const newLine: LineElement = { id: generateId(), type: 'line', name: 'Line', x: canvasStartPoint.x, y: canvasStartPoint.y, points: [canvasStartPoint, canvasStartPoint], strokeColor: drawingOptions.strokeColor, strokeWidth: drawingOptions.strokeWidth };
      setCurrentDrawingElementId(newLine.id);
      setElements(prev => [...prev, newLine], false);
    } else if (activeTool === 'erase') {
      setInteractionMode('erase');
    } else if (activeTool === 'lasso') {
      setInteractionMode('lasso');
      setLassoPath([canvasStartPoint]);
    } else if (activeTool === 'select') {
      const clickedElementId = target.closest('[data-id]')?.getAttribute('data-id');
      const selectableElement = clickedElementId ? getSelectableElement(clickedElementId, elementsRef.current) : null;
      const selectableElementId = selectableElement?.id;
      if (selectableElementId) {
        if (e.detail === 2 && elements.find(el => el.id === selectableElementId)?.type === 'text') { const textEl = elements.find(el => el.id === selectableElementId) as TextElement; setEditingElement({ id: textEl.id, text: textEl.text }); return; }
        if (!e.shiftKey && !selectedElementIds.includes(selectableElementId)) { setSelectedElementIds([selectableElementId]); }
        else if (e.shiftKey) { setSelectedElementIds(prev => (prev.includes(selectableElementId) ? prev.filter(id => id !== selectableElementId) : [...prev, selectableElementId])); }
        setInteractionMode('dragElements');
        const idsToDrag = new Set<string>();
        if (selectedElementIds.length > 1 && selectedElementIds.includes(selectableElement.id)) {
          selectedElementIds.forEach(id => { const el = elementsRef.current.find(e2 => e2.id === id); if (!el) return; if (el.type === 'group') { getDescendants(el.id, elementsRef.current).forEach(desc => idsToDrag.add(desc.id)); } else { idsToDrag.add(el.id); } });
        } else {
          if (selectableElement.type === 'group') { getDescendants(selectableElement.id, elementsRef.current).forEach(desc => idsToDrag.add(desc.id)); } else { idsToDrag.add(selectableElement.id); }
        }
        const initialPositions = new Map<string, { x: number; y: number } | Point[]>();
        elementsRef.current.forEach(el => { if (idsToDrag.has(el.id)) { if (el.type !== 'path' && el.type !== 'arrow' && el.type !== 'line') { initialPositions.set(el.id, { x: el.x, y: el.y }); } else { initialPositions.set(el.id, el.points); } } });
        setDragStartElementPositions(initialPositions);

        const snapV: number[] = [];
        const snapH: number[] = [];
        const getSnapPoints = (bounds: Rect) => ({ v: [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width], h: [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height] });
        elementsRef.current.forEach(el => {
          if (idsToDrag.has(el.id)) return;
          const bounds = getElementBounds(el, elementsRef.current);
          const pts = getSnapPoints(bounds);
          snapV.push(...pts.v);
          snapH.push(...pts.h);
        });
        dragStaticSnapLinesRef.current = { v: uniqueSorted(snapV), h: uniqueSorted(snapH) };
      } else {
        setSelectedElementIds([]);
        setInteractionMode('selectBox');
        setSelectionBox({ x: canvasStartPoint.x, y: canvasStartPoint.y, width: 0, height: 0 });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactionMode.current) return;
    const point = getCanvasPoint(e.clientX, e.clientY);
    const startCanvasPoint = getCanvasPoint(startPoint.current.x, startPoint.current.y);
    if (interactionMode.current === 'erase') {
      const eraseRadius = drawingOptions.strokeWidth / zoom;
      const idsToDelete = new Set<string>();
      const candidates = queryElementsNearPoint(elementsRef.current, point, eraseRadius);
      const r2 = eraseRadius * eraseRadius;
      candidates.forEach(el => {
        if (el.type !== 'path') return;
        for (let i = 0; i < el.points.length - 1; i++) {
          const dx = point.x - el.points[i].x;
          const dy = point.y - el.points[i].y;
          if ((dx * dx + dy * dy) < r2) {
            idsToDelete.add(el.id);
            return;
          }
        }
      });
      if (idsToDelete.size > 0) { scheduleElementsUpdate(prev => prev.filter(el => !idsToDelete.has(el.id))); }
      return;
    }
    if (interactionMode.current.startsWith('resize-')) {
      if (!resizeStartInfo.current) return;
      const { originalElement, handle, startCanvasPoint: resizeStartPoint, shiftKey } = resizeStartInfo.current;
      let { x, y, width, height } = originalElement;
      const aspectRatio = originalElement.width / originalElement.height;
      const dx = point.x - resizeStartPoint.x;
      const dy = point.y - resizeStartPoint.y;
      if (handle.includes('r')) { width = originalElement.width + dx; }
      if (handle.includes('l')) { width = originalElement.width - dx; x = originalElement.x + dx; }
      if (handle.includes('b')) { height = originalElement.height + dy; }
      if (handle.includes('t')) { height = originalElement.height - dy; y = originalElement.y + dy; }
      if (originalElement.type !== 'text' && !shiftKey) {
        if (handle.includes('r') || handle.includes('l')) { height = width / aspectRatio; if (handle.includes('t')) y = (originalElement.y + originalElement.height) - height; }
        else { width = height * aspectRatio; if (handle.includes('l')) x = (originalElement.x + originalElement.width) - width; }
      }
      if (width < 1) { width = 1; x = originalElement.x + originalElement.width - 1; }
      if (height < 1) { height = 1; y = originalElement.y + originalElement.height - 1; }
      scheduleElementsUpdate(prev => prev.map(el => (el.id === originalElement.id ? { ...el, x, y, width, height } : el)));
      return;
    }
    if (interactionMode.current === 'crop-move') {
      if (!croppingState || !cropStartInfo.current) return;
      const { originalCropBox, startCanvasPoint: cropStartPoint } = cropStartInfo.current;
      const { originalElement } = croppingState;
      const dx = point.x - cropStartPoint.x;
      const dy = point.y - cropStartPoint.y;
      let x = originalCropBox.x + dx; let y = originalCropBox.y + dy; const width = originalCropBox.width; const height = originalCropBox.height;
      if (x < originalElement.x) x = originalElement.x;
      if (y < originalElement.y) y = originalElement.y;
      if (x + width > originalElement.x + originalElement.width) x = originalElement.x + originalElement.width - width;
      if (y + height > originalElement.y + originalElement.height) y = originalElement.y + originalElement.height - height;
      setCroppingState(prev => (prev ? { ...prev, cropBox: { x, y, width, height } } : null));
      return;
    }
    if (interactionMode.current.startsWith('crop-')) {
      if (!croppingState || !cropStartInfo.current) return;
      const handle = interactionMode.current.split('-')[1];
      const { originalCropBox, startCanvasPoint: cropStartPoint } = cropStartInfo.current;
      let { x, y, width, height } = { ...originalCropBox };
      const { originalElement } = croppingState;
      const dx = point.x - cropStartPoint.x;
      const dy = point.y - cropStartPoint.y;
      if (handle.includes('r')) { width = originalCropBox.width + dx; }
      if (handle.includes('l')) { width = originalCropBox.width - dx; x = originalCropBox.x + dx; }
      if (handle.includes('b')) { height = originalCropBox.height + dy; }
      if (handle.includes('t')) { height = originalCropBox.height - dy; y = originalCropBox.y + dy; }
      if (x < originalElement.x) { width += x - originalElement.x; x = originalElement.x; }
      if (y < originalElement.y) { height += y - originalElement.y; y = originalElement.y; }
      if (x + width > originalElement.x + originalElement.width) { width = originalElement.x + originalElement.width - x; }
      if (y + height > originalElement.y + originalElement.height) { height = originalElement.y + originalElement.height - y; }
      const arVal = parseRatio(cropAspectRatio);
      if (arVal) {
        if (handle.includes('r') || handle.includes('l')) { const nh = Math.max(1, Math.round(width / arVal)); height = nh; if (handle.includes('t')) y = (originalCropBox.y + originalCropBox.height) - height; }
        else { const nw = Math.max(1, Math.round(height * arVal)); width = nw; if (handle.includes('l')) x = (originalCropBox.x + originalCropBox.width) - width; }
        if (x < originalElement.x) x = originalElement.x;
        if (y < originalElement.y) y = originalElement.y;
        if (x + width > originalElement.x + originalElement.width) { const maxW = (originalElement.x + originalElement.width) - x; width = Math.max(1, Math.min(width, maxW)); height = Math.max(1, Math.round(width / arVal)); if (handle.includes('t')) y = (originalCropBox.y + originalCropBox.height) - height; if (handle.includes('l')) x = (originalCropBox.x + originalCropBox.width) - width; }
        if (y + height > originalElement.y + originalElement.height) { const maxH = (originalElement.y + originalElement.height) - y; height = Math.max(1, Math.min(height, maxH)); width = Math.max(1, Math.round(height * arVal)); if (handle.includes('t')) y = (originalCropBox.y + originalCropBox.height) - height; if (handle.includes('l')) x = (originalCropBox.x + originalCropBox.width) - width; }
      }
      if (width < 1) { width = 1; if (handle.includes('l')) { x = originalCropBox.x + originalCropBox.width - 1; } }
      if (height < 1) { height = 1; if (handle.includes('t')) { y = originalCropBox.y + originalCropBox.height - 1; } }
      setCroppingState(prev => (prev ? { ...prev, cropBox: { x, y, width, height } } : null));
      return;
    }
    switch (interactionMode.current) {
      case 'pan': {
        setPanLastPoint({ x: e.clientX, y: e.clientY });
        if (panRafRef.current == null) {
          const rafId = requestAnimationFrame(() => {
            setPanRaf(null);
            const p = panLastPointRef.current; if (!p) return;
            const dx = p.x - startPoint.current.x; const dy = p.y - startPoint.current.y;
            updateActiveBoardSilent(b => ({ ...b, panOffset: { x: b.panOffset.x + dx, y: b.panOffset.y + dy } }));
            setStartPoint({ x: p.x, y: p.y });
          });
          setPanRaf(rafId);
        }
        break;
      }
      case 'draw': {
        if (currentDrawingElementId.current) { scheduleElementsUpdate(prev => prev.map(el => (el.id === currentDrawingElementId.current && el.type === 'path') ? { ...el, points: [...el.points, point] } : el)); }
        break;
      }
      case 'lasso': { setLassoPath(prev => (prev ? [...prev, point] : [point])); break; }
      case 'drawShape': {
        if (currentDrawingElementId.current) {
          scheduleElementsUpdate(prev => prev.map(el => {
            if (el.id === currentDrawingElementId.current && el.type === 'shape') {
              let newWidth = Math.abs(point.x - startCanvasPoint.x);
              let newHeight = Math.abs(point.y - startCanvasPoint.y);
              let newX = Math.min(point.x, startCanvasPoint.x);
              let newY = Math.min(point.y, startCanvasPoint.y);
              if (e.shiftKey) {
                if (el.shapeType === 'rectangle' || el.shapeType === 'circle') { const side = Math.max(newWidth, newHeight); newWidth = side; newHeight = side; }
                else if (el.shapeType === 'triangle') { newHeight = newWidth * (Math.sqrt(3) / 2); }
                if (point.x < startCanvasPoint.x) newX = startCanvasPoint.x - newWidth;
                if (point.y < startCanvasPoint.y) newY = startCanvasPoint.y - newHeight;
              }
              return { ...el, x: newX, y: newY, width: newWidth, height: newHeight };
            }
            return el;
          }));
        }
        break;
      }
      case 'drawArrow': {
        if (currentDrawingElementId.current) { scheduleElementsUpdate(prev => prev.map(el => (el.id === currentDrawingElementId.current && el.type === 'arrow') ? { ...el, points: [el.points[0], point] } : el)); }
        break;
      }
      case 'drawLine': {
        if (currentDrawingElementId.current) { scheduleElementsUpdate(prev => prev.map(el => (el.id === currentDrawingElementId.current && el.type === 'line') ? { ...el, points: [el.points[0], point] } : el)); }
        break;
      }
      case 'dragElements': {
        const dx = point.x - startCanvasPoint.x; const dy = point.y - startCanvasPoint.y;
        const movingElementIds = Array.from(dragStartElementPositions.current.keys());
        const movingElements = elements.filter(el => movingElementIds.includes(el.id));
        const snapThresholdCanvas = SNAP_THRESHOLD / zoom;
        const baseDx = dx; const baseDy = dy;
        let finalDx = dx; let finalDy = dy; let activeGuides: Guide[] = [];
        const getSnapPoints = (bounds: Rect) => ({ v: [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width], h: [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height] });
        const staticLines = dragStaticSnapLinesRef.current;
        const staticV = staticLines?.v ?? [];
        const staticH = staticLines?.h ?? [];
        let bestSnapX = { dist: Infinity, val: finalDx, guide: null as Guide | null };
        let bestSnapY = { dist: Infinity, val: finalDy, guide: null as Guide | null };
        movingElements.forEach(movingEl => {
          const startPos = dragStartElementPositions.current.get(movingEl.id); if (!startPos) return;
          let movingBounds: Rect;
          if (movingEl.type !== 'path' && movingEl.type !== 'arrow' && movingEl.type !== 'line') {
            movingBounds = getElementBounds({ ...movingEl, x: (startPos as Point).x, y: (startPos as Point).y }, elementsRef.current);
          } else {
            if (movingEl.type === 'arrow' || movingEl.type === 'line') movingBounds = getElementBounds({ ...movingEl, points: startPos as [Point, Point] }, elementsRef.current);
            else movingBounds = getElementBounds({ ...movingEl, points: startPos as Point[] }, elementsRef.current);
          }
          const movingSnapPoints = getSnapPoints(movingBounds);
          movingSnapPoints.v.forEach(p => {
            const target = p + baseDx;
            const nearest = findNearestValue(staticV, target);
            if (nearest == null) return;
            const dist = Math.abs(nearest - target);
            if (dist < snapThresholdCanvas && dist < bestSnapX.dist) {
              bestSnapX = { dist, val: nearest - p, guide: { type: 'v', position: nearest, start: movingBounds.y, end: movingBounds.y + movingBounds.height } };
            }
          });
          movingSnapPoints.h.forEach(p => {
            const target = p + baseDy;
            const nearest = findNearestValue(staticH, target);
            if (nearest == null) return;
            const dist = Math.abs(nearest - target);
            if (dist < snapThresholdCanvas && dist < bestSnapY.dist) {
              bestSnapY = { dist, val: nearest - p, guide: { type: 'h', position: nearest, start: movingBounds.x, end: movingBounds.x + movingBounds.width } };
            }
          });
        });
        if (bestSnapX.guide) { finalDx = bestSnapX.val; activeGuides.push(bestSnapX.guide); }
        if (bestSnapY.guide) { finalDy = bestSnapY.val; activeGuides.push(bestSnapY.guide); }
        scheduleGuidesUpdate(activeGuides);
        scheduleElementsUpdate(prev => prev.map(el => {
          if (movingElementIds.includes(el.id)) {
            const startPos = dragStartElementPositions.current.get(el.id); if (!startPos) return el;
            if (el.type !== 'path' && el.type !== 'arrow' && el.type !== 'line') return { ...el, x: (startPos as Point).x + finalDx, y: (startPos as Point).y + finalDy };
            if (el.type === 'path') { const startPoints = startPos as Point[]; const newPoints = startPoints.map(p => ({ x: p.x + finalDx, y: p.y + finalDy })); return { ...el, points: newPoints }; }
            else { const startPoints = startPos as [Point, Point]; const newPoints: [Point, Point] = [{ x: startPoints[0].x + finalDx, y: startPoints[0].y + finalDy }, { x: startPoints[1].x + finalDx, y: startPoints[1].y + finalDy }]; return { ...el, points: newPoints }; }
          }
          return el;
        }));
        break;
      }
      case 'selectBox': { const newX = Math.min(point.x, startCanvasPoint.x); const newY = Math.min(point.y, startCanvasPoint.y); const newWidth = Math.abs(point.x - startCanvasPoint.x); const newHeight = Math.abs(point.y - startCanvasPoint.y); setSelectionBox({ x: newX, y: newY, width: newWidth, height: newHeight }); break; }
    }
  };

  const handleMouseUp = () => {
    if (interactionMode.current) {
      if (interactionMode.current === 'selectBox' && selectionBox) {
        const selectedIds: string[] = [];
        const hits = queryElementsInRect(elements, selectionBox);
        hits.forEach(element => {
          const selectable = getSelectableElement(element.id, elements);
          if (selectable) selectedIds.push(selectable.id);
        });
        setSelectedElementIds([...new Set(selectedIds)]);
      } else if (interactionMode.current === 'lasso' && lassoPath && lassoPath.length > 2) {
        const polygon = lassoPath;
        const polygonBounds = getPolygonBounds(polygon);
        const candidates = queryElementsInRect(elements, polygonBounds);
        const selectedIds = candidates
          .filter(el => {
            const bounds = getElementBounds(el, elements);
            const center: Point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
            return isPointInPolygon(center, polygon);
          })
          .map(el => getSelectableElement(el.id, elements)?.id)
          .filter((id): id is string => !!id);
        setSelectedElementIds(prev => [...new Set([...prev, ...selectedIds])]);
        setLassoPath(null);
      } else if (['draw', 'drawShape', 'drawArrow', 'drawLine', 'dragElements', 'erase'].some(prefix => interactionMode.current?.startsWith(prefix)) || interactionMode.current.startsWith('resize-')) {
        flushGuidesUpdate();
        const pending = takePendingElementsUpdater();
        if (pending) commitAction(pending);
        else commitAction(els => els);
      }
    }
    setInteractionMode(null);
    setCurrentDrawingElementId(null);
    setSelectionBox(null);
    setLassoPath(null);
    setResizeStartInfo(null);
    setCropStartInfo(null);
    setAlignmentGuides([]);
    clearDragStartElementPositions();
    dragStaticSnapLinesRef.current = null;
  };

  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const listener = (e: WheelEvent) => {
      if (croppingState || editingElement) { e.preventDefault(); return; }
      e.preventDefault(); const { clientX, clientY, deltaX, deltaY, ctrlKey } = e; setWheelLastEvent({ clientX, clientY, deltaX, deltaY, ctrlKey });
      if (wheelRafRef.current == null) {
        const rafId = requestAnimationFrame(() => {
          setWheelRaf(null); const last = wheelLastEventRef.current; if (!last) return;
          if (last.ctrlKey || wheelAction === 'zoom') {
            const zoomFactor = 1.05; const oldZoom = zoom; const newZoom = last.deltaY < 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor; const clampedZoom = Math.max(0.02, Math.min(newZoom, 40));
            const mousePoint = { x: last.clientX, y: last.clientY };
            const newPanX = mousePoint.x - (mousePoint.x - panOffset.x) * (clampedZoom / oldZoom);
            const newPanY = mousePoint.y - (mousePoint.y - panOffset.y) * (clampedZoom / oldZoom);
            updateActiveBoardSilent(b => ({ ...b, zoom: clampedZoom, panOffset: { x: newPanX, y: newPanY } }));
          } else {
            updateActiveBoardSilent(b => ({ ...b, panOffset: { x: b.panOffset.x - last.deltaX, y: b.panOffset.y - last.deltaY } }));
          }
        });
        setWheelRaf(rafId);
      }
    };
    el.addEventListener('wheel', listener, { passive: false });
    return () => { el.removeEventListener('wheel', listener as EventListener); };
  }, [svgRef, croppingState, wheelAction, zoom, panOffset, updateActiveBoardSilent, editingElement, setWheelRaf, setWheelLastEvent, wheelRafRef, wheelLastEventRef]);

  const handleContextMenu = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    setContextMenu(null);
    const target = e.target as SVGElement;
    const elementId = target.closest('[data-id]')?.getAttribute('data-id');
    setContextMenu({ x: e.clientX, y: e.clientY, elementId: elementId || null });
  }, [setContextMenu]);

  let cursor = 'default';
  if (croppingState) cursor = 'default';
  else if (interactionMode.current === 'pan') cursor = 'grabbing';
  else if (activeTool === 'pan') cursor = 'grab';
  else if (['draw', 'erase', 'rectangle', 'circle', 'triangle', 'arrow', 'line', 'text', 'highlighter', 'lasso'].includes(activeTool)) cursor = 'crosshair';

  return { handleMouseDown, handleMouseMove, handleMouseUp, handleContextMenu, cursor };
}
