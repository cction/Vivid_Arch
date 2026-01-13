function toMessage(input: unknown): string {
  if (typeof input === 'string') return input
  if (input instanceof Error) return input.message || String(input)
  if (input && typeof input === 'object' && 'message' in (input as Record<string, unknown>)) {
    const m = (input as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  try {
    return String(input)
  } catch {
    return ''
  }
}

function applyRules(text: string): string {
  let s = text

  const rules: Array<{ re: RegExp; replace: string }> = [
    { re: /nano[\s_-]*banana/gi, replace: '模型' },
    { re: /\bbanana\b/gi, replace: '模型' },
    { re: /\bbananna\b/gi, replace: '模型' },
    { re: /\bgemini\b/gi, replace: '模型' },
    { re: /\bwhatai\b/gi, replace: '服务' },
    { re: /\bgrsai\b/gi, replace: '服务' },
    { re: /proxy-whatai/gi, replace: 'proxy' },
    { re: /proxy-grsai/gi, replace: 'proxy' }
  ]

  for (const r of rules) {
    s = s.replace(r.re, r.replace)
  }

  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/服务\s*API\s*Error/gi, 'API Error')
  s = s.replace(/模型\s*模型/gi, '模型')
  s = s.replace(/服务\s*服务/gi, '服务')
  return s
}

export function sanitizeErrorMessage(input: unknown, fallback?: string): string {
  const raw = toMessage(input)
  const cleaned = applyRules(raw)
  const fb = (fallback && fallback.trim()) ? fallback.trim() : '请求失败，请稍后重试'
  if (!cleaned) return fb
  if (cleaned.length < 2) return fb
  return cleaned
}

