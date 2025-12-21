export function getUiRadiusLg(): number {
  if (typeof window === 'undefined') return 24
  const v = getComputedStyle(document.documentElement).getPropertyValue('--border-radius-lg').trim()
  if (!v) return 24
  const m = v.match(/([0-9]*\.?[0-9]+)/)
  return m ? parseFloat(m[1]) : 24
}
