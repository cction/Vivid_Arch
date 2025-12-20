import type { Board, Element } from '@/types'

export async function slimBoardAsync(board: Board, slimElement: (el: Element) => Promise<Element>): Promise<Board> {
  const elements = board.elements.map(el => el)
  const resolved = await Promise.all(elements.map(slimElement))
  return {
    id: board.id,
    name: board.name,
    elements: resolved,
    history: [resolved],
    historyIndex: 0,
    panOffset: board.panOffset,
    zoom: board.zoom,
    canvasBackgroundColor: board.canvasBackgroundColor,
    updatedAt: board.updatedAt,
  }
}

export function slimBoardForLocalStorage(board: Board): Board {
  const elements = board.elements.map(el => ({ ...el }))
  return {
    id: board.id,
    name: board.name,
    elements,
    history: [elements],
    historyIndex: 0,
    panOffset: board.panOffset,
    zoom: board.zoom,
    canvasBackgroundColor: board.canvasBackgroundColor,
    updatedAt: board.updatedAt,
  }
}

export function pickRecentBoards(payload: { boards: Board[]; activeBoardId: string }, max: number): { boards: Board[]; activeBoardId: string } {
  const indexed = payload.boards.map((b, idx) => ({ b, idx }))
  const sorted = indexed.sort((a, b) => {
    const ta = a.b.updatedAt ?? 0
    const tb = b.b.updatedAt ?? 0
    if (tb !== ta) return tb - ta
    return a.idx - b.idx
  })
  let selected = sorted.slice(0, max).map(x => x.b)

  const active = payload.boards.find(b => b.id === payload.activeBoardId)
  if (active && !selected.some(b => b.id === active.id)) {
    if (selected.length < max) selected = [...selected, active]
    else selected = [...selected.slice(0, Math.max(0, max - 1)), active]
  }

  const nextActiveId = selected.some(b => b.id === payload.activeBoardId) ? payload.activeBoardId : (selected[0]?.id || payload.activeBoardId)
  return { boards: selected, activeBoardId: nextActiveId }
}

export async function inflateBoardsForSession(rawBoards: Board[] | undefined, timestamp: number, inflateElement: (el: Element) => Promise<Element>): Promise<Board[]> {
  const boards: Board[] = await Promise.all((rawBoards || []).map(async (b: Board) => {
    const inflatedEls = await Promise.all((b.elements || []).map(inflateElement))
    return {
      ...b,
      elements: inflatedEls,
      history: [inflatedEls],
      historyIndex: 0,
      updatedAt: b.updatedAt ?? timestamp ?? Date.now(),
    }
  }))
  return boards
}

