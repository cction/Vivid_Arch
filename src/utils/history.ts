import type { BoardHistory, Element, HistoryEntryV2, HistoryV1, HistoryV2 } from '@/types'

export function isHistoryV2(history: BoardHistory): history is HistoryV2 {
  const first = (history as unknown as HistoryEntryV2[])[0]
  return Array.isArray(history) && first != null && typeof first === 'object' && 'kind' in first
}

function buildPatch(prevElements: Element[], nextElements: Element[]): Extract<HistoryEntryV2, { kind: 'patch' }> {
  const prevById = new Map(prevElements.map(el => [el.id, el] as const))
  const nextById = new Map(nextElements.map(el => [el.id, el] as const))

  const added: Element[] = []
  const removed: Element[] = []
  const updated: Array<{ before: Element; after: Element }> = []

  for (const el of nextElements) {
    const prev = prevById.get(el.id)
    if (!prev) added.push(el)
    else if (prev !== el) updated.push({ before: prev, after: el })
  }
  for (const el of prevElements) {
    if (!nextById.has(el.id)) removed.push(el)
  }

  return {
    kind: 'patch',
    added,
    removed,
    updated,
    beforeOrder: prevElements.map(e => e.id),
    afterOrder: nextElements.map(e => e.id),
  }
}

function applyPatch(current: Element[], patch: Extract<HistoryEntryV2, { kind: 'patch' }>, dir: 'undo' | 'redo'): Element[] {
  const map = new Map(current.map(el => [el.id, el] as const))

  if (dir === 'redo') {
    for (const el of patch.removed) map.delete(el.id)
    for (const pair of patch.updated) map.set(pair.after.id, pair.after)
    for (const el of patch.added) map.set(el.id, el)
    return orderElements(map, patch.afterOrder)
  }

  for (const el of patch.added) map.delete(el.id)
  for (const pair of patch.updated) map.set(pair.before.id, pair.before)
  for (const el of patch.removed) map.set(el.id, el)
  return orderElements(map, patch.beforeOrder)
}

function orderElements(map: Map<string, Element>, order: string[]): Element[] {
  const out: Element[] = []
  const used = new Set<string>()
  for (const id of order) {
    const el = map.get(id)
    if (!el) continue
    out.push(el)
    used.add(id)
  }
  for (const [id, el] of map.entries()) {
    if (!used.has(id)) out.push(el)
  }
  return out
}

export function materializeElementsAt(history: BoardHistory, index: number): Element[] {
  if (index < 0) return []
  if (!isHistoryV2(history)) {
    const v1 = history as HistoryV1
    return v1[index] ?? []
  }

  const v2 = history
  if (v2.length === 0) return []

  let start = Math.min(index, v2.length - 1)
  while (start > 0 && v2[start]?.kind !== 'snapshot') start -= 1
  const startEntry = v2[start]
  let elements: Element[] = startEntry && startEntry.kind === 'snapshot' ? startEntry.elements : []

  for (let i = start + 1; i <= index && i < v2.length; i += 1) {
    const entry = v2[i]
    if (!entry) continue
    if (entry.kind === 'snapshot') elements = entry.elements
    else elements = applyPatch(elements, entry, 'redo')
  }
  return elements
}

export function toHistoryV2(history: HistoryV1, historyIndex: number): { history: HistoryV2; historyIndex: number } {
  const snapshots = history.length > 0 ? history : [[]]
  const base: HistoryV2 = [{ kind: 'snapshot', elements: snapshots[0] ?? [] }]
  for (let i = 1; i < snapshots.length; i += 1) {
    const prev = snapshots[i - 1] ?? []
    const next = snapshots[i] ?? []
    base.push(buildPatch(prev, next))
  }
  const nextIndex = Math.max(0, Math.min(historyIndex, base.length - 1))
  return { history: base, historyIndex: nextIndex }
}

function trimHistoryV2(history: HistoryV2, historyIndex: number, maxHistory: number): { history: HistoryV2; historyIndex: number } {
  if (history.length <= maxHistory) return { history, historyIndex }
  const overflow = history.length - maxHistory
  const trimmed = history.slice(overflow)
  const nextIndex = historyIndex - overflow

  if (trimmed.length > 0 && trimmed[0]?.kind !== 'snapshot') {
    const snap = materializeElementsAt(history, overflow)
    trimmed[0] = { kind: 'snapshot', elements: snap }
  }

  return { history: trimmed, historyIndex: Math.max(0, nextIndex) }
}

function maybeStoreSnapshot(prevElements: Element[], nextElements: Element[], patch: Extract<HistoryEntryV2, { kind: 'patch' }>): boolean {
  const totalTouched = patch.added.length + patch.removed.length + patch.updated.length
  const denom = Math.max(1, Math.max(prevElements.length, nextElements.length))
  return totalTouched / denom >= 0.6
}

export function commitBoardHistory(opts: {
  history: BoardHistory
  historyIndex: number
  prevElements: Element[]
  nextElements: Element[]
  maxHistory: number
  preferDiff: boolean
}): { history: BoardHistory; historyIndex: number } {
  const { history, historyIndex, prevElements, nextElements, maxHistory, preferDiff } = opts

  if (!preferDiff) {
    const snapshots: HistoryV1 = isHistoryV2(history)
      ? Array.from({ length: Math.max(1, historyIndex + 1) }, (_, i) => materializeElementsAt(history, i))
      : (history as HistoryV1).slice(0, historyIndex + 1)
    const base = [...snapshots, nextElements]
    if (base.length <= maxHistory) return { history: base, historyIndex: base.length - 1 }
    const overflow = base.length - maxHistory
    const trimmed = base.slice(overflow)
    return { history: trimmed, historyIndex: trimmed.length - 1 }
  }

  const v2 = isHistoryV2(history) ? history : toHistoryV2(history as HistoryV1, historyIndex).history
  const base = v2.slice(0, historyIndex + 1)
  const patch = buildPatch(prevElements, nextElements)
  const entry: HistoryEntryV2 = maybeStoreSnapshot(prevElements, nextElements, patch) ? { kind: 'snapshot', elements: nextElements } : patch

  const nextHistory = [...base, entry]
  const nextIndex = nextHistory.length - 1
  const trimmed = trimHistoryV2(nextHistory, nextIndex, maxHistory)
  return trimmed
}
