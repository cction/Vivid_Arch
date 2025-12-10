import React from 'react';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { Element, ImageElement, Point } from '@/types';
import { getElementBounds } from '@/utils/canvas';
import { SelectionOverlay } from '@/components/SelectionOverlay';
import { PLACEHOLDER_DATA_URL } from '@/utils/image';
type Rect = { x: number; y: number; width: number; height: number };
type Guide = { type: 'v' | 'h'; position: number; start: number; end: number };
interface CanvasProps {
  svgRef: MutableRefObject<SVGSVGElement | null>;
  panOffset: Point;
  zoom: number;
  elements: Element[];
  selectedElementIds: string[];
  selectionBox: Rect | null;
  croppingState: { elementId: string; originalElement: ImageElement; cropBox: Rect } | null;
  editingElement: { id: string; text: string } | null;
  setEditingElement: Dispatch<SetStateAction<{ id: string; text: string } | null>>;
  editingTextareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  handleMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleMouseUp: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleContextMenu: (e: React.MouseEvent<SVGSVGElement>) => void;
  lassoPath: Point[] | null;
  alignmentGuides: Guide[];
  getSelectionBounds: (ids: string[]) => Rect;
  handleAlignSelection: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  t: (key: string) => string;
  handleDeleteElement: (id: string) => void;
  handleCopyElement: (element: Element) => void;
  handleDownloadImage: (element: ImageElement) => void;
  handleStartCrop: (element: ImageElement) => void;
  handlePropertyChange: (elementId: string, updates: Partial<Element>) => void;
  cursor: string;
  handleStopEditing: () => void;
  canvasBackgroundColor?: string;
}
export const Canvas: React.FC<CanvasProps> = ({
  svgRef,
  panOffset,
  zoom,
  elements,
  selectedElementIds,
  selectionBox,
  croppingState,
  editingElement,
  setEditingElement,
  editingTextareaRef,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleContextMenu,
  lassoPath,
  alignmentGuides,
  getSelectionBounds,
  handleAlignSelection,
  t,
  handleDeleteElement,
  handleCopyElement,
  handleDownloadImage,
  handleStartCrop,
  handlePropertyChange,
  cursor,
  handleStopEditing,
  canvasBackgroundColor,
}) => {
  const isElementVisible = (element: Element, allElements: Element[]): boolean => {
    if (element.isVisible === false) return false;
    if (element.parentId) {
      const parent = allElements.find(el => el.id === element.parentId);
      if (parent) return isElementVisible(parent, allElements);
    }
    return true;
  };
  return (
    <svg
      ref={svgRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
      style={{ '--canvas-cursor': cursor, '--canvas-bg': canvasBackgroundColor } as React.CSSProperties}
      className="w-full h-full pod-canvas-root"
    >
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.5" className="pod-grid-dot" />
        </pattern>
        <pattern id="podui-placeholder" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#1E1E24" />
          <path d="M0 8 L8 0" stroke="#374151" strokeWidth="1" opacity="0.35" />
          <path d="M-4 8 L8 -4" stroke="#374151" strokeWidth="1" opacity="0.35" />
        </pattern>
        {elements.map(el => {
          if (el.type === 'image' && el.borderRadius && el.borderRadius > 0) {
            const clipPathId = `clip-${el.id}`;
            return (
              <clipPath id={clipPathId} key={clipPathId}>
                <rect width={el.width} height={el.height} rx={el.borderRadius} ry={el.borderRadius} />
              </clipPath>
            );
          }
          return null;
        })}
      </defs>
      <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
        <rect x={-panOffset.x / zoom} y={-panOffset.y / zoom} width={`calc(100% / ${zoom})`} height={`calc(100% / ${zoom})`} fill="url(#grid)" />
        {elements.map(el => {
          if (!isElementVisible(el, elements)) return null;
          const isSelected = selectedElementIds.includes(el.id);
          let selectionComponent: React.ReactNode = null;
          if (isSelected && !croppingState) {
            if (selectedElementIds.length > 1 || el.type === 'path' || el.type === 'arrow' || el.type === 'line' || el.type === 'group') {
              const b = getElementBounds(el, elements);
              selectionComponent = <rect x={b.x} y={b.y} width={b.width} height={b.height} fill="none" stroke="rgb(59 130 246)" strokeWidth={2 / zoom} strokeDasharray={`${6 / zoom} ${4 / zoom}`} pointerEvents="none" />
            } else if (el.type === 'image' || el.type === 'shape' || el.type === 'text' || el.type === 'video') {
              const s = 8 / zoom;
              const hs = [
                { n: 'tl', x: el.x, y: el.y, c: 'nwse-resize' }, { n: 'tm', x: el.x + el.width / 2, y: el.y, c: 'ns-resize' }, { n: 'tr', x: el.x + el.width, y: el.y, c: 'nesw-resize' },
                { n: 'ml', x: el.x, y: el.y + el.height / 2, c: 'ew-resize' }, { n: 'mr', x: el.x + el.width, y: el.y + el.height / 2, c: 'ew-resize' },
                { n: 'bl', x: el.x, y: el.y + el.height, c: 'nesw-resize' }, { n: 'bm', x: el.x + el.width / 2, y: el.y + el.height, c: 'ns-resize' }, { n: 'br', x: el.x + el.width, y: el.y + el.height, c: 'nwse-resize' },
              ];
              selectionComponent = <g>
                <rect x={el.x} y={el.y} width={el.width} height={el.height} fill="none" stroke="rgb(59 130 246)" strokeWidth={2 / zoom} pointerEvents="none" />
                {hs.map(h => <rect key={h.n} data-handle={h.n} x={h.x - s / 2} y={h.y - s / 2} width={s} height={s} fill="white" stroke="#3b82f6" strokeWidth={1 / zoom} className={`cursor-${h.c}`} />)}
              </g>
            }
          }
          if (el.type === 'path') {
            const d = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            return <g key={el.id} data-id={el.id} className="cursor-pointer"><path d={d} stroke={el.strokeColor} strokeWidth={el.strokeWidth / zoom} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="stroke" strokeOpacity={el.strokeOpacity} />{selectionComponent}</g>;
          }
          if (el.type === 'arrow') {
            const [s, e] = el.points;
            const ang = Math.atan2(e.y - s.y, e.x - s.x);
            const hl = el.strokeWidth * 4;
            const ah = hl * Math.cos(Math.PI / 6);
            const le = { x: e.x - ah * Math.cos(ang), y: e.y - ah * Math.sin(ang) };
            const h1 = { x: e.x - hl * Math.cos(ang - Math.PI / 6), y: e.y - hl * Math.sin(ang - Math.PI / 6) };
            const h2 = { x: e.x - hl * Math.cos(ang + Math.PI / 6), y: e.y - hl * Math.sin(ang + Math.PI / 6) };
            return <g key={el.id} data-id={el.id} className="cursor-pointer"><line x1={s.x} y1={s.y} x2={le.x} y2={le.y} stroke={el.strokeColor} strokeWidth={el.strokeWidth / zoom} strokeLinecap="round" /><polygon points={`${e.x},${e.y} ${h1.x},${h1.y} ${h2.x},${h2.y}`} fill={el.strokeColor} />{selectionComponent}</g>;
          }
          if (el.type === 'line') {
            const [s, e] = el.points;
            return <g key={el.id} data-id={el.id} className="cursor-pointer"><line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke={el.strokeColor} strokeWidth={el.strokeWidth / zoom} strokeLinecap="round" />{selectionComponent}</g>;
          }
          if (el.type === 'text') {
            const isEditing = editingElement?.id === el.id;
            return (
              <g key={el.id} data-id={el.id} transform={`translate(${el.x}, ${el.y})`} className="cursor-pointer">
                {!isEditing && (
                  <foreignObject width={el.width} height={el.height} className="pod-foreign-object-visible">
                    <div className="pod-text-element-content" style={{ '--el-font-size': `${el.fontSize}px`, '--el-color': el.fontColor } as React.CSSProperties}>{el.text}</div>
                  </foreignObject>
                )}
                {selectionComponent && React.cloneElement(selectionComponent as React.ReactElement, { transform: `translate(${-el.x}, ${-el.y})` })}
              </g>
            );
          }
          if (el.type === 'shape') {
            let jsx: React.ReactElement | null = null;
            if (el.shapeType === 'rectangle') jsx = <rect width={el.width} height={el.height} rx={el.borderRadius || 0} ry={el.borderRadius || 0} />
            else if (el.shapeType === 'circle') jsx = <ellipse cx={el.width / 2} cy={el.height / 2} rx={el.width / 2} ry={el.height / 2} />
            else if (el.shapeType === 'triangle') jsx = <polygon points={`${el.width / 2},0 0,${el.height} ${el.width},${el.height}`} />
            return (
              <g key={el.id} data-id={el.id} transform={`translate(${el.x}, ${el.y})`} className="cursor-pointer">
                {jsx && React.cloneElement(jsx, { fill: el.fillColor, stroke: el.strokeColor, strokeWidth: el.strokeWidth / zoom, strokeDasharray: el.strokeDashArray ? el.strokeDashArray.join(' ') : 'none' })}
                {selectionComponent && React.cloneElement(selectionComponent as React.ReactElement, { transform: `translate(${-el.x}, ${-el.y})` })}
              </g>
            );
          }
          if (el.type === 'image') {
            const hasR = el.borderRadius && el.borderRadius > 0;
            const cid = `clip-${el.id}`;
            const isPh = el.href === PLACEHOLDER_DATA_URL;
            return (
              <g key={el.id} data-id={el.id}>
                {isPh && (hasR
                  ? <rect x={el.x} y={el.y} width={el.width} height={el.height} fill="url(#podui-placeholder)" stroke="#374151" strokeWidth={1 / zoom} clipPath={`url(#${cid})`} />
                  : <rect x={el.x} y={el.y} width={el.width} height={el.height} fill="url(#podui-placeholder)" stroke="#374151" strokeWidth={1 / zoom} />
                )}
                <image transform={`translate(${el.x}, ${el.y})`} href={el.href} width={el.width} height={el.height} className={croppingState && croppingState.elementId !== el.id ? 'opacity-30' : ''} opacity={typeof el.opacity === 'number' ? el.opacity / 100 : 1} clipPath={hasR ? `url(#${cid})` : undefined} />
                {selectionComponent}
              </g>
            );
          }
          if (el.type === 'video') {
            return (
              <g key={el.id} data-id={el.id}>
                <foreignObject x={el.x} y={el.y} width={el.width} height={el.height}>
                  <video src={el.href} controls className={`pod-video-element ${croppingState ? 'opacity-30' : ''}`}></video>
                </foreignObject>
                {selectionComponent}
              </g>
            );
          }
          if (el.type === 'group') return <g key={el.id} data-id={el.id}>{selectionComponent}</g>;
          return null;
        })}
        <SelectionOverlay
          panOffset={panOffset}
          zoom={zoom}
          elements={elements}
          selectedElementIds={selectedElementIds}
          selectionBox={selectionBox}
          lassoPath={lassoPath}
          alignmentGuides={alignmentGuides}
          croppingState={croppingState}
          editingElement={editingElement}
          setEditingElement={setEditingElement}
          editingTextareaRef={editingTextareaRef}
          getSelectionBounds={getSelectionBounds}
          handleAlignSelection={handleAlignSelection}
          t={t}
          handleCopyElement={handleCopyElement}
          handleDownloadImage={handleDownloadImage}
          handleStartCrop={handleStartCrop}
          handlePropertyChange={handlePropertyChange}
          handleDeleteElement={handleDeleteElement}
          handleStopEditing={handleStopEditing}
        />
      </g>
    </svg>
  );
};
