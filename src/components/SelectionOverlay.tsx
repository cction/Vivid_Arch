import React from 'react';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { Element, TextElement, ImageElement, Point } from '@/types';
import { getElementBounds } from '@/utils/canvas';
import { ContextToolbar } from '@/components/ContextToolbar';

type Rect = { x: number; y: number; width: number; height: number };
type Guide = { type: 'v' | 'h'; position: number; start: number; end: number };

interface SelectionOverlayProps {
  panOffset: Point;
  zoom: number;
  elements: Element[];
  selectedElementIds: string[];
  selectionBox: Rect | null;
  lassoPath: Point[] | null;
  alignmentGuides: Guide[];
  croppingState: { elementId: string; originalElement: ImageElement; cropBox: Rect } | null;
  editingElement: { id: string; text: string } | null;
  setEditingElement: Dispatch<SetStateAction<{ id: string; text: string } | null>>;
  editingTextareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  getSelectionBounds: (ids: string[]) => Rect;
  handleAlignSelection: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  t: (key: string) => string;
  handleCopyElement: (element: Element) => void;
  handleDownloadImage: (element: ImageElement) => void;
  handleStartCrop: (element: ImageElement) => void;
  handlePropertyChange: (elementId: string, updates: Partial<Element>) => void;
  handleDeleteElement: (id: string) => void;
  handleStopEditing: () => void;
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  panOffset,
  zoom,
  elements,
  selectedElementIds,
  selectionBox,
  lassoPath,
  alignmentGuides,
  croppingState,
  editingElement,
  setEditingElement,
  editingTextareaRef,
  getSelectionBounds,
  handleAlignSelection,
  t,
  handleCopyElement,
  handleDownloadImage,
  handleStartCrop,
  handlePropertyChange,
  handleDeleteElement,
  handleStopEditing,
}) => {
  const singleSelectedElement = selectedElementIds.length === 1 ? elements.find(el => el.id === selectedElementIds[0]) : null;

  return (
    <>
      {lassoPath && (
        <path d={lassoPath.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')} stroke="var(--color-blue-500)" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`} fill="var(--color-blue-500)" fillOpacity="0.1" />
      )}

      {alignmentGuides.map((g, i) => (
        <line key={i} x1={g.type === 'v' ? g.position : g.start} y1={g.type === 'h' ? g.position : g.start} x2={g.type === 'v' ? g.position : g.end} y2={g.type === 'h' ? g.position : g.end} stroke="var(--color-red-500)" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${2 / zoom}`} />
      ))}

      {selectedElementIds.length > 0 && !croppingState && !editingElement && (() => {
        if (selectedElementIds.length > 1) {
          const b = getSelectionBounds(selectedElementIds);
          const sw = 380; // Increased width for new UI
          const sh = 64; // Increased height
          const cw = sw / zoom;
          const ch = sh / zoom;
          const x = b.x + b.width / 2 - cw / 2;
          const y = b.y - ch - 10 / zoom;
          return (
            <foreignObject x={x} y={y} width={cw} height={ch} className="pod-foreign-object-visible">
              <ContextToolbar mode="multi" toolbarScreenWidth={sw} toolbarScreenHeight={sh} zoom={zoom} t={t} onAlign={handleAlignSelection} />
            </foreignObject>
          );
        } else if (singleSelectedElement) {
          const el = singleSelectedElement;
          const b = getElementBounds(el, elements);
          let sw = 340; // Minimum width for consistency
          if (el.type === 'shape') {
            sw = 400;
            if ((el as any).shapeType === 'rectangle') sw += 200;
          }
          if (el.type === 'text') sw = 360;
          if (el.type === 'arrow' || el.type === 'line') sw = 360;
          if (el.type === 'image') sw = 440;
          if (el.type === 'video') sw = 340;
          if (el.type === 'group') sw = 340;
          const sh = 64; // Increased height
          const cw = sw / zoom;
          const ch = sh / zoom;
          const x = b.x + b.width / 2 - cw / 2;
          const y = b.y - ch - 10 / zoom;
          return (
            <foreignObject x={x} y={y} width={cw} height={ch} className="pod-foreign-object-visible">
              <ContextToolbar 
                mode="single" 
                element={el} 
                toolbarScreenWidth={sw} 
                toolbarScreenHeight={sh} 
                zoom={zoom} 
                t={t} 
                onCopy={handleCopyElement} 
                onDownloadImage={handleDownloadImage} 
                onStartCrop={handleStartCrop} 
                onPropChange={handlePropertyChange} 
                onDelete={handleDeleteElement} 
              />
            </foreignObject>
          );
        }
        return null;
      })()}

      {editingElement && (() => {
        const el = elements.find(e => e.id === editingElement.id) as TextElement;
        if (!el) return null;
        return (
          <foreignObject x={el.x} y={el.y} width={el.width} height={el.height} onMouseDown={(e) => e.stopPropagation()}>
            <textarea
              ref={editingTextareaRef}
              value={editingElement.text}
              onChange={(e) => setEditingElement({ ...editingElement, text: e.target.value })}
              onBlur={() => handleStopEditing()}
              className="pod-text-element-content"
              style={{ '--el-font-size': `${el.fontSize}px`, '--el-color': el.fontColor } as React.CSSProperties}
            />
          </foreignObject>
        );
      })()}

      {croppingState && (
        <g>
          <path
            d={`M ${-panOffset.x / zoom},${-panOffset.y / zoom} H ${window.innerWidth / zoom - panOffset.x / zoom} V ${window.innerHeight / zoom - panOffset.y / zoom} H ${-panOffset.x / zoom} Z M ${croppingState.cropBox.x},${croppingState.cropBox.y} v ${croppingState.cropBox.height} h ${croppingState.cropBox.width} v ${-croppingState.cropBox.height} Z`}
            fill="rgba(0,0,0,0.5)"
            fillRule="evenodd"
            pointerEvents="none"
          />
          <rect x={croppingState.cropBox.x} y={croppingState.cropBox.y} width={croppingState.cropBox.width} height={croppingState.cropBox.height} fill="none" stroke="var(--color-neutral-white)" strokeWidth={2 / zoom} pointerEvents="all" />
          {(() => {
            const { x, y, width, height } = croppingState.cropBox;
            const s = 10 / zoom;
            const hs = [
              { n: 'tl', x, y, c: 'nwse-resize' },
              { n: 'tr', x: x + width, y, c: 'nesw-resize' },
              { n: 'bl', x, y: y + height, c: 'nesw-resize' },
              { n: 'br', x: x + width, y: y + height, c: 'nwse-resize' },
            ];
            return hs.map(h => (
              <rect 
                key={h.n} 
                data-handle={h.n} 
                x={h.x - s / 2} 
                y={h.y - s / 2} 
                width={s} 
                height={s} 
                fill="var(--color-neutral-white)" 
                stroke="var(--color-blue-500)" 
                strokeWidth={1 / zoom} 
                className={h.c === 'nwse-resize' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'} 
              />
            ));
          })()}
        </g>
      )}

      {selectionBox && (
        <rect x={selectionBox.x} y={selectionBox.y} width={selectionBox.width} height={selectionBox.height} fill="var(--color-blue-500)" fillOpacity="0.1" stroke="var(--color-blue-500)" strokeWidth={1 / zoom} />
      )}
    </>
  );
};

