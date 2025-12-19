import type { Element, Point } from '@/types'
import { getElementBounds } from '@/utils/canvas'

type Rect = { x: number; y: number; width: number; height: number }

type GridIndex = {
  cellSize: number
  cells: Map<string, Element[]>
  boundsById: Map<string, Rect>
  elementsCount: number
  cellsCount: number
}

const indexCache = new WeakMap<Element[], GridIndex>()

let perfLastEnabledCheckAt = 0
let perfEnabledCached = false
let perfLogTimer: number | null = null
let perfCounters = { build: 0, queryRect: 0, candidates: 0, hits: 0 }
let perfLastSnapshot: { elementsCount: number; cellsCount: number; cellSize: number } | null = null

const isPerfEnabled = () => {
  if (typeof window === 'undefined') return false
  const now = Date.now()
  if (now - perfLastEnabledCheckAt < 1000) return perfEnabledCached
  perfLastEnabledCheckAt = now
  try {
    perfEnabledCached = localStorage.getItem('BANANAPOD_DEBUG_PERF') === '1'
  } catch {
    perfEnabledCached = false
  }
  return perfEnabledCached
}

const schedulePerfLog = () => {
  if (!isPerfEnabled()) return
  if (perfLogTimer != null) return
  perfLogTimer = window.setTimeout(() => {
    perfLogTimer = null
    const snapshot = { ...perfCounters, state: perfLastSnapshot }
    perfCounters = { build: 0, queryRect: 0, candidates: 0, hits: 0 }
    perfLastSnapshot = null
    console.log('[Perf][SpatialIndex]', snapshot)
  }, 1000)
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

const cellKey = (cx: number, cy: number) => `${cx},${cy}`

const getCellRange = (rect: Rect, cellSize: number) => {
  const x1 = Math.floor(rect.x / cellSize)
  const y1 = Math.floor(rect.y / cellSize)
  const x2 = Math.floor((rect.x + rect.width) / cellSize)
  const y2 = Math.floor((rect.y + rect.height) / cellSize)
  return { x1, y1, x2, y2 }
}

export function getGridIndex(elements: Element[], opts?: { cellSize?: number }): GridIndex {
  const cellSize = opts?.cellSize ?? 256
  const cached = indexCache.get(elements)
  if (cached && cached.cellSize === cellSize) return cached

  const boundsById = new Map<string, Rect>()
  const cells = new Map<string, Element[]>()

  for (const el of elements) {
    const b = getElementBounds(el, elements)
    boundsById.set(el.id, b)
    const r = getCellRange(b, cellSize)
    for (let cy = r.y1; cy <= r.y2; cy++) {
      for (let cx = r.x1; cx <= r.x2; cx++) {
        const k = cellKey(cx, cy)
        const list = cells.get(k)
        if (list) list.push(el)
        else cells.set(k, [el])
      }
    }
  }

  const created: GridIndex = {
    cellSize,
    cells,
    boundsById,
    elementsCount: elements.length,
    cellsCount: cells.size,
  }

  indexCache.set(elements, created)

  perfCounters.build += 1
  perfLastSnapshot = { elementsCount: created.elementsCount, cellsCount: created.cellsCount, cellSize: created.cellSize }
  schedulePerfLog()

  return created
}

export function queryElementsInRect(elements: Element[], rect: Rect, opts?: { cellSize?: number }): Element[] {
  if (elements.length === 0) return []
  perfCounters.queryRect += 1
  schedulePerfLog()

  const idx = getGridIndex(elements, opts)
  const r = getCellRange(rect, idx.cellSize)
  const seen = new Set<string>()
  const candidates: Element[] = []

  for (let cy = r.y1; cy <= r.y2; cy++) {
    for (let cx = r.x1; cx <= r.x2; cx++) {
      const list = idx.cells.get(cellKey(cx, cy))
      if (!list) continue
      for (const el of list) {
        if (seen.has(el.id)) continue
        seen.add(el.id)
        candidates.push(el)
      }
    }
  }

  perfCounters.candidates += candidates.length

  const hits: Element[] = []
  for (const el of candidates) {
    const b = idx.boundsById.get(el.id) ?? getElementBounds(el, elements)
    if (overlaps(rect, b)) hits.push(el)
  }

  perfCounters.hits += hits.length

  return hits
}

export function queryElementsNearPoint(elements: Element[], p: Point, radius: number, opts?: { cellSize?: number }): Element[] {
  const r = { x: p.x - radius, y: p.y - radius, width: radius * 2, height: radius * 2 }
  return queryElementsInRect(elements, r, opts)
}

