import { useEffect } from 'react'

export function useUiTheme(uiTheme: { color: string; opacity: number }, buttonTheme: { color: string; opacity: number }, canvasBackgroundColor: string) {
  useEffect(() => {
    const root = document.documentElement
    const hex = uiTheme.color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    root.style.setProperty('--ui-bg-color', `rgba(${r}, ${g}, ${b}, ${uiTheme.opacity})`)

    const btnHex = buttonTheme.color.replace('#', '')
    const btnR = parseInt(btnHex.substring(0, 2), 16)
    const btnG = parseInt(btnHex.substring(2, 4), 16)
    const btnB = parseInt(btnHex.substring(4, 6), 16)
    root.style.setProperty('--button-bg-color', `rgba(${btnR}, ${btnG}, ${btnB}, ${buttonTheme.opacity})`)

    const clamp = (n: number) => Math.max(0, Math.min(255, n))
    const parseHex = (h: string) => {
      const clean = h.replace('#', '')
      return {
        r: parseInt(clean.substring(0, 2), 16),
        g: parseInt(clean.substring(2, 4), 16),
        b: parseInt(clean.substring(4, 6), 16),
      }
    }
    const adjust = (h: string, delta: number) => {
      const { r, g, b } = parseHex(h)
      return `rgb(${clamp(r + delta)}, ${clamp(g + delta)}, ${clamp(b + delta)})`
    }
    root.style.setProperty('--bg-gradient-1', adjust(canvasBackgroundColor, -30))
    root.style.setProperty('--bg-gradient-2', adjust(canvasBackgroundColor, 50))
    root.style.setProperty('--bg-gradient-3', adjust(canvasBackgroundColor, -65))
  }, [uiTheme, buttonTheme, canvasBackgroundColor])
}

