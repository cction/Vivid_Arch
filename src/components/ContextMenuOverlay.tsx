import React from 'react'
import type { Element } from '@/types'

type Props = {
  contextMenu: { x: number; y: number; elementId: string | null } | null
  elements: Element[]
  selectedElementIds: string[]
  t: (key: string, ...args: unknown[]) => string
  onGroup: () => void
  onUngroup: () => void
  onMergeLayers: (mode: 'selected' | 'visible') => void
  onLayerAction: (elementId: string, action: 'forward' | 'backward' | 'front' | 'back') => void
  onRasterizeSelection: () => void
}

export function ContextMenuOverlay({ contextMenu, elements, selectedElementIds, t, onGroup, onUngroup, onMergeLayers, onLayerAction, onRasterizeSelection }: Props) {
  if (!contextMenu) return null
  const hasDrawableSelection = elements.some(el => selectedElementIds.includes(el.id) && el.type !== 'image' && el.type !== 'video')
  const isGroupable = selectedElementIds.length > 1
  const isUngroupable = selectedElementIds.length === 1 && elements.find(el => el.id === selectedElementIds[0])?.type === 'group'

  return (
    <div style={{ '--pod-top': `${contextMenu.y}px`, '--pod-left': `${contextMenu.x}px` } as React.CSSProperties} className="pod-overlay-position pod-context-menu" onContextMenu={e => e.stopPropagation()}>
      {isGroupable && <button onClick={onGroup} className="pod-context-menu-item">{t('contextMenu.group')}</button>}
      {isGroupable && <button onClick={() => onMergeLayers('selected')} className="pod-context-menu-item">{t('contextMenu.mergeLayers')}</button>}
      {isUngroupable && <button onClick={onUngroup} className="pod-context-menu-item">{t('contextMenu.ungroup')}</button>}
      {(isGroupable || isUngroupable) && <div className="pod-context-divider"></div>}
      {contextMenu.elementId && (
        <>
          <button onClick={() => onLayerAction(contextMenu.elementId!, 'forward')} className="pod-context-menu-item">{t('contextMenu.bringForward')}</button>
          <button onClick={() => onLayerAction(contextMenu.elementId!, 'backward')} className="pod-context-menu-item">{t('contextMenu.sendBackward')}</button>
          <div className="pod-context-divider"></div>
          <button onClick={() => onLayerAction(contextMenu.elementId!, 'front')} className="pod-context-menu-item">{t('contextMenu.bringToFront')}</button>
          <button onClick={() => onLayerAction(contextMenu.elementId!, 'back')} className="pod-context-menu-item">{t('contextMenu.sendToBack')}</button>
        </>
      )}
      {hasDrawableSelection && (
        <>
          <div className="pod-context-divider"></div>
          <button onClick={onRasterizeSelection} className="pod-context-menu-item">{t('contextMenu.rasterize')}</button>
        </>
      )}
    </div>
  )
}

