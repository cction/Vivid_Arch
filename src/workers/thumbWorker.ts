import type { Element, Point, LineElement, ArrowElement, ImageElement, ShapeElement, TextElement, VideoElement, GroupElement, PathElement } from '@/types'

const THUMB_WIDTH = 120
const THUMB_HEIGHT = 80

function getElementBounds(element: Element, allElements: Element[] = []): { x: number; y: number; width: number; height: number } {
  if (element.type === 'group') {
    const ge = element as GroupElement
    const children = allElements.filter(el => el.parentId === ge.id)
    if (children.length === 0) return { x: ge.x, y: ge.y, width: ge.width, height: ge.height }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    children.forEach(child => {
      const bounds = getElementBounds(child, allElements)
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.width)
      maxY = Math.max(maxY, bounds.y + bounds.height)
    })
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
  if (element.type === 'image' || element.type === 'shape' || element.type === 'text' || element.type === 'video') {
    if (element.type === 'image') {
      const el = element as ImageElement
      return { x: el.x, y: el.y, width: el.width, height: el.height }
    }
    if (element.type === 'shape') {
      const el = element as ShapeElement
      return { x: el.x, y: el.y, width: el.width, height: el.height }
    }
    if (element.type === 'text') {
      const el = element as TextElement
      return { x: el.x, y: el.y, width: el.width, height: el.height }
    }
    const el = element as VideoElement
    return { x: el.x, y: el.y, width: el.width, height: el.height }
  }
  if (element.type === 'line') {
    const el = element as LineElement
    const x = Math.min(el.points[0].x, el.points[1].x)
    const y = Math.min(el.points[0].y, el.points[1].y)
    const width = Math.abs(el.points[1].x - el.points[0].x)
    const height = Math.abs(el.points[1].y - el.points[0].y)
    return { x, y, width, height }
  }
  if (element.type === 'arrow') {
    const el = element as ArrowElement
    const x = Math.min(el.points[0].x, el.points[1].x)
    const y = Math.min(el.points[0].y, el.points[1].y)
    const width = Math.abs(el.points[1].x - el.points[0].x)
    const height = Math.abs(el.points[1].y - el.points[0].y)
    return { x, y, width, height }
  }
  if (element.type === 'path') {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const pts = (element as PathElement).points
    pts.forEach((p: Point) => {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    })
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
  return { x: 0, y: 0, width: 0, height: 0 }
}

function generate(elements: Element[], bgColor: string): string {
  if (!elements || elements.length === 0) {
    const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}"><rect width="100%" height="100%" fill="${bgColor}" /></svg>`
    return `data:image/svg+xml;base64,${btoa(emptySvg)}`
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  elements.forEach(el => {
    const bounds = getElementBounds(el, elements)
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  })
  const contentWidth = maxX - minX
  const contentHeight = maxY - minY
  if (contentWidth <= 0 || contentHeight <= 0) {
    const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}"><rect width="100%" height="100%" fill="${bgColor}" /></svg>`
    return `data:image/svg+xml;base64,${btoa(emptySvg)}`
  }
  const scale = Math.min(THUMB_WIDTH / contentWidth, THUMB_HEIGHT / contentHeight) * 0.9
  const dx = (THUMB_WIDTH - contentWidth * scale) / 2 - minX * scale
  const dy = (THUMB_HEIGHT - contentHeight * scale) / 2 - minY * scale
  const svgContent = elements.map(el => {
    if (el.type === 'path') {
      const pts = (el as PathElement).points
      const pathData = pts.map((p: Point, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
      const pe = el as PathElement
      return `<path d="${pathData}" stroke="${pe.strokeColor}" stroke-width="${pe.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${pe.strokeOpacity || 1}" />`
    }
    if (el.type === 'image') {
      const im = el as ImageElement
      return `<image href="${im.href}" x="${im.x}" y="${im.y}" width="${im.width}" height="${im.height}" opacity="${typeof (im.opacity) === 'number' ? im.opacity / 100 : 1}" />`
    }
    return ''
  }).join('')
  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}"><rect width="100%" height="100%" fill="${bgColor}" /><g transform="translate(${dx} ${dy}) scale(${scale})">${svgContent}</g></svg>`
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(fullSvg)))}`
}

const ctx = self as unknown as { postMessage: (message: { savedAt: number; thumbnail: string }) => void; onmessage: (ev: MessageEvent) => void }
ctx.onmessage = (ev: MessageEvent) => {
  const { elements, bgColor, savedAt } = ev.data as { elements: Element[]; bgColor: string; savedAt: number }
  const url = generate(elements, bgColor)
  ctx.postMessage({ savedAt, thumbnail: url })
}