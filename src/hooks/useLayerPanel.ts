import { useCallback } from 'react'
import type { Dispatch, SetStateAction, MutableRefObject } from 'react'
import type { Element } from '@/types'

type Deps = {
  elementsRef: MutableRefObject<Element[]>
  commitAction: (updater: (prev: Element[]) => Element[]) => void
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>
}

export function useLayerPanel({ elementsRef, commitAction, setSelectedElementIds }: Deps) {
  const handleSelectInPanel = useCallback((id: string | null) => {
    setSelectedElementIds(id ? [id] : [])
  }, [setSelectedElementIds])

  const handleToggleVisibilityInPanel = useCallback((id: string) => {
    const current = elementsRef.current.find(el => el.id === id)?.isVisible ?? true
    commitAction(prev => prev.map(el => (el.id === id ? { ...el, isVisible: !current } : el)))
  }, [elementsRef, commitAction])

  const handleToggleLockInPanel = useCallback((id: string) => {
    const current = elementsRef.current.find(el => el.id === id)?.isLocked ?? false
    commitAction(prev => prev.map(el => (el.id === id ? { ...el, isLocked: !current } : el)))
  }, [elementsRef, commitAction])

  const handleRenameInPanel = useCallback((id: string, name: string) => {
    commitAction(prev => prev.map(el => (el.id === id ? { ...el, name } : el)))
  }, [commitAction])

  const handleReorderInPanel = useCallback((draggedId: string, targetId: string, position: 'before' | 'after') => {
    commitAction(prev => {
      const newElements = [...prev]
      const draggedIndex = newElements.findIndex(el => el.id === draggedId)
      if (draggedIndex === -1) return prev
      const [draggedItem] = newElements.splice(draggedIndex, 1)
      const targetIndex = newElements.findIndex(el => el.id === targetId)
      if (targetIndex === -1) {
        newElements.push(draggedItem)
        return newElements
      }
      const finalIndex = position === 'before' ? targetIndex : targetIndex + 1
      newElements.splice(finalIndex, 0, draggedItem)
      return newElements
    })
  }, [commitAction])

  return { handleSelectInPanel, handleToggleVisibilityInPanel, handleToggleLockInPanel, handleRenameInPanel, handleReorderInPanel }
}
