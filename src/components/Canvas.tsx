import React from 'react';
import type { MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { Element, ImageElement, Point } from '@/types';
import { getElementBounds, computeImageClip } from '@/utils/canvas';
import { SelectionOverlay } from '@/components/SelectionOverlay';
import { ImageResolution } from '@/components/ImageResolution';
import { PLACEHOLDER_DATA_URL } from '@/utils/image';
import { getUiRadiusLg } from '@/ui/standards';
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
  onDragEnter?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onRetryGenerate?: (elementId: string) => void;
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
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onRetryGenerate,
}) => {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  const safePanOffset: Point = {
    x: Number.isFinite(panOffset.x) ? panOffset.x : 0,
    y: Number.isFinite(panOffset.y) ? panOffset.y : 0,
  }
  const failureOverlays: React.ReactNode[] = [];
  const isElementVisible = (element: Element, allElements: Element[]): boolean => {
    if (element.isVisible === false) return false;
    if (element.parentId) {
      const parent = allElements.find(el => el.id === element.parentId);
      if (parent) return isElementVisible(parent, allElements);
    }
    return true;
  };
  return (
    <div className="w-full h-full relative">
      <svg
        ref={svgRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
        onDragOverCapture={(e) => { e.preventDefault(); if ((e as React.DragEvent).dataTransfer) (e as React.DragEvent).dataTransfer.dropEffect = 'copy'; }}
        onDropCapture={(e) => { e.preventDefault(); }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
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
          if (el.type === 'image') {
            const clip = computeImageClip(el as ImageElement, 'clip-');
            if (clip.r > 0) {
              return (
                <clipPath id={clip.id} key={clip.id}>
                  <rect x={clip.rect.x} y={clip.rect.y} width={clip.rect.width} height={clip.rect.height} rx={clip.r} ry={clip.r} />
                </clipPath>
              );
            }
          }
          return null;
        })}
      </defs>
      <g transform={`translate(${safePanOffset.x}, ${safePanOffset.y}) scale(${z})`}>
        <rect x={-safePanOffset.x / z} y={-safePanOffset.y / z} width={`calc(100% / ${z})`} height={`calc(100% / ${z})`} fill="url(#grid)" />
        {elements.map(el => {
          if (!isElementVisible(el, elements)) return null;
          const isSelected = selectedElementIds.includes(el.id);
          let selectionComponent: React.ReactNode = null;
          if (isSelected && !croppingState) {
            if (selectedElementIds.length > 1 || el.type === 'path' || el.type === 'arrow' || el.type === 'line' || el.type === 'group') {
              const b = getElementBounds(el, elements);
              selectionComponent = <rect x={b.x} y={b.y} width={b.width} height={b.height} fill="none" stroke="rgb(59 130 246)" strokeWidth={2 / z} strokeDasharray={`${6 / z} ${4 / z}`} pointerEvents="none" />
            } else if (el.type === 'image' || el.type === 'shape' || el.type === 'text' || el.type === 'video') {
              const s = 8 / z;
              const hs = [
                { n: 'tl', x: el.x, y: el.y, c: 'nwse-resize' }, { n: 'tm', x: el.x + el.width / 2, y: el.y, c: 'ns-resize' }, { n: 'tr', x: el.x + el.width, y: el.y, c: 'nesw-resize' },
                { n: 'ml', x: el.x, y: el.y + el.height / 2, c: 'ew-resize' }, { n: 'mr', x: el.x + el.width, y: el.y + el.height / 2, c: 'ew-resize' },
                { n: 'bl', x: el.x, y: el.y + el.height, c: 'nesw-resize' }, { n: 'bm', x: el.x + el.width / 2, y: el.y + el.height, c: 'ns-resize' }, { n: 'br', x: el.x + el.width, y: el.y + el.height, c: 'nwse-resize' },
              ];
              selectionComponent = <g>
                <rect x={el.x} y={el.y} width={el.width} height={el.height} fill="none" stroke="rgb(59 130 246)" strokeWidth={2 / z} pointerEvents="none" />
                {hs.map(h => <rect key={h.n} data-handle={h.n} x={h.x - s / 2} y={h.y - s / 2} width={s} height={s} fill="white" stroke="#3b82f6" strokeWidth={1 / z} className={`cursor-${h.c}`} />)}
              </g>
            }
          }
          if (el.type === 'path') {
            const d = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            return <g key={el.id} data-id={el.id} className="cursor-pointer"><path d={d} stroke={el.strokeColor} strokeWidth={el.strokeWidth / z} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="stroke" strokeOpacity={el.strokeOpacity} />{selectionComponent}</g>;
          }
          if (el.type === 'arrow') {
            const [s, e] = el.points;
            const ang = Math.atan2(e.y - s.y, e.x - s.x);
            const hl = el.strokeWidth * 4;
            const ah = hl * Math.cos(Math.PI / 6);
            const le = { x: e.x - ah * Math.cos(ang), y: e.y - ah * Math.sin(ang) };
            const h1 = { x: e.x - hl * Math.cos(ang - Math.PI / 6), y: e.y - hl * Math.sin(ang - Math.PI / 6) };
            const h2 = { x: e.x - hl * Math.cos(ang + Math.PI / 6), y: e.y - hl * Math.sin(ang + Math.PI / 6) };
            return <g key={el.id} data-id={el.id} className="cursor-pointer"><line x1={s.x} y1={s.y} x2={le.x} y2={le.y} stroke={el.strokeColor} strokeWidth={el.strokeWidth / z} strokeLinecap="round" /><polygon points={`${e.x},${e.y} ${h1.x},${h1.y} ${h2.x},${h2.y}`} fill={el.strokeColor} />{selectionComponent}</g>;
          }
          if (el.type === 'line') {
            const [s, e] = el.points;
            return <g key={el.id} data-id={el.id} className="cursor-pointer"><line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke={el.strokeColor} strokeWidth={el.strokeWidth / z} strokeLinecap="round" />{selectionComponent}</g>;
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
                {jsx && React.cloneElement(jsx, { fill: el.fillColor, stroke: el.strokeColor, strokeWidth: el.strokeWidth / z, strokeDasharray: el.strokeDashArray ? el.strokeDashArray.join(' ') : 'none' })}
                {selectionComponent && React.cloneElement(selectionComponent as React.ReactElement, { transform: `translate(${-el.x}, ${-el.y})` })}
              </g>
            );
          }
          if (el.type === 'image') {
            const br = typeof (el as ImageElement).borderRadius === 'number' ? (el as ImageElement).borderRadius! : getUiRadiusLg();
            const hasR = br > 0;
            const cid = `clip-${el.id}`;
            const isPh = el.href === PLACEHOLDER_DATA_URL;
            const imgEl = el as ImageElement;
            const showSpinner = imgEl.isGenerating;
            const spinnerR = Math.min(Math.min(el.width, el.height) / 4, 12 / z);

            if (isPh) {
              const genStatus = imgEl.genStatus;
              const isFailed = genStatus === 'failed' || genStatus === 'timeout';
              const showFailureOverlay = isFailed && !showSpinner;

              if (showFailureOverlay) {
                const centerX = (el.x + el.width / 2) * z + safePanOffset.x;
                const centerY = (el.y + el.height / 2) * z + safePanOffset.y;
                failureOverlays.push(
                  <div
                    key={`failure-${imgEl.id}`}
                    style={{
                      position: 'absolute',
                      left: `${centerX}px`,
                      top: `${centerY}px`,
                      transform: 'translate(-50%, -50%)',
                      width: '180px',
                      height: '140px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                      zIndex: 10,
                    }}
                  >
                    <div
                      style={{
                        pointerEvents: 'auto',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px',
                        boxSizing: 'border-box',
                        color: '#F9FAFB',
                        fontSize: '12px',
                        textAlign: 'center',
                        backgroundColor: 'rgba(31, 24, 55, 0.55)',
                        borderRadius: '12px',
                        border: 'none',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
                      }}
                    >
                      <div style={{ marginBottom: 4, fontWeight: 600, color: '#FCA5A5' }}>
                        {genStatus === 'timeout' ? '生成超时' : '生成失败'}
                      </div>
                      <div
                        style={{
                          marginBottom: 8,
                          opacity: 0.9,
                          fontSize: '11px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          lineHeight: '1.3',
                        }}
                      >
                        {imgEl.genError || '未知错误'}
                      </div>
                      {imgEl.genProvider === 'Grsai' && imgEl.genTaskId && (
                        <>
                          <div
                            style={{
                              marginBottom: 8,
                              fontFamily: 'monospace',
                              fontSize: '10px',
                              opacity: 0.7,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ID: {imgEl.genTaskId}
                          </div>
                          <button
                            style={{
                              pointerEvents: 'auto',
                              padding: '6px 16px',
                              backgroundColor: 'var(--brand-primary, #C5AEF6)',
                              color: '#111827',
                              border: 'none',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              marginTop: '2px',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
                              transition: 'background-color 0.15s ease-out, transform 0.15s ease-out',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (onRetryGenerate) onRetryGenerate(imgEl.id);
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#E5D5FF';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                'var(--brand-primary, #C5AEF6)';
                            }}
                          >
                            重新获取
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <g key={el.id} data-id={el.id} className="cursor-pointer">
                  <rect
                    x={el.x}
                    y={el.y}
                    width={el.width}
                    height={el.height}
                    style={{ fill: 'var(--bg-component-solid)', stroke: 'var(--border-color)', strokeWidth: 1 / Math.max(1, z) } as React.CSSProperties}
                    clipPath={hasR ? `url(#${cid})` : undefined}
                  />
                  {(el as ImageElement).previewHref && (
                    <image
                      x={el.x}
                      y={el.y}
                      width={el.width}
                      height={el.height}
                      href={(el as ImageElement).previewHref}
                      preserveAspectRatio="none"
                      opacity={0.3}
                      style={{ filter: 'grayscale(0.3) contrast(0.8) brightness(0.7)' }}
                      clipPath={hasR ? `url(#${cid})` : undefined}
                    />
                  )}
                  {showSpinner && (
                    <g transform={`translate(${el.x + el.width / 2}, ${el.y + el.height / 2}) scale(${1 / z})`}>
                      <g transform="translate(-12, -24)">
                        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="10" stroke="#A78BFA" strokeWidth="4" opacity="0.25" />
                          <path fill="#A78BFA" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
                          </path>
                        </svg>
                      </g>
                      <g transform="translate(0, 10)">
                        <rect x="-40" y="0" width="80" height="24" rx="12" fill="#171717" fillOpacity="0.9" stroke="white" strokeOpacity="0.1" strokeWidth="1" />
                        <text x="0" y="16" textAnchor="middle" fill="white" fillOpacity="0.9" fontSize="11" fontWeight="500" style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Generating...</text>
                      </g>
                    </g>
                  )}
                  {showFailureOverlay && (
                    <g transform={`translate(${el.x + el.width / 2}, ${el.y + el.height / 2}) scale(${1 / z})`}>
                      <foreignObject x="-90" y="-70" width="180" height="140" style={{ pointerEvents: 'none' }}>
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '12px',
                          boxSizing: 'border-box',
                          color: '#EF4444',
                          fontSize: '12px',
                          textAlign: 'center',
                          backgroundColor: 'rgba(50, 35, 90, 0.8)',
                          borderRadius: '12px',
                          border: '1px solid rgba(197, 174, 246, 0.2)',
                          backdropFilter: 'blur(12px)'
                        }}>
                          <div style={{ marginBottom: 4, fontWeight: 600 }}>
                            {genStatus === 'timeout' ? '生成超时' : '生成失败'}
                          </div>
                          <div style={{ marginBottom: 8, opacity: 0.8, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.2' }}>
                            {imgEl.genError || '未知错误'}
                          </div>
                          {imgEl.genProvider === 'Grsai' && imgEl.genTaskId && (
                            <>
                              <div style={{ marginBottom: 8, fontFamily: 'monospace', fontSize: '10px', opacity: 0.6 }}>
                                ID: {imgEl.genTaskId.slice(0, 8)}...
                              </div>
                              <button
                                style={{
                                  pointerEvents: 'auto',
                                  padding: '6px 16px',
                                  backgroundColor: 'var(--brand-primary, #3B82F6)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  marginTop: '2px',
                                  whiteSpace: 'nowrap'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (onRetryGenerate) onRetryGenerate(imgEl.id);
                                }}
                              >
                                重新获取
                              </button>
                            </>
                          )}
                        </div>
                      </foreignObject>
                    </g>
                  )}
                  {selectionComponent}
                </g>
              );
            }

            return (
              <g key={el.id} data-id={el.id}>
                <image
                  x={el.x}
                  y={el.y}
                  href={el.href}
                  width={el.width}
                  height={el.height}
                  className={croppingState && croppingState.elementId !== el.id ? 'opacity-30' : ''}
                  opacity={typeof el.opacity === 'number' ? el.opacity / 100 : 1}
                  clipPath={hasR ? `url(#${cid})` : undefined}
                />
                {isSelected && !croppingState && (
                  <g transform={`translate(${el.x}, ${el.y})`}>
                    <ImageResolution
                      href={el.href}
                      width={el.width}
                      height={el.height}
                      zoom={z}
                    />
                  </g>
                )}
                {showSpinner && spinnerR > 0 && (
                  <g transform={`translate(${el.x + el.width / 2}, ${el.y + el.height / 2})`}>
                    <svg
                      className="animate-spin text-purple-400 drop-shadow-md"
                      x={-spinnerR}
                      y={-spinnerR}
                      width={spinnerR * 2}
                      height={spinnerR * 2}
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </g>
                )}
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
          panOffset={safePanOffset}
          zoom={z}
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
        />
      </g>
      </svg>
      {failureOverlays}
    </div>
  );
};
