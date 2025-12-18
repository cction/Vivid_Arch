import { useCallback } from 'react'
import type { Dispatch, SetStateAction, MutableRefObject } from 'react'
import type { Element, ImageElement, PathElement, VideoElement, Point } from '@/types'
import { rasterizeElement, getElementBounds } from '@/utils/canvas'
import { loadImageWithFallback } from '@/utils/image'
import { editImage as editImageWhatai, generateImageFromText as generateImageFromTextWhatai, generateVideo } from '@/services/api/geminiService'
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
          const result = await editImageWhatai(prompt, [{ href: baseImage.href, mimeType: baseImage.mimeType }], { imageSize, mask: { href: maskData.href, mimeType: maskData.mimeType }, model: imageModel })
          if (result.newImageBase64 && result.newImageMimeType) {
            const { newImageBase64, newImageMimeType } = result
            loadImageWithFallback(newImageBase64, newImageMimeType).then(({ img, href }) => {
              const maskPathIds = new Set(maskPaths.map(p => p.id))
              commitAction(prev => prev.map(el => {
                if (el.id === baseImage.id && el.type === 'image') {
                  return { ...el, href, width: img.width, height: img.height }
                }
                return el
              }).filter(el => !maskPathIds.has(el.id)))
              setSelectedElementIds([baseImage.id])
            }).catch(() => setError('Failed to load the generated image.'))
          } else {
            setError(result.textResponse || 'Inpainting failed to produce an image.')
          }
          return
        }
        const imagePromises = selectedElements.map(el => {
          if (el.type === 'image') return Promise.resolve({ href: (el as ImageElement).href, mimeType: (el as ImageElement).mimeType })
          if (el.type === 'video') return Promise.reject(new Error('Cannot use video elements in image generation.'))
          return rasterizeElement(el as Exclude<Element, ImageElement | VideoElement>)
        })
        const imagesToProcess = await Promise.all(imagePromises)
        const result = apiProvider === 'Grsai'
          ? await editImageGrsai(prompt, imagesToProcess, { imageSize, model: (imageModel as 'nano-banana-fast' | 'nano-banana-pro') })
          : await editImageWhatai(prompt, imagesToProcess, { imageSize, model: imageModel })
        if (result.newImageBase64 && result.newImageMimeType) {
          const { newImageBase64, newImageMimeType } = result
          loadImageWithFallback(newImageBase64, newImageMimeType).then(({ img, href }) => {
            let minX = Infinity, minY = Infinity, maxX = -Infinity
            selectedElements.forEach(el => {
              const bounds = getElementBounds(el)
              minX = Math.min(minX, bounds.x)
              minY = Math.min(minY, bounds.y)
              maxX = Math.max(maxX, bounds.x + bounds.width)
            })
            const x = maxX + 20
            const y = minY
            const newImage: ImageElement = { id: generateId(), type: 'image', x, y, name: 'Generated Image', width: img.width, height: img.height, href, mimeType: newImageMimeType }
            commitAction(prev => [...prev, newImage])
            setSelectedElementIds([newImage.id])
          }).catch(() => setError('Failed to load the generated image.'))
        } else {
          setError(result.textResponse || 'Generation failed to produce an image.')
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
        const result = apiProvider === 'Grsai'
          ? await generateImageFromTextGrsai(prompt, (imageModel as 'nano-banana-fast' | 'nano-banana-pro') || undefined, { aspectRatio, imageSize })
          : await generateImageFromTextWhatai(prompt, imageModel || undefined, { aspectRatio, imageSize })
        if (result.newImageBase64 && result.newImageMimeType) {
          const { newImageBase64, newImageMimeType } = result
          loadImageWithFallback(newImageBase64, newImageMimeType).then(({ img, href }) => {
            if (!svgRef.current) return
            const svgBounds = svgRef.current.getBoundingClientRect()
            const screenCenter = { x: svgBounds.left + svgBounds.width / 2, y: svgBounds.top + svgBounds.height / 2 }
            const canvasPoint = getCanvasPoint(screenCenter.x, screenCenter.y)
            const x = canvasPoint.x - (img.width / 2)
            const y = canvasPoint.y - (img.height / 2)
            const newImage: ImageElement = { id: generateId(), type: 'image', x, y, name: 'Generated Image', width: img.width, height: img.height, href, mimeType: newImageMimeType }
            commitAction(prev => [...prev, newImage])
            setSelectedElementIds([newImage.id])
          }).catch(() => setError('Failed to load the generated image.'))
        } else {
          setError(result.textResponse || 'Generation failed to produce an image.')
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
