import React from 'react';
import type { Element } from '@/types';

type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

type BaseProps = {
  toolbarScreenWidth: number;
  toolbarScreenHeight: number;
  zoom: number;
  t: (key: string) => string;
};

type MultiProps = BaseProps & {
  mode: 'multi';
  onAlign: (a: Align) => void;
};

type SingleProps = BaseProps & {
  mode: 'single';
  element: Element;
  onCopy: (el: Element) => void;
  onDownloadImage?: (el: Extract<Element, { type: 'image' }>) => void;
  onStartCrop?: (el: Extract<Element, { type: 'image' }>) => void;
  onPropChange: (id: string, updates: Partial<Element>) => void;
  onDelete: (id: string) => void;
};

type Props = MultiProps | SingleProps;

export const ContextToolbar: React.FC<Props> = (props) => {
  const style = { '--pod-scale': 1 / props.zoom, '--pod-width': `${props.toolbarScreenWidth}px`, '--pod-height': `${props.toolbarScreenHeight}px` } as React.CSSProperties;

  if (props.mode === 'multi') {
    const { t, onAlign } = props;
    return (
      <div className="pod-context-toolbar-container" style={style} onMouseDown={(e) => e.stopPropagation()}>
        <div className="pod-context-toolbar">
          <button title={t('contextMenu.alignment.alignLeft')} onClick={() => onAlign('left')} className="pod-context-button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="3"></line><rect x="8" y="6" width="8" height="4" rx="1"></rect><rect x="8" y="14" width="12" height="4" rx="1"></rect></svg></button>
          <button title={t('contextMenu.alignment.alignCenter')} onClick={() => onAlign('center')} className="pod-context-button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="21" x2="12" y2="3" strokeDasharray="2 2"></line><rect x="7" y="6" width="10" height="4" rx="1"></rect><rect x="4" y="14" width="16" height="4" rx="1"></rect></svg></button>
          <button title={t('contextMenu.alignment.alignRight')} onClick={() => onAlign('right')} className="pod-context-button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="20" y1="21" x2="20" y2="3"></line><rect x="12" y="6" width="8" height="4" rx="1"></rect><rect x="8" y="14" width="12" height="4" rx="1"></rect></svg></button>
          <div className="pod-context-separator"></div>
          <button title={t('contextMenu.alignment.alignTop')} onClick={() => onAlign('top')} className="pod-context-button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="4" x2="21" y2="4"></line><rect x="6" y="8" width="4" height="8" rx="1"></rect><rect x="14" y="8" width="4" height="12" rx="1"></rect></svg></button>
          <button title={t('contextMenu.alignment.alignMiddle')} onClick={() => onAlign('middle')} className="pod-context-button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12" strokeDasharray="2 2"></line><rect x="6" y="7" width="4" height="10" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg></button>
          <button title={t('contextMenu.alignment.alignBottom')} onClick={() => onAlign('bottom')} className="pod-context-button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="20" x2="21" y2="20"></line><rect x="6" y="12" width="4" height="8" rx="1"></rect><rect x="14" y="8" width="4" height="12" rx="1"></rect></svg></button>
        </div>
      </div>
    );
  }

  const { element, t, onCopy, onDownloadImage, onStartCrop, onPropChange, onDelete } = props;

  return (
    <div className="pod-context-toolbar-container" style={style} onMouseDown={(e) => e.stopPropagation()}>
      <div className="pod-context-toolbar">
        <button title={t('contextMenu.copy')} onClick={() => onCopy(element)} className="pod-context-button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
        {element.type === 'image' && onDownloadImage && <button title={t('contextMenu.download')} onClick={() => onDownloadImage(element as Extract<Element, { type: 'image' }>)} className="pod-context-button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>}
        {element.type === 'video' && <a title={t('contextMenu.download')} href={(element as any).href} download={`video-${element.id}.mp4`} className="pod-context-button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></a>}
        {element.type === 'image' && onStartCrop && <button title={t('contextMenu.crop')} onClick={() => onStartCrop(element as Extract<Element, { type: 'image' }>)} className="pod-context-button"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path></svg></button>}
        {element.type === 'image' && (
          <>
            <div className="pod-context-separator"></div>
            <div title={t('contextMenu.opacity')} className="pod-context-group">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]"><circle cx="12" cy="12" r="9" /></svg>
              <input type="range" min="0" max={100} value={typeof (element as any).opacity === 'number' ? (element as any).opacity : 100} onChange={e => onPropChange(element.id, { opacity: parseInt(e.target.value, 10) })} className="pod-context-range" />
              <input type="number" min="0" max={100} value={typeof (element as any).opacity === 'number' ? (element as any).opacity : 100} onChange={e => onPropChange(element.id, { opacity: parseInt(e.target.value, 10) || 0 })} className="pod-context-input" />
            </div>
          </>
        )}
        {element.type === 'shape' && (
          <>
            <input type="color" title={t('contextMenu.fillColor')} value={(element as any).fillColor} onChange={e => onPropChange(element.id, { fillColor: e.target.value })} className="pod-context-color-input" />
            <div className="pod-context-separator"></div>
            <input type="color" title={t('contextMenu.strokeColor')} value={(element as any).strokeColor} onChange={e => onPropChange(element.id, { strokeColor: e.target.value })} className="pod-context-color-input" />
            <div className="pod-context-separator"></div>
            <div title={t('contextMenu.strokeStyle')} className="pod-context-group">
              <button title={t('contextMenu.solid')} onClick={() => onPropChange(element.id, { strokeDashArray: undefined })} className={`pod-context-button ${!(element as any).strokeDashArray ? 'active' : ''}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <button title={t('contextMenu.dashed')} onClick={() => onPropChange(element.id, { strokeDashArray: [10, 10] })} className={`pod-context-button ${(element as any).strokeDashArray?.toString() === '10,10' ? 'active' : ''}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="9" y2="12"></line><line x1="15" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <button title={t('contextMenu.dotted')} onClick={() => onPropChange(element.id, { strokeDashArray: [2, 6] })} className={`pod-context-button ${(element as any).strokeDashArray?.toString() === '2,6' ? 'active' : ''}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="5.01" y2="12"></line><line x1="12" y1="12" x2="12.01" y2="12"></line><line x1="19" y1="12" x2="19.01" y2="12"></line></svg>
              </button>
            </div>
          </>
        )}
        {element.type === 'shape' && (element as any).shapeType === 'rectangle' && (
          <>
            <div className="pod-context-separator"></div>
            <div title={t('contextMenu.borderRadius')} className="pod-context-group">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]"><path d="M10 3H5a2 2 0 0 0-2 2v5" /></svg>
              <input type="range" min="0" max={Math.min((element as any).width, (element as any).height) / 2} value={(element as any).borderRadius || 0} onChange={e => onPropChange(element.id, { borderRadius: parseInt(e.target.value, 10) })} className="pod-context-range" />
              <input type="number" min="0" max={Math.min((element as any).width, (element as any).height) / 2} value={(element as any).borderRadius || 0} onChange={e => onPropChange(element.id, { borderRadius: parseInt(e.target.value, 10) || 0 })} className="pod-context-input" />
            </div>
          </>
        )}
        {element.type === 'text' && <input type="color" title={t('contextMenu.fontColor')} value={(element as any).fontColor} onChange={e => onPropChange(element.id, { fontColor: e.target.value })} className="pod-context-color-input" />}
        {element.type === 'text' && <input type="number" title={t('contextMenu.fontSize')} value={(element as any).fontSize} onChange={e => onPropChange(element.id, { fontSize: parseInt(e.target.value, 10) || 16 })} className="pod-context-input" />}
        {(element.type === 'arrow' || element.type === 'line') && <input type="color" title={t('contextMenu.strokeColor')} value={(element as any).strokeColor} onChange={e => onPropChange(element.id, { strokeColor: e.target.value })} className="pod-context-color-input" />}
        {(element.type === 'arrow' || element.type === 'line') && <input type="range" title={t('contextMenu.strokeWidth')} min="1" max="50" value={(element as any).strokeWidth} onChange={e => onPropChange(element.id, { strokeWidth: parseInt(e.target.value, 10) })} className="pod-context-range" />}
        <div className="pod-context-separator"></div>
        <button title={t('contextMenu.delete')} onClick={() => onDelete(element.id)} className="pod-context-button pod-context-button-danger"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      </div>
    </div>
  );
};

