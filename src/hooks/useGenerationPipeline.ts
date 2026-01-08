import { useCallback, useRef } from 'react'
import type { Dispatch, SetStateAction, MutableRefObject } from 'react'
import type { Element, ImageElement, PathElement, VideoElement, Point } from '@/types'
import { rasterizeElement, getElementBounds } from '@/utils/canvas'
import { loadImageWithFallback, PLACEHOLDER_DATA_URL } from '@/utils/image'
import { editImage as editImageWhatai, generateImageFromText as generateImageFromTextWhatai, generateVideo } from '@/services/api/geminiService'
import { getUiRadiusLg } from '@/ui/standards'
import { editImage as editImageGrsai, generateImageFromText as generateImageFromTextGrsai, type GrsaiResult } from '@/services/api/grsaiService'

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
  effectivePrompt: string
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
  const lower = (model || '').toLowerCase()
  const isProModel = lower === 'nano-banana-pro' || lower === 'nano-banana-pro-cl' || lower === 'nano-banana-2'
  const ar = aspectRatio || '1:1'
  const base = isProModel ? (PRO_1K_SIZES[ar] || PRO_1K_SIZES['1:1']) : (FLASH_1K_SIZES[ar] || FLASH_1K_SIZES['1:1'])
  const effectiveSize: '1K' | '2K' | '4K' = isProModel ? size : '1K'
  const multiplier = effectiveSize === '4K' ? 4 : effectiveSize === '2K' ? 2 : 1
  return { width: base.w * multiplier, height: base.h * multiplier }
}

function snapAspectRatio(r: number): string {
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
  return best.ar
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

export function useGenerationPipeline({ svgRef, getCanvasPoint, elementsRef, selectedElementIds, setSelectedElementIds, commitAction, setIsLoading, setProgressMessage, setError, effectivePrompt, generationMode, videoAspectRatio, imageAspectRatio, imageSize, imageModel, apiProvider, generateId }: Deps) {
  const generationTokenRef = useRef(0)

  const handleCancelGenerate = useCallback(() => {
    generationTokenRef.current += 1
    setIsLoading(false)
    setProgressMessage('')
    const currentElements = elementsRef.current
    if (currentElements && currentElements.length > 0) {
      const placeholderIds = new Set(
        currentElements
          .filter(el => el.type === 'image' && (el as ImageElement).isPlaceholder)
          .map(el => el.id),
      )
      if (placeholderIds.size > 0) {
        commitAction(prev => prev.filter(el => !placeholderIds.has(el.id)))
      }
      commitAction(prev =>
        prev.map(el => {
          if (el.type === 'image' && (el as ImageElement).isGenerating) {
            const img = el as ImageElement
            return { ...img, isGenerating: undefined }
          }
          return el
        }),
      )
      setSelectedElementIds(ids => ids.filter(id => !placeholderIds.has(id)))
    }
  }, [setIsLoading, setProgressMessage, elementsRef, commitAction, setSelectedElementIds])

  const handleGenerate = useCallback(async () => {
    const token = ++generationTokenRef.current
    if (!effectivePrompt.trim()) {
      setError('Please enter a prompt.')
      return
    }
    const safeSetIsLoading = (value: boolean) => {
      if (generationTokenRef.current !== token) return
      setIsLoading(value)
    }
    const safeSetProgressMessage = (value: string) => {
      if (generationTokenRef.current !== token) return
      setProgressMessage(value)
    }
    const safeSetError = (value: string | null) => {
      if (generationTokenRef.current !== token) return
      setError(value)
    }
    const safeCommitAction = (updater: (prev: Element[]) => Element[]) => {
      if (generationTokenRef.current !== token) return
      commitAction(updater)
    }
    const safeSetSelectedElementIds = (ids: string[]) => {
      if (generationTokenRef.current !== token) return
      setSelectedElementIds(ids)
    }
    safeSetIsLoading(true)
    safeSetError(null)
    safeSetProgressMessage('Starting generation...')
    if (generationMode === 'video') {
      if (apiProvider === 'Grsai') {
        safeSetError('当前提供方不支持视频生成，请切换到 WHATAI')
        safeSetIsLoading(false)
        return
      }
      try {
        const selectedElements = elementsRef.current.filter(el => selectedElementIds.includes(el.id))
        const imageElement = selectedElements.find(el => el.type === 'image') as ImageElement | undefined
        if (selectedElementIds.length > 1 || (selectedElementIds.length === 1 && !imageElement)) {
          safeSetError('For video generation, please select a single image or no elements.')
          safeSetIsLoading(false)
          return
        }
        const { videoBlob, mimeType } = await generateVideo(effectivePrompt, videoAspectRatio as '16:9' | '9:16', (message) => safeSetProgressMessage(message), imageElement ? { href: imageElement.href, mimeType: imageElement.mimeType } : undefined)
        safeSetProgressMessage('Processing video...')
        const videoUrl = URL.createObjectURL(videoBlob)
        const video = document.createElement('video')
        video.onloadedmetadata = () => {
          if (generationTokenRef.current !== token) return
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
          safeCommitAction(prev => [...prev, newVideoElement])
          safeSetSelectedElementIds([newVideoElement.id])
          safeSetIsLoading(false)
        }
        video.onerror = () => {
          if (generationTokenRef.current !== token) return
          safeSetError('Could not load generated video metadata.')
          safeSetIsLoading(false)
        }
        video.src = videoUrl
      } catch (err) {
        const error = err as Error
        safeSetError(`Video generation failed: ${error.message}`)
        console.error(err)
        safeSetIsLoading(false)
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
            safeSetError('当前提供方不支持局部重绘（mask）')
            safeSetIsLoading(false)
            return
          }
          safeCommitAction(prev => prev.map(el => {
            if (el.id === baseImage.id && el.type === 'image') {
              return { ...el, isGenerating: true }
            }
            return el
          }))
          const dbg = typeof window !== 'undefined' ? (localStorage.getItem('debug.gen.fail') || '') : ''
          if (dbg) {
            safeSetError(dbg === 'load' ? 'Failed to load the generated image.' : 'Inpainting failed to produce an image.')
            safeCommitAction(prev => prev.map(el => {
              if (el.id === baseImage.id && el.type === 'image') {
                return { ...el, isGenerating: undefined }
              }
              return el
            }))
            return
          }
          const result = await editImageWhatai(effectivePrompt, [{ href: baseImage.href, mimeType: baseImage.mimeType }], { imageSize, mask: { href: maskData.href, mimeType: maskData.mimeType }, model: imageModel })
          if (result.newImageBase64 && result.newImageMimeType) {
            const { newImageBase64, newImageMimeType } = result
            loadImageWithFallback(newImageBase64, newImageMimeType).then(({ img, href }) => {
              if (generationTokenRef.current !== token) return
              const maskPathIds = new Set(maskPaths.map(p => p.id))
              try {
                console.log('[GenPipeline][mask] dims', { before: { width: baseImage.width, height: baseImage.height }, after: { width: img.width, height: img.height } })
              } catch { void 0 }
              safeCommitAction(prev => prev.map(el => {
                if (el.id === baseImage.id && el.type === 'image') {
                  return { ...el, href, width: img.width, height: img.height, isGenerating: undefined }
                }
                return el
              }).filter(el => !maskPathIds.has(el.id)))
              safeSetSelectedElementIds([baseImage.id])
            }).catch(() => {
              if (generationTokenRef.current !== token) return
              safeSetError('Failed to load the generated image.')
              safeCommitAction(prev => prev.map(el => {
                if (el.id === baseImage.id && el.type === 'image') {
                  return { ...el, isGenerating: undefined }
                }
                return el
              }))
            })
          } else {
            safeSetError(result.textResponse || 'Inpainting failed to produce an image.')
            safeCommitAction(prev => prev.map(el => {
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
        let aspectRatioEdit: string | undefined = undefined
        if (imageElements.length > 0 && imageElements[0].width > 0 && imageElements[0].height > 0) {
          const r = imageElements[0].width / imageElements[0].height
          aspectRatioEdit = snapAspectRatio(r)
        }
        const phSizeEdit = getPlaceholderSize(imageModel, imageSize, aspectRatioEdit)
        let phWEdit = phSizeEdit.width
        let phHEdit = phSizeEdit.height
        const MAX_EDIT_DIM = 4096
        phWEdit = Math.min(MAX_EDIT_DIM, Math.max(32, phWEdit))
        phHEdit = Math.min(MAX_EDIT_DIM, Math.max(32, phHEdit))
        const phXEdit = maxX + 20
        const phYEdit = minY
        let placeholderIdEdit: string | null = null
        placeholderIdEdit = generateId()
        const placeholderEdit: ImageElement = { id: placeholderIdEdit, type: 'image', x: phXEdit, y: phYEdit, width: phWEdit, height: phHEdit, name: 'Generated Image', href: PLACEHOLDER_DATA_URL, mimeType: 'image/png', borderRadius: getUiRadiusLg(), isGenerating: true, isPlaceholder: true, previewHref: imageElements.length > 0 ? imageElements[0].href : undefined }
        safeCommitAction(prev => [...prev, placeholderEdit])
        safeSetSelectedElementIds([placeholderIdEdit])

        const imagePromises = selectedElements.map(el => {
          if (el.type === 'image') return Promise.resolve({ href: (el as ImageElement).href, mimeType: (el as ImageElement).mimeType })
          if (el.type === 'video') return Promise.reject(new Error('Cannot use video elements in image generation.'))
          return rasterizeElement(el as Exclude<Element, ImageElement | VideoElement>)
        })
        const imagesToProcess = await Promise.all(imagePromises)
        const result = apiProvider === 'Grsai'
          ? await editImageGrsai(effectivePrompt, imagesToProcess, { imageSize, model: (imageModel as 'nano-banana-fast' | 'nano-banana-pro-cl') })
          : await editImageWhatai(effectivePrompt, imagesToProcess, { imageSize, model: imageModel })
        {
          const dbg = typeof window !== 'undefined' ? (localStorage.getItem('debug.gen.fail') || '') : ''
          if (dbg === 'result') {
            safeSetError('Generation failed to produce an image.')
            if (placeholderIdEdit) {
              safeCommitAction(prev => prev.filter(el => el.id !== placeholderIdEdit))
            }
            return
          }
          if (dbg === 'load') {
            const bad = 'data:image/png;base64,'
            try {
              await loadImageWithFallback(bad, 'image/png')
            } catch {
              safeSetError('Failed to load the generated image.')
              if (placeholderIdEdit) {
                safeCommitAction(prev => prev.filter(el => el.id !== placeholderIdEdit))
              }
              return
            }
          }
        }
        if (result.newImageBase64 && result.newImageMimeType) {
          const { newImageBase64, newImageMimeType } = result
          loadImageWithFallback(newImageBase64, newImageMimeType).then(({ img, href }) => {
            if (generationTokenRef.current !== token) return
            if (placeholderIdEdit) {
              try {
                console.log('[GenPipeline][edit] dims', { placeholder: { width: phWEdit, height: phHEdit }, actual: { width: img.width, height: img.height }, ok: (phWEdit === img.width && phHEdit === img.height) })
              } catch { void 0 }
              safeCommitAction(prev =>
                prev.map(el =>
                  el.id === placeholderIdEdit
                    ? {
                        ...(el as ImageElement),
                        href,
                        mimeType: newImageMimeType,
                        width: img.width,
                        height: img.height,
                        isGenerating: undefined,
                        isPlaceholder: undefined,
                      }
                    : el,
                ),
              )
              safeSetSelectedElementIds([placeholderIdEdit])
            }
          }).catch(() => {
            if (generationTokenRef.current !== token) return
            safeSetError('Failed to load the generated image.')
            if (placeholderIdEdit) {
              safeCommitAction(prev => prev.filter(el => el.id !== placeholderIdEdit))
            }
          })
        } else {
          const errorMsg = result.textResponse || (result as { error?: string }).error || 'Generation failed to produce an image.'
          safeSetError(errorMsg)
          if (placeholderIdEdit) {
            safeCommitAction(prev => prev.map(el => {
              if (el.id === placeholderIdEdit) {
                const base: ImageElement = {
                  ...(el as ImageElement),
                  isGenerating: undefined,
                  genProvider: apiProvider === 'Grsai' ? 'Grsai' : 'WHATAI',
                  genStatus: 'failed',
                  genError: errorMsg,
                }
                if (apiProvider === 'Grsai') {
                  const gRes = result as GrsaiResult
                  if (gRes.taskId) base.genTaskId = gRes.taskId
                  if (gRes.status === 'timeout') base.genStatus = 'timeout'
                }
                return base
              }
              return el
            }))
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
          aspectRatio = snapAspectRatio(r)
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
          safeCommitAction(prev => [...prev, placeholder])
          safeSetSelectedElementIds([placeholderId])
        }

        const result = apiProvider === 'Grsai'
          ? await generateImageFromTextGrsai(effectivePrompt, (imageModel as 'nano-banana-fast' | 'nano-banana-pro-cl') || undefined, { aspectRatio, imageSize })
          : await generateImageFromTextWhatai(effectivePrompt, imageModel || undefined, { aspectRatio, imageSize })
        {
          const dbg = typeof window !== 'undefined' ? (localStorage.getItem('debug.gen.fail') || '') : ''
          if (dbg === 'result') {
            safeSetError('Generation failed to produce an image.')
            if (placeholderId) {
              safeCommitAction(prev => prev.filter(el => el.id !== placeholderId))
            }
            return
          }
          if (dbg === 'load') {
            const bad = 'data:image/png;base64,'
            try {
              await loadImageWithFallback(bad, 'image/png')
            } catch {
              safeSetError('Failed to load the generated image.')
              if (placeholderId) {
                safeCommitAction(prev => prev.filter(el => el.id !== placeholderId))
              }
              return
            }
          }
        }
        if (result.newImageBase64 && result.newImageMimeType) {
          const { newImageBase64, newImageMimeType } = result
          loadImageWithFallback(newImageBase64, newImageMimeType).then(({ img, href }) => {
            if (generationTokenRef.current !== token) return
            if (placeholderId) {
              try {
                console.log('[GenPipeline][text] dims', { placeholder: { width: phSize.width, height: phSize.height }, actual: { width: img.width, height: img.height }, ok: (phSize.width === img.width && phSize.height === img.height) })
              } catch { void 0 }
              safeCommitAction(prev =>
                prev.map(el =>
                  el.id === placeholderId
                    ? {
                        ...(el as ImageElement),
                        href,
                        mimeType: newImageMimeType,
                        width: img.width,
                        height: img.height,
                        isGenerating: undefined,
                        isPlaceholder: undefined,
                      }
                    : el,
                ),
              )
              safeSetSelectedElementIds([placeholderId])
            }
          }).catch(() => {
            if (generationTokenRef.current !== token) return
            safeSetError('Failed to load the generated image.')
            if (placeholderId) {
              safeCommitAction(prev => prev.filter(el => el.id !== placeholderId))
            }
          })
        } else {
          const errorMsg = result.textResponse || (result as { error?: string }).error || 'Generation failed to produce an image.'
          safeSetError(errorMsg)
          if (placeholderId) {
            safeCommitAction(prev => prev.map(el => {
              if (el.id === placeholderId) {
                const base: ImageElement = {
                  ...(el as ImageElement),
                  isGenerating: undefined,
                  genProvider: apiProvider === 'Grsai' ? 'Grsai' : 'WHATAI',
                  genStatus: 'failed',
                  genError: errorMsg,
                }
                if (apiProvider === 'Grsai') {
                  const gRes = result as GrsaiResult
                  if (gRes.taskId) base.genTaskId = gRes.taskId
                  if (gRes.status === 'timeout') base.genStatus = 'timeout'
                }
                return base
              }
              return el
            }))
          }
        }
      }
    } catch (err) {
      const error = err as Error
      let friendlyMessage = `An error occurred during generation: ${error.message}`
      if (error.message && (error.message.includes('429') || error.message.toUpperCase().includes('RESOURCE_EXHAUSTED'))) {
        friendlyMessage = 'API quota exceeded. Please check your Google AI Studio plan and billing details, or try again later.'
      }
      safeSetError(friendlyMessage)
      console.error(err)
    } finally {
      safeSetIsLoading(false)
    }
  }, [effectivePrompt, generationMode, elementsRef, selectedElementIds, setSelectedElementIds, commitAction, setIsLoading, setProgressMessage, setError, svgRef, getCanvasPoint, videoAspectRatio, imageAspectRatio, imageSize, imageModel, apiProvider, generateId])

  return { handleGenerate, handleCancelGenerate }
}
