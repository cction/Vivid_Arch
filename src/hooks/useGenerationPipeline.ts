import { useCallback } from 'react'
import type { Dispatch, SetStateAction, MutableRefObject } from 'react'
import type { Element, ImageElement, PathElement, VideoElement, Point } from '@/types'
import { rasterizeElement, getElementBounds } from '@/utils/canvas'
import { loadImageWithFallback, PLACEHOLDER_DATA_URL } from '@/utils/image'
import { editImage as editImageWhatai, generateImageFromText as generateImageFromTextWhatai, generateVideo } from '@/services/api/geminiService'
import { getUiRadiusLg } from '@/ui/standards'
import { editImage as editImageGrsai, generateImageFromText as generateImageFromTextGrsai } from '@/services/api/grsaiService'

type Deps = {
  svgRef: MutableRefObject<SVGSVGElement | null>
  getCanvasPoint: (x: number, y: number) => Point
  elementsRef: MutableRefObject<Element[]>
  selectedElementIds: string[]
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>
  commitAction: (updater: (prev: Element[]) => Element[]) => void
  setIsLoading: Dispatch<SetStateAction<boolean>>
  setProgressMessage: Dispatch<SetStateAction<string>>
  setError: Dispatch<SetStateAction<string | null>>
  prompt: string
  generationMode: 'image' | 'video'
  videoAspectRatio: string
  imageAspectRatio: string | null
  imageSize: '1K' | '2K' | '4K'
  imageModel: string
  apiProvider: 'WHATAI' | 'Grsai'
  generateId: () => string
}

const PRO_1K_SIZES: Record<string, { w: number; h: number }> = {
  '1:1': { w: 1024, h: 1024 },
  '2:3': { w: 848, h: 1264 },
  '3:2': { w: 1264, h: 848 },
  '3:4': { w: 896, h: 1200 },
  '4:3': { w: 1200, h: 896 },
  '4:5': { w: 928, h: 1152 },
  '5:4': { w: 1152, h: 928 },
  '9:16': { w: 768, h: 1376 },
  '16:9': { w: 1376, h: 768 },
  '21:9': { w: 1584, h: 672 },
}

const FLASH_1K_SIZES: Record<string, { w: number; h: number }> = {
  '1:1': { w: 1024, h: 1024 },
  '2:3': { w: 832, h: 1248 },
  '3:2': { w: 1248, h: 832 },
  '3:4': { w: 864, h: 1184 },
  '4:3': { w: 1184, h: 864 },
  '4:5': { w: 896, h: 1152 },
  '5:4': { w: 1152, h: 896 },
  '9:16': { w: 768, h: 1344 },
  '16:9': { w: 1344, h: 768 },
  '21:9': { w: 1536, h: 672 },
}

function getPlaceholderSize(model: string, size: '1K' | '2K' | '4K', aspectRatio: string | undefined): { width: number; height: number } {
  const isProModel = model === 'nano-banana-pro' || model === 'nano-banana-2'
  const ar = aspectRatio || '1:1'
  const base = isProModel ? (PRO_1K_SIZES[ar] || PRO_1K_SIZES['1:1']) : (FLASH_1K_SIZES[ar] || FLASH_1K_SIZES['1:1'])
  const effectiveSize: '1K' | '2K' | '4K' = isProModel ? size : '1K'
  const multiplier = effectiveSize === '4K' ? 4 : effectiveSize === '2K' ? 2 : 1
  return { width: base.w * multiplier, height: base.h * multiplier }
}

function rasterizeMask(maskPaths: PathElement[], baseImage: ImageElement): Promise<{ href: string; mimeType: 'image/png' }> {
  return new Promise((resolve, reject) => {
    const { width, height, x: imageX, y: imageY } = baseImage
    if (width <= 0 || height <= 0) {
      return reject(new Error('Base image has invalid dimensions.'))
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return reject(new Error('Could not get canvas context for mask.'))
    }
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = 'white'
    ctx.fillStyle = 'white'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    maskPaths.forEach(path => {
      ctx.lineWidth = path.strokeWidth
      ctx.beginPath()
      if (path.points.length === 1) {
        const point = path.points[0]
        ctx.arc(point.x - imageX, point.y - imageY, path.strokeWidth / 2, 0, 2 * Math.PI)
        ctx.fill()
      } else if (path.points.length > 1) {
        const startPoint = path.points[0]
        ctx.moveTo(startPoint.x - imageX, startPoint.y - imageY)
        for (let i = 1; i < path.points.length; i++) {
          const point = path.points[i]
          ctx.lineTo(point.x - imageX, point.y - imageY)
        }
        ctx.stroke()
      }
    })
    resolve({ href: canvas.toDataURL('image/png'), mimeType: 'image/png' })
  })
}

export function useGenerationPipeline({ svgRef, getCanvasPoint, elementsRef, selectedElementIds, setSelectedElementIds, commitAction, setIsLoading, setProgressMessage, setError, prompt, generationMode, videoAspectRatio, imageAspectRatio, imageSize, imageModel, apiProvider, generateId }: Deps) {
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt.')
      return
    }
    setIsLoading(true)
    setError(null)
    setProgressMessage('Starting generation...')
    if (generationMode === 'video') {
      if (apiProvider === 'Grsai') {
        setError('当前提供方不支持视频生成，请切换到 WHATAI')
        setIsLoading(false)
        return
      }
      try {
        const selectedElements = elementsRef.current.filter(el => selectedElementIds.includes(el.id))
        const imageElement = selectedElements.find(el => el.type === 'image') as ImageElement | undefined
        if (selectedElementIds.length > 1 || (selectedElementIds.length === 1 && !imageElement)) {
          setError('For video generation, please select a single image or no elements.')
          setIsLoading(false)
          return
        }
        const { videoBlob, mimeType } = await generateVideo(prompt, videoAspectRatio as '16:9' | '9:16', (message) => setProgressMessage(message), imageElement ? { href: imageElement.href, mimeType: imageElement.mimeType } : undefined)
        setProgressMessage('Processing video...')
        const videoUrl = URL.createObjectURL(videoBlob)
        const video = document.createElement('video')
        video.onloadedmetadata = () => {
          if (!svgRef.current) return
          let newWidth = video.videoWidth
          let newHeight = video.videoHeight
          const MAX_DIM = 800
          if (newWidth > MAX_DIM || newHeight > MAX_DIM) {
            const ratio = newWidth / newHeight
            if (ratio > 1) {
              newWidth = MAX_DIM
              newHeight = MAX_DIM / ratio
            } else {
              newHeight = MAX_DIM
              newWidth = MAX_DIM * ratio
            }
          }
          const svgBounds = svgRef.current.getBoundingClientRect()
          const screenCenter = { x: svgBounds.left + svgBounds.width / 2, y: svgBounds.top + svgBounds.height / 2 }
          const canvasPoint = getCanvasPoint(screenCenter.x, screenCenter.y)
          const x = canvasPoint.x - (newWidth / 2)
          const y = canvasPoint.y - (newHeight / 2)
          const newVideoElement: VideoElement = { id: generateId(), type: 'video', name: 'Generated Video', x, y, width: newWidth, height: newHeight, href: videoUrl, mimeType }
          commitAction(prev => [...prev, newVideoElement])
          setSelectedElementIds([newVideoElement.id])
          setIsLoading(false)
        }
        video.onerror = () => {
          setError('Could not load generated video metadata.')
          setIsLoading(false)
        }
        video.src = videoUrl
      } catch (err) {
        const error = err as Error
        setError(`Video generation failed: ${error.message}`)
        console.error(err)
        setIsLoading(false)
      }
      return
    }
    try {
      const isEditing = selectedElementIds.length > 0
      if (isEditing) {
        const selectedElements = elementsRef.current.filter(el => selectedElementIds.includes(el.id))
        const imageElements = selectedElements.filter(el => el.type === 'image') as ImageElement[]
        const maskPaths = selectedElements.filter(el => el.type === 'path' && (el as PathElement).strokeOpacity && (el as PathElement).strokeOpacity! < 1) as PathElement[]
        if (imageElements.length === 1 && maskPaths.length > 0 && selectedElements.length === (1 + maskPaths.length)) {
          const baseImage = imageElements[0]
          const maskData = await rasterizeMask(maskPaths, baseImage)
          if (apiProvider === 'Grsai') {
            setError('当前提供方不支持局部重绘（mask）')
            setIsLoading(false)
            return
          }
          commitAction(prev => prev.map(el => {
            if (el.id === baseImage.id && el.type === 'image') {
              return { ...el, isGenerating: true }
            }
            return el
          }))
          const dbg = typeof window !== 'undefined' ? (localStorage.getItem('debug.gen.fail') || '') : ''
          if (dbg) {
            setError(dbg === 'load' ? 'Failed to load the generated image.' : 'Inpainting failed to produce an image.')
            commitAction(prev => prev.map(el => {
              if (el.id === baseImage.id && el.type === 'image') {
                return { ...el, isGenerating: undefined }
              }
              return el
            }))
            return
          }
          const result = await editImageWhatai(prompt, [{ href: baseImage.href, mimeType: baseImage.mimeType }], { imageSize, mask: { href: maskData.href, mimeType: maskData.mimeType }, model: imageModel })
          if (result.newImageBase64 && result.newImageMimeType) {
            const { newImageBase64, newImageMimeType } = result
            loadImageWithFallback(newImageBase64, newImageMimeType).then(({ img, href }) => {
              const maskPathIds = new Set(maskPaths.map(p => p.id))
              try {
                console.log('[GenPipeline][mask] dims', { before: { width: baseImage.width, height: baseImage.height }, after: { width: img.width, height: img.height } })
              } catch { void 0 }
              commitAction(prev => prev.map(el => {
                if (el.id === baseImage.id && el.type === 'image') {
                  return { ...el, href, width: img.width, height: img.height, isGenerating: undefined }
                }
                return el
              }).filter(el => !maskPathIds.has(el.id)))
              setSelectedElementIds([baseImage.id])
            }).catch(() => {
              setError('Failed to load the generated image.')
              commitAction(prev => prev.map(el => {
                if (el.id === baseImage.id && el.type === 'image') {
                  return { ...el, isGenerating: undefined }
                }
                return el
              }))
            })
          } else {
            setError(result.textResponse || 'Inpainting failed to produce an image.')
            commitAction(prev => prev.map(el => {
              if (el.id === baseImage.id && el.type === 'image') {
                return { ...el, isGenerating: undefined }
              }
              return el
            }))
          }
          return
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity
        selectedElements.forEach(el => {
          const bounds = getElementBounds(el)
          minX = Math.min(minX, bounds.x)
          minY = Math.min(minY, bounds.y)
          maxX = Math.max(maxX, bounds.x + bounds.width)
        })
        let baseWidth = Math.max(1, maxX - minX)
        let baseHeight = baseWidth
        if (imageElements.length > 0) {
          baseWidth = imageElements[0].width
          baseHeight = imageElements[0].height
        }
        const sizeFactor = imageSize === '4K' ? 4 : imageSize === '2K' ? 2 : 1
        let phWEdit = baseWidth * sizeFactor
        let phHEdit = baseHeight * sizeFactor
        const MAX_EDIT_DIM = 4096
        phWEdit = Math.min(MAX_EDIT_DIM, Math.max(32, phWEdit))
        phHEdit = Math.min(MAX_EDIT_DIM, Math.max(32, phHEdit))
        const phXEdit = maxX + 20
        const phYEdit = minY
        let placeholderIdEdit: string | null = null
        placeholderIdEdit = generateId()
        const placeholderEdit: ImageElement = { id: placeholderIdEdit, type: 'image', x: phXEdit, y: phYEdit, width: phWEdit, height: phHEdit, name: 'Generated Image', href: PLACEHOLDER_DATA_URL, mimeType: 'image/png', borderRadius: getUiRadiusLg(), isGenerating: true, isPlaceholder: true, previewHref: imageElements.length > 0 ? imageElements[0].href : undefined }
        commitAction(prev => [...prev, placeholderEdit])
        setSelectedElementIds([placeholderIdEdit])

        const imagePromises = selectedElements.map(el => {
          if (el.type === 'image') return Promise.resolve({ href: (el as ImageElement).href, mimeType: (el as ImageElement).mimeType })
          if (el.type === 'video') return Promise.reject(new Error('Cannot use video elements in image generation.'))
          return rasterizeElement(el as Exclude<Element, ImageElement | VideoElement>)
        })
        const imagesToProcess = await Promise.all(imagePromises)
        const result = apiProvider === 'Grsai'
          ? await editImageGrsai(prompt, imagesToProcess, { imageSize, model: (imageModel as 'nano-banana-fast' | 'nano-banana-pro') })
          : await editImageWhatai(prompt, imagesToProcess, { imageSize, model: imageModel })
        {
          const dbg = typeof window !== 'undefined' ? (localStorage.getItem('debug.gen.fail') || '') : ''
          if (dbg === 'result') {
            setError('Generation failed to produce an image.')
            if (placeholderIdEdit) {
              commitAction(prev => prev.filter(el => el.id !== placeholderIdEdit))
            }
            return
          }
          if (dbg === 'load') {
            const bad = 'data:image/png;base64,'
            try {
              await loadImageWithFallback(bad, 'image/png')
            } catch {
              setError('Failed to load the generated image.')
              if (placeholderIdEdit) {
                commitAction(prev => prev.filter(el => el.id !== placeholderIdEdit))
              }
              return
            }
          }
        }
        if (result.newImageBase64 && result.newImageMimeType) {
          const { newImageBase64, newImageMimeType } = result
          loadImageWithFallback(newImageBase64, newImageMimeType).then(({ img, href }) => {
            if (placeholderIdEdit) {
              try {
                console.log('[GenPipeline][edit] dims', { placeholder: { width: phWEdit, height: phHEdit }, actual: { width: img.width, height: img.height }, ok: (phWEdit === img.width && phHEdit === img.height) })
              } catch { void 0 }
              commitAction(prev => prev.map(el => el.id === placeholderIdEdit ? { ...(el as ImageElement), href, mimeType: newImageMimeType, width: img.width, height: img.height, isGenerating: undefined } : el))
              setSelectedElementIds([placeholderIdEdit])
            }
          }).catch(() => {
            setError('Failed to load the generated image.')
            if (placeholderIdEdit) {
              commitAction(prev => prev.filter(el => el.id !== placeholderIdEdit))
            }
          })
        } else {
          setError(result.textResponse || 'Generation failed to produce an image.')
          if (placeholderIdEdit) {
            commitAction(prev => prev.filter(el => el.id !== placeholderIdEdit))
          }
        }
      } else {
        let aspectRatio: string | undefined = undefined
        if (imageAspectRatio && imageAspectRatio !== 'auto') {
          aspectRatio = imageAspectRatio
        } else if (svgRef.current) {
          const b = svgRef.current.getBoundingClientRect()
          const w = Math.max(1, Math.floor(b.width))
          const h = Math.max(1, Math.floor(b.height))
          const r = w / h
          const list = [
            { ar: '1:1', v: 1 },
            { ar: '16:9', v: 16 / 9 },
            { ar: '4:3', v: 4 / 3 },
            { ar: '3:2', v: 3 / 2 },
            { ar: '2:3', v: 2 / 3 },
            { ar: '3:4', v: 3 / 4 },
            { ar: '5:4', v: 5 / 4 },
            { ar: '4:5', v: 4 / 5 },
            { ar: '9:16', v: 9 / 16 },
            { ar: '21:9', v: 21 / 9 },
          ]
          let best = list[0]
          let bestDiff = Math.abs(r - best.v)
          for (let i = 1; i < list.length; i++) {
            const d = Math.abs(r - list[i].v)
            if (d < bestDiff) { best = list[i]; bestDiff = d }
          }
          aspectRatio = best.ar
        }

        const phSize = getPlaceholderSize(imageModel, imageSize, aspectRatio)
        let placeholderId: string | null = null
        if (svgRef.current) {
          const svgBounds = svgRef.current.getBoundingClientRect()
          const screenCenter = { x: svgBounds.left + svgBounds.width / 2, y: svgBounds.top + svgBounds.height / 2 }
          const canvasPoint = getCanvasPoint(screenCenter.x, screenCenter.y)
          const x0 = canvasPoint.x - phSize.width / 2
          const y0 = canvasPoint.y - phSize.height / 2
          placeholderId = generateId()
          const placeholder: ImageElement = { id: placeholderId, type: 'image', x: x0, y: y0, name: 'Generated Image', width: phSize.width, height: phSize.height, href: PLACEHOLDER_DATA_URL, mimeType: 'image/png', borderRadius: getUiRadiusLg(), isGenerating: true, isPlaceholder: true }
          commitAction(prev => [...prev, placeholder])
          setSelectedElementIds([placeholderId])
        }

        const result = apiProvider === 'Grsai'
          ? await generateImageFromTextGrsai(prompt, (imageModel as 'nano-banana-fast' | 'nano-banana-pro') || undefined, { aspectRatio, imageSize })
          : await generateImageFromTextWhatai(prompt, imageModel || undefined, { aspectRatio, imageSize })
        {
          const dbg = typeof window !== 'undefined' ? (localStorage.getItem('debug.gen.fail') || '') : ''
          if (dbg === 'result') {
            setError('Generation failed to produce an image.')
            if (placeholderId) {
              commitAction(prev => prev.filter(el => el.id !== placeholderId))
            }
            return
          }
          if (dbg === 'load') {
            const bad = 'data:image/png;base64,'
            try {
              await loadImageWithFallback(bad, 'image/png')
            } catch {
              setError('Failed to load the generated image.')
              if (placeholderId) {
                commitAction(prev => prev.filter(el => el.id !== placeholderId))
              }
              return
            }
          }
        }
        if (result.newImageBase64 && result.newImageMimeType) {
          const { newImageBase64, newImageMimeType } = result
          loadImageWithFallback(newImageBase64, newImageMimeType).then(({ img, href }) => {
            if (placeholderId) {
              try {
                console.log('[GenPipeline][text] dims', { placeholder: { width: phSize.width, height: phSize.height }, actual: { width: img.width, height: img.height }, ok: (phSize.width === img.width && phSize.height === img.height) })
              } catch { void 0 }
              commitAction(prev => prev.map(el => el.id === placeholderId ? { ...(el as ImageElement), href, mimeType: newImageMimeType, width: img.width, height: img.height, isGenerating: undefined } : el))
              setSelectedElementIds([placeholderId])
            }
          }).catch(() => {
            setError('Failed to load the generated image.')
            if (placeholderId) {
              commitAction(prev => prev.filter(el => el.id !== placeholderId))
            }
          })
        } else {
          setError(result.textResponse || 'Generation failed to produce an image.')
          if (placeholderId) {
            commitAction(prev => prev.filter(el => el.id !== placeholderId))
          }
        }
      }
    } catch (err) {
      const error = err as Error
      let friendlyMessage = `An error occurred during generation: ${error.message}`
      if (error.message && (error.message.includes('429') || error.message.toUpperCase().includes('RESOURCE_EXHAUSTED'))) {
        friendlyMessage = 'API quota exceeded. Please check your Google AI Studio plan and billing details, or try again later.'
      }
      setError(friendlyMessage)
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [prompt, generationMode, elementsRef, selectedElementIds, setSelectedElementIds, commitAction, setIsLoading, setProgressMessage, setError, svgRef, getCanvasPoint, videoAspectRatio, imageAspectRatio, imageSize, imageModel, apiProvider, generateId])

  return { handleGenerate }
}
