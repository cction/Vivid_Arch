const PRO_1K_SIZES = {
  '1:1': { w: 1024, h: 1024 },
  '2:3': { w: 848, h: 1264 },
  '3:2': { w: 1264, h: 848 },
  '3:4': { w: 896, h: 1200 },
  '4:3': { w: 1200, h: 896 },
  '4:5': { w: 928, h: 1152 },
  '5:4': { w: 1152, h: 928 },
  '9:16': { w: 768, h: 1376 },
  '16:9': { w: 1376, h: 768 },
  '21:9': { w: 1584, h: 672 }
}
const FLASH_1K_SIZES = {
  '1:1': { w: 1024, h: 1024 },
  '2:3': { w: 832, h: 1248 },
  '3:2': { w: 1248, h: 832 },
  '3:4': { w: 864, h: 1184 },
  '4:3': { w: 1184, h: 864 },
  '4:5': { w: 896, h: 1152 },
  '5:4': { w: 1152, h: 896 },
  '9:16': { w: 768, h: 1344 },
  '16:9': { w: 1344, h: 768 },
  '21:9': { w: 1536, h: 672 }
}
function getPlaceholderSize(model, size, aspectRatio) {
  const isProModel = model === 'nano-banana-pro' || model === 'nano-banana-2'
  const ar = aspectRatio || '1:1'
  const base = isProModel ? (PRO_1K_SIZES[ar] || PRO_1K_SIZES['1:1']) : (FLASH_1K_SIZES[ar] || FLASH_1K_SIZES['1:1'])
  const effectiveSize = isProModel ? size : '1K'
  const multiplier = effectiveSize === '4K' ? 4 : effectiveSize === '2K' ? 2 : 1
  return { width: base.w * multiplier, height: base.h * multiplier }
}
async function main() {
  const models = ['nano-banana', 'nano-banana-2', 'nano-banana-pro']
  const sizes = ['1K', '2K', '4K']
  const ars = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', undefined, 'invalid']
  const cases = []
  for (const m of models) {
    for (const s of sizes) {
      for (const a of ars) {
        cases.push({ model: m, size: s, ar: a })
      }
    }
  }
  let ok = 0
  for (const c of cases) {
    const r = getPlaceholderSize(c.model, c.size, c.ar)
    const ar = (c.ar && (PRO_1K_SIZES[c.ar] || FLASH_1K_SIZES[c.ar])) ? c.ar : '1:1'
    const base = c.model === 'nano-banana-pro' || c.model === 'nano-banana-2' ? PRO_1K_SIZES[ar] : FLASH_1K_SIZES[ar]
    const eff = (c.model === 'nano-banana-pro' || c.model === 'nano-banana-2') ? c.size : '1K'
    const mul = eff === '4K' ? 4 : eff === '2K' ? 2 : 1
    const ew = base.w * mul
    const eh = base.h * mul
    if (r.width !== ew || r.height !== eh) {
      throw new Error(JSON.stringify({ case: c, got: r, expected: { width: ew, height: eh } }))
    }
    ok += 1
  }
  console.log('placeholder-size-tests ok', ok)
}
main().catch(e => { console.error('test failed', String(e && e.message || e)); process.exit(1) })
