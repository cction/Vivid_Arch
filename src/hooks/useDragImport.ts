import { useCallback } from 'react'
import type React from 'react'
import type { MutableRefObject, Dispatch, SetStateAction } from 'react'
import type { Element, ImageElement, Point, Tool } from '@/types'
import { getElementBounds } from '@/utils/canvas'
import { fileToDataUrl } from '@/utils/fileUtils'
import { resizeBase64ToMax, getImageSize, PLACEHOLDER_DATA_URL } from '@/utils/image'

type Deps = {
  svgRef: MutableRefObject<SVGSVGElement | null>
  getCanvasPoint: (x: number, y: number) => Point
  setElements: (updater: (prev: Element[]) => Element[]) => void
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>
  setActiveTool: Dispatch<SetStateAction<Tool>>
  setError: Dispatch<SetStateAction<string | null>>
  setIsLoading?: Dispatch<SetStateAction<boolean>>
  setProgressMessage?: Dispatch<SetStateAction<string>>
  generateId: () => string
  elementsRef: MutableRefObject<Element[]>
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null)
  let nextIndex = 0
  let inFlight = 0
  return await new Promise<T[]>((resolve) => {
    const schedule = () => {
      while (inFlight < limit && nextIndex < tasks.length) {
        const cur = nextIndex++
        inFlight++
        tasks[cur]().then((res) => {
          results[cur] = res
        }).catch(() => {
          results[cur] = null
        }).finally(() => {
          inFlight--
          if (nextIndex >= tasks.length && inFlight === 0) {
            resolve(results.filter((r): r is T => r !== null))
          } else {
            schedule()
          }
        })
      }
    }
    schedule()
  })
}

export function useDragImport({ svgRef, getCanvasPoint, setElements, setSelectedElementIds, setActiveTool, setError, setIsLoading, setProgressMessage, generateId, elementsRef }: Deps) {
  const handleAddImageElement = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported.')
      return
    }
    setError(null)
    try {
      const { dataUrl, mimeType } = await fileToDataUrl(file)
      const resized = await resizeBase64ToMax(dataUrl, mimeType, 2048, 2048)
      const usedDataUrl = resized && resized.scale < 1 ? `data:${mimeType};base64,${resized.base64}` : dataUrl
      const dims = resized ? { width: resized.width, height: resized.height } : await getImageSize(dataUrl, mimeType)
      if (!dims || !dims.width || !dims.height) { setError('Failed to load image.'); return }
      if (!svgRef.current) return
      const svgBounds = svgRef.current.getBoundingClientRect()
      const screenCenter = { x: svgBounds.left + svgBounds.width / 2, y: svgBounds.top + svgBounds.height / 2 }
      const canvasPoint = getCanvasPoint(screenCenter.x, screenCenter.y)
      const newImage: ImageElement = {
        id: generateId(),
        type: 'image',
        name: file.name,
        x: canvasPoint.x - dims.width / 2,
        y: canvasPoint.y - dims.height / 2,
        width: dims.width,
        height: dims.height,
        href: usedDataUrl,
        mimeType,
        opacity: 100,
      }
      setElements(prev => [...prev, newImage])
      setSelectedElementIds([newImage.id])
      setActiveTool('select')
    } catch (err) {
      setError('Failed to load image.')
      console.error(err)
    }
  }, [svgRef, getCanvasPoint, setElements, setSelectedElementIds, setActiveTool, setError, generateId])

  const handleAddImageElements = useCallback(async (files: File[], anchor?: Point) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|tiff)$/i.test(f.name))
    if (imageFiles.length === 0) { setError('Only image files are supported.'); return }
    setError(null)
    if (setIsLoading) setIsLoading(true)
    if (setProgressMessage) setProgressMessage('Analyzing images...')
    let analyzed = 0
    const infoFns = imageFiles.map((file) => {
      return async () => {
        const { dataUrl, mimeType } = await fileToDataUrl(file)
        const size = await getImageSize(dataUrl, mimeType)
        if (!size || !size.width || !size.height) throw new Error('image load error')
        const scale = Math.min(2048 / size.width, 2048 / size.height, 1)
        const w = Math.max(1, Math.floor(size.width * scale))
        const h = Math.max(1, Math.floor(size.height * scale))
        analyzed++
        if (setProgressMessage) setProgressMessage(`Analyzed ${analyzed}/${imageFiles.length}`)
        return { file, mimeType, dataUrl, width: w, height: h, scale }
      }
    })
    const hc = (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number') ? navigator.hardwareConcurrency : 4
    const limit = Math.max(2, Math.min(6, Math.floor(hc / 2)))
    const items = await runWithConcurrency(infoFns, limit)
    if (items.length === 0) { setError('Failed to load image.'); if (setIsLoading) setIsLoading(false); if (setProgressMessage) setProgressMessage(''); return }
    if (!svgRef.current) return
    const svgBounds = svgRef.current.getBoundingClientRect()
    const centerScreen = { x: svgBounds.left + svgBounds.width / 2, y: svgBounds.top + svgBounds.height / 2 }
    const anchorPoint = anchor || getCanvasPoint(centerScreen.x, centerScreen.y)
    const n = items.length
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)))
    const rows = Math.max(1, Math.ceil(n / cols))
    const colWidths: number[] = Array.from({ length: cols }, () => 0)
    const rowHeights: number[] = Array.from({ length: rows }, () => 0)
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols)
      const c = i % cols
      rowHeights[r] = Math.max(rowHeights[r], items[i].height)
      colWidths[c] = Math.max(colWidths[c], items[i].width)
    }
    const gapX = 32
    const gapY = 32
    const totalW = colWidths.reduce((a, b) => a + b, 0) + (cols - 1) * gapX
    const totalH = rowHeights.reduce((a, b) => a + b, 0) + (rows - 1) * gapY
    let startX = anchorPoint.x - totalW / 2
    let startY = anchorPoint.y - totalH / 2
    const colPrefix: number[] = []
    const rowPrefix: number[] = []
    for (let i = 0, acc = 0; i < cols; i++) { colPrefix[i] = acc; acc += colWidths[i] }
    for (let i = 0, acc = 0; i < rows; i++) { rowPrefix[i] = acc; acc += rowHeights[i] }
    const buildRects = (offsetX: number, offsetY: number) => {
      const rects: { x: number; y: number; w: number; h: number }[] = []
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / cols)
        const c = i % cols
        const x = startX + colPrefix[c] + c * gapX + offsetX
        const y = startY + rowPrefix[r] + r * gapY + offsetY
        rects.push({ x, y, w: items[i].width, h: items[i].height })
      }
      return rects
    }
    const existingRects = elementsRef.current
      .filter(el => el.isVisible !== false)
      .map(el => getElementBounds(el, elementsRef.current))
    const overlapsAny = (rects: { x: number; y: number; w: number; h: number }[]) => {
      for (let i = 0; i < rects.length; i++) {
        const a = rects[i]
        for (let j = 0; j < existingRects.length; j++) {
          const b = existingRects[j]
          const inter = a.x < b.x + b.width && a.x + a.w > b.x && a.y < b.y + b.height && a.y + a.h > b.y
          if (inter) return true
        }
      }
      return false
    }
    let bestOffsetX = 0
    let bestOffsetY = 0
    const maxAttempts = 200
    let placed = false
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const dx = (attempt % 20) * gapX
      const dy = Math.floor(attempt / 20) * gapY
      const candidate = buildRects(dx, dy)
      if (!overlapsAny(candidate)) { bestOffsetX = dx; bestOffsetY = dy; placed = true; break }
    }
    if (!placed) {
      const candidate = buildRects(0, 0)
      if (overlapsAny(candidate)) { bestOffsetY = rowHeights[0] + gapY } else { bestOffsetX = 0; bestOffsetY = 0 }
    }
    const newElements: ImageElement[] = []
    const newIds: string[] = []
    const placeholderHref = PLACEHOLDER_DATA_URL
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols)
      const c = i % cols
      const x = startX + colPrefix[c] + c * gapX + bestOffsetX
      const y = startY + rowPrefix[r] + r * gapY + bestOffsetY
      const id = generateId()
      newIds.push(id)
      newElements.push({ id, type: 'image', name: items[i].file.name, x, y, width: items[i].width, height: items[i].height, href: placeholderHref, mimeType: items[i].mimeType, opacity: 100 })
    }
    setElements(prev => [...prev, ...newElements])
    setSelectedElementIds(newIds)
    setActiveTool('select')
    if (setProgressMessage) setProgressMessage('Loading previews...')
    let previewed = 0
    const previewFns = items.map((it, idx) => {
      return async () => {
        const thumb = await resizeBase64ToMax(it.dataUrl, it.mimeType, 128, 128)
        const thHref = thumb && thumb.scale < 1 ? `data:${it.mimeType};base64,${thumb.base64}` : it.dataUrl
        setElements(prev => prev.map(el => (el.id === newIds[idx] ? { ...el, href: thHref } : el)))
        previewed++
        if (setProgressMessage) setProgressMessage(`Loaded previews ${previewed}/${n}`)
      }
    })
    await runWithConcurrency(previewFns, limit)
    if (setProgressMessage) setProgressMessage('Importing images...')
    let imported = 0
    const updateFns = items.map((it, idx) => {
      return async () => {
        if (it.scale >= 1) {
          setElements(prev => prev.map(el => (el.id === newIds[idx] ? { ...el, href: it.dataUrl } : el)))
        } else {
          const resized = await resizeBase64ToMax(it.dataUrl, it.mimeType, 2048, 2048)
          const used = resized && resized.scale < 1 ? `data:${it.mimeType};base64,${resized.base64}` : it.dataUrl
          setElements(prev => prev.map(el => (el.id === newIds[idx] ? { ...el, href: used } : el)))
        }
        imported++
        if (setProgressMessage) setProgressMessage(`Imported ${imported}/${n}`)
      }
    })
    await runWithConcurrency(updateFns, limit)
    if (setIsLoading) setIsLoading(false)
    if (setProgressMessage) setProgressMessage('')
  }, [svgRef, getCanvasPoint, setElements, setSelectedElementIds, setActiveTool, setError, generateId, elementsRef, setIsLoading, setProgressMessage])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dt = e.dataTransfer
    const items = dt && dt.items ? Array.from(dt.items) : []
    let count = 0
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it.kind === 'file') {
        const tp = (it.type || '').toLowerCase()
        if (tp.startsWith('image/') || tp === '') count++
      }
    }
    if (count <= 0) {
      setElements(prev => prev.filter(el => !(el.type === 'image' && el.name === '[DragPreview]')))
      return
    }
    if (!svgRef.current) return
    const anchor = getCanvasPoint(e.clientX, e.clientY)
    const n = count
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)))
    const rows = Math.max(1, Math.ceil(n / cols))
    const w = 128
    const h = 128
    const colWidths: number[] = Array.from({ length: cols }, () => 0)
    const rowHeights: number[] = Array.from({ length: rows }, () => 0)
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols)
      const c = i % cols
      rowHeights[r] = Math.max(rowHeights[r], h)
      colWidths[c] = Math.max(colWidths[c], w)
    }
    const gapX = 32
    const gapY = 32
    const totalW = colWidths.reduce((a, b) => a + b, 0) + (cols - 1) * gapX
    const totalH = rowHeights.reduce((a, b) => a + b, 0) + (rows - 1) * gapY
    const startX = anchor.x - totalW / 2
    const startY = anchor.y - totalH / 2
    const colPrefix: number[] = []
    const rowPrefix: number[] = []
    for (let i = 0, acc = 0; i < cols; i++) { colPrefix[i] = acc; acc += colWidths[i] }
    for (let i = 0, acc = 0; i < rows; i++) { rowPrefix[i] = acc; acc += rowHeights[i] }
    const existingRects = elementsRef.current
      .filter(el => el.isVisible !== false)
      .map(el => getElementBounds(el, elementsRef.current))
    const overlapsAny = (rects: { x: number; y: number; w: number; h: number }[]) => {
      for (let i = 0; i < rects.length; i++) {
        const a = rects[i]
        for (let j = 0; j < existingRects.length; j++) {
          const b = existingRects[j]
          const inter = a.x < b.x + b.width && a.x + a.w > b.x && a.y < b.y + b.height && a.y + a.h > b.y
          if (inter) return true
        }
      }
      return false
    }
    let bestOffsetX = 0
    let bestOffsetY = 0
    const maxAttempts = 60
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const dx = (attempt % 10) * gapX
      const dy = Math.floor(attempt / 10) * gapY
      const rects: { x: number; y: number; w: number; h: number }[] = []
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / cols)
        const c = i % cols
        const x = startX + colPrefix[c] + c * gapX + dx
        const y = startY + rowPrefix[r] + r * gapY + dy
        rects.push({ x, y, w, h })
      }
      if (!overlapsAny(rects)) { bestOffsetX = dx; bestOffsetY = dy; break }
    }
    const previews: ImageElement[] = []
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols)
      const c = i % cols
      const x = startX + colPrefix[c] + c * gapX + bestOffsetX
      const y = startY + rowPrefix[r] + r * gapY + bestOffsetY
      previews.push({ id: generateId(), type: 'image', name: '[DragPreview]', x, y, width: w, height: h, href: PLACEHOLDER_DATA_URL, mimeType: 'image/png', opacity: 60 })
    }
    setElements(prev => {
      const cleaned = prev.filter(el => !(el.type === 'image' && el.name === '[DragPreview]'))
      return [...cleaned, ...previews]
    })
  }, [svgRef, getCanvasPoint, setElements, elementsRef, generateId])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setElements(prev => prev.filter(el => !(el.type === 'image' && el.name === '[DragPreview]')))
    const dt = e.dataTransfer
    let files: File[] = []
    if (dt && dt.items && dt.items.length > 0) {
      files = Array.from(dt.items).map(it => it.kind === 'file' ? it.getAsFile() : null).filter((f): f is File => !!f)
    }
    if ((!files || files.length === 0) && dt && dt.files && dt.files.length > 0) {
      files = Array.from(dt.files)
    }
    if (files && files.length > 0) {
      const anchor = getCanvasPoint(e.clientX, e.clientY)
      handleAddImageElements(files, anchor)
    }
  }, [getCanvasPoint, handleAddImageElements, setElements])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setElements(prev => prev.filter(el => !(el.type === 'image' && el.name === '[DragPreview]')))
  }, [setElements])

  return { handleAddImageElement, handleDragOver, handleDrop, handleDragLeave }
}
