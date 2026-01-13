import { useCallback } from 'react'
import type React from 'react'
import type { MutableRefObject, Dispatch, SetStateAction } from 'react'
import type { Element, ImageElement, Point, Tool } from '@/types'
import { getElementBounds } from '@/utils/canvas'
import { fileToDataUrl } from '@/utils/fileUtils'
import { resizeBase64ToMax, getImageSize, PLACEHOLDER_DATA_URL, getImageSizeFromBlob, resizeBlobToMax } from '@/utils/image'
import { getUiRadiusLg } from '@/ui/standards'

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
  type ItemInfo = { file: File; mimeType: string; width: number; height: number; scale: number; dataUrl?: string }
  const handleAddImageElement = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported.')
      return
    }
    setError(null)
    try {
      const { dataUrl, mimeType } = await fileToDataUrl(file)
      const resized = await resizeBase64ToMax(dataUrl, mimeType, 2560, 2560)
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
        borderRadius: getUiRadiusLg(),
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
    const infoFns: Array<() => Promise<ItemInfo>> = imageFiles.map((file) => {
      return async () => {
        const mimeType = file.type || 'image/png'
        const size = await getImageSizeFromBlob(file)
        if (size && size.width && size.height) {
          const scale = Math.min(2560 / size.width, 2560 / size.height, 1)
          const w = Math.max(1, Math.floor(size.width * scale))
          const h = Math.max(1, Math.floor(size.height * scale))
          analyzed++
          if (setProgressMessage) setProgressMessage(`Analyzed ${analyzed}/${imageFiles.length}`)
          return { file, mimeType, width: w, height: h, scale }
        }
        const { dataUrl } = await fileToDataUrl(file)
        const s2 = await getImageSize(dataUrl, mimeType)
        if (!s2 || !s2.width || !s2.height) throw new Error('image load error')
        const scale = Math.min(2560 / s2.width, 2560 / s2.height, 1)
        const w = Math.max(1, Math.floor(s2.width * scale))
        const h = Math.max(1, Math.floor(s2.height * scale))
        analyzed++
        if (setProgressMessage) setProgressMessage(`Analyzed ${analyzed}/${imageFiles.length}`)
        return { file, mimeType, dataUrl, width: w, height: h, scale }
      }
    })
    const totalBytesRaw = imageFiles.reduce((s, f) => s + (f.size || 0), 0)
    const hc = (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number') ? navigator.hardwareConcurrency : 4
    const baseLimit = Math.max(2, Math.min(6, Math.floor(hc / 2)))
    const limit = totalBytesRaw > 209715200 ? 1 : baseLimit
    const items = await runWithConcurrency(infoFns, limit)
    const pm2 = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
    const totalBytes = imageFiles.reduce((s, f) => s + (f.size || 0), 0)
    if (pm2) console.log('[DragImport] analyzed items', { count: items.length, totalBytes, mem: pm2 })
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
      newElements.push({ id, type: 'image', name: items[i].file.name, x, y, width: items[i].width, height: items[i].height, href: placeholderHref, mimeType: items[i].mimeType, borderRadius: getUiRadiusLg(), opacity: 100 })
    }
    setElements(prev => [...prev, ...newElements])
    setSelectedElementIds(newIds)
    setActiveTool('select')
    if (setProgressMessage) setProgressMessage('Loading previews...')
    let previewed = 0
    const previewFns = items.map((it: ItemInfo, idx: number) => {
      return async () => {
        let thHref: string | null = null
        if (it.dataUrl) {
          const thumb = await resizeBase64ToMax(it.dataUrl, it.mimeType, 128, 128)
          thHref = thumb && thumb.scale < 1 ? `data:${it.mimeType};base64,${thumb.base64}` : it.dataUrl
        } else {
          const thumb = await resizeBlobToMax(it.file, it.mimeType, 128, 128)
          thHref = thumb ? thumb.dataUrl : null
        }
        if (thHref) setElements(prev => prev.map(el => (el.id === newIds[idx] ? { ...el, href: thHref } : el)))
        previewed++
        if (setProgressMessage) setProgressMessage(`Loaded previews ${previewed}/${n}`)
      }
    })
    await runWithConcurrency(previewFns, limit)
    if (setProgressMessage) setProgressMessage('Importing images...')
    let imported = 0
    const updateFns = items.map((it: ItemInfo, idx: number) => {
      return async () => {
        if (it.scale >= 1) {
          const url = URL.createObjectURL(it.file)
          setElements(prev => prev.map(el => (el.id === newIds[idx] ? { ...el, href: url } : el)))
        } else {
          if (it.dataUrl) {
            const resized = await resizeBase64ToMax(it.dataUrl, it.mimeType, 2560, 2560)
            const used = resized && resized.scale < 1 ? `data:${it.mimeType};base64,${resized.base64}` : it.dataUrl
            setElements(prev => prev.map(el => (el.id === newIds[idx] ? { ...el, href: used } : el)))
          } else {
            const resized = await resizeBlobToMax(it.file, it.mimeType, 2560, 2560)
            const used = resized ? resized.dataUrl : undefined
            if (used) setElements(prev => prev.map(el => (el.id === newIds[idx] ? { ...el, href: used } : el)))
          }
        }
        imported++
        if (setProgressMessage) setProgressMessage(`Imported ${imported}/${n}`)
      }
    })
    await runWithConcurrency(updateFns, limit)
    if (setIsLoading) setIsLoading(false)
    if (setProgressMessage) setProgressMessage('')
  }, [svgRef, getCanvasPoint, setElements, setSelectedElementIds, setActiveTool, setError, generateId, elementsRef, setIsLoading, setProgressMessage])

  const getDragFlags = (dt: DataTransfer | null) => {
    const types = Array.from(dt?.types || []).map(t => String(t || '').toLowerCase())
    const hasFiles = types.includes('files') || types.includes('application/x-moz-file')
    const hasUriList = types.includes('text/uri-list') || types.includes('public.file-url')
    const hasPlain = types.includes('text/plain')
    return { hasFiles, hasUriList, hasPlain }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const flags = getDragFlags(e.dataTransfer)
    if (flags.hasFiles || flags.hasUriList) {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      setElements(prev => prev.filter(el => !(el.type === 'image' && el.name === '[DragPreview]')))
      return
    }
    if (flags.hasPlain) {
      e.preventDefault()
      return
    }
  }, [setElements])
  const handleDrop = useCallback((e: React.DragEvent) => {
    const flags = getDragFlags(e.dataTransfer)
    if (!flags.hasFiles && !flags.hasUriList && !flags.hasPlain) return
    if (flags.hasFiles || flags.hasUriList) {
      e.preventDefault()
      e.stopPropagation()
    }
    try {
      const targ = e.target
      const tn = targ instanceof globalThis.Element ? targ.nodeName : ''
      const isFO = targ instanceof globalThis.Element ? Boolean(targ.closest('foreignObject')) : false
      console.log('[DragImport] drop', tn, isFO)
    } catch { void 0 }
    if (flags.hasFiles || flags.hasUriList) {
      setElements(prev => prev.filter(el => !(el.type === 'image' && el.name === '[DragPreview]')))
    }
    const pm = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
    if (pm) console.log('[DragImport] mem before drop', pm)
    const dt = e.dataTransfer
    let files: File[] = []
    if (dt?.items && dt.items.length > 0) {
      const items: DataTransferItem[] = Array.from(dt.items)
      files = items.map((it: DataTransferItem) => it.kind === 'file' ? it.getAsFile() : null).filter((f): f is File => !!f)
    }
    if ((!files || files.length === 0) && dt && dt.files && dt.files.length > 0) {
      files = Array.from(dt.files)
    }
    if (files && files.length > 0) {
      console.log('[DragImport] drop files', files.map(f => ({ name: f.name, type: f.type })), 'at', { x: e.clientX, y: e.clientY })
      const anchor = getCanvasPoint(e.clientX, e.clientY)
      console.log('[DragImport] anchor canvas point', anchor)
      handleAddImageElements(files, anchor)
    } else {
      const dtAny = dt as unknown as { getData?: (t: string) => string }
      const raw = dtAny && typeof dtAny.getData === 'function' ? (dtAny.getData('text/uri-list') || dtAny.getData('text/plain')) : ''
      const url = (raw || '')
        .split('\n')
        .map(s => s.trim())
        .find(s => s && !s.startsWith('#')) || ''
      if (url && /^https?:\/\//i.test(url) && !(flags.hasFiles || flags.hasUriList)) {
        e.preventDefault()
        e.stopPropagation()
      }
      if (url && /^https?:\/\/.*\.(png|jpe?g|gif|webp|bmp|tiff)(\?.*)?$/i.test(url)) {
        fetch(url)
          .then(r => r.blob())
          .then(blob => {
            const name = url.split('/').pop() || 'Dropped Image'
            const f = new File([blob], name, { type: blob.type || 'image/png' })
            const anchor2 = getCanvasPoint(e.clientX, e.clientY)
            handleAddImageElements([f], anchor2)
          })
          .catch(() => { void 0 })
      } else if (url && /^https?:\/\//i.test(url)) {
        console.log('[DragImport] url no-ext or unknown content-type candidate', url)
        fetch(url)
          .then(r => r.blob())
          .then(blob => {
            const tp = blob.type || ''
            if (tp.toLowerCase().startsWith('image/')) {
              const name = url.split('/').pop() || 'Dropped Image'
              const f = new File([blob], name, { type: tp || 'image/png' })
              const anchor2 = getCanvasPoint(e.clientX, e.clientY)
              handleAddImageElements([f], anchor2)
            }
          })
          .catch(() => { void 0 })
      }
    }
  }, [getCanvasPoint, handleAddImageElements, setElements])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const flags = getDragFlags(e.dataTransfer)
    if (!(flags.hasFiles || flags.hasUriList)) return
    e.preventDefault()
    e.stopPropagation()
    setElements(prev => prev.filter(el => !(el.type === 'image' && el.name === '[DragPreview]')))
  }, [setElements])

  return { handleAddImageElement, handleDragOver, handleDrop, handleDragLeave }
}
