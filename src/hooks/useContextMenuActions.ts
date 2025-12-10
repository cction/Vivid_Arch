import { useCallback } from 'react'
import type { Dispatch, SetStateAction, MutableRefObject } from 'react'
import type { Element, ImageElement, VideoElement } from '@/types'
import { getElementBounds, rasterizeElements } from '@/utils/canvas'

type Deps = {
  elementsRef: MutableRefObject<Element[]>
  selectedElementIds: string[]
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>
  commitAction: (updater: (prev: Element[]) => Element[]) => void
  setIsLoading: Dispatch<SetStateAction<boolean>>
  setError: Dispatch<SetStateAction<string | null>>
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; elementId: string | null } | null>>
  generateId: () => string
}

export function useContextMenuActions({ elementsRef, selectedElementIds, setSelectedElementIds, commitAction, setIsLoading, setError, setContextMenu, generateId }: Deps) {
  const handleLayerAction = useCallback((elementId: string, action: 'front' | 'back' | 'forward' | 'backward') => {
    commitAction(prev => {
      const elementsCopy = [...prev]
      const index = elementsCopy.findIndex(el => el.id === elementId)
      if (index === -1) return elementsCopy
      const [element] = elementsCopy.splice(index, 1)
      if (action === 'front') {
        elementsCopy.push(element)
      } else if (action === 'back') {
        elementsCopy.unshift(element)
      } else if (action === 'forward') {
        const newIndex = Math.min(elementsCopy.length, index + 1)
        elementsCopy.splice(newIndex, 0, element)
      } else if (action === 'backward') {
        const newIndex = Math.max(0, index - 1)
        elementsCopy.splice(newIndex, 0, element)
      }
      return elementsCopy
    })
    setContextMenu(null)
  }, [commitAction, setContextMenu])

  const handleRasterizeSelection = useCallback(async () => {
    const elementsToRasterize = elementsRef.current.filter(
      el => selectedElementIds.includes(el.id) && el.type !== 'image' && el.type !== 'video'
    ) as Exclude<Element, ImageElement | VideoElement>[]
    if (elementsToRasterize.length === 0) return
    setContextMenu(null)
    setIsLoading(true)
    setError(null)
    try {
      let minX = Infinity, minY = Infinity
      elementsToRasterize.forEach(element => {
        const bounds = getElementBounds(element)
        minX = Math.min(minX, bounds.x)
        minY = Math.min(minY, bounds.y)
      })
      const { href, mimeType, width, height } = await rasterizeElements(elementsToRasterize)
      const newImage: ImageElement = { id: generateId(), type: 'image', name: 'Rasterized Image', x: minX - 10, y: minY - 10, width, height, href, mimeType }
      const idsToRemove = new Set(elementsToRasterize.map(el => el.id))
      commitAction(prev => {
        const remainingElements = prev.filter(el => !idsToRemove.has(el.id))
        return [...remainingElements, newImage]
      })
      setSelectedElementIds([newImage.id])
    } catch (err) {
      const error = err as Error
      setError(`Failed to rasterize selection: ${error.message}`)
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [elementsRef, selectedElementIds, setContextMenu, setIsLoading, setError, commitAction, setSelectedElementIds, generateId])

  return { handleLayerAction, handleRasterizeSelection }
}
