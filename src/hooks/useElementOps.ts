import { useCallback } from 'react'
import type { Element, ImageElement } from '@/types'

type Deps = {
  commitAction: (updater: (prev: Element[]) => Element[]) => void
}

export function useElementOps({ commitAction }: Deps) {
  const handlePropertyChange = useCallback((elementId: string, updates: Partial<Element>) => {
    commitAction(prev => prev.map(el => (el.id === elementId ? ({ ...el, ...updates } as Element) : el)))
  }, [commitAction])

  const handleDownloadImage = useCallback((element: ImageElement) => {
    const link = document.createElement('a')
    link.href = element.href
    const ext = (element.mimeType && element.mimeType.split('/')[1]) || 'png'
    link.download = `canvas-image-${element.id}.${ext}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  return { handlePropertyChange, handleDownloadImage }
}
