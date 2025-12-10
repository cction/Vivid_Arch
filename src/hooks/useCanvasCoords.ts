import { useMemo } from 'react'
import type { MutableRefObject } from 'react'
import type { Point } from '@/types'

export function useCanvasCoords(svgRef: MutableRefObject<SVGSVGElement | null>, panOffset: Point, zoom: number) {
  const getCanvasPoint = useMemo(() => {
    return (screenX: number, screenY: number): Point => {
      if (!svgRef.current) return { x: 0, y: 0 }
      const svgBounds = svgRef.current.getBoundingClientRect()
      const xOnSvg = screenX - svgBounds.left
      const yOnSvg = screenY - svgBounds.top
      return { x: (xOnSvg - panOffset.x) / zoom, y: (yOnSvg - panOffset.y) / zoom }
    }
  }, [svgRef, panOffset.x, panOffset.y, zoom])

  return { getCanvasPoint }
}

