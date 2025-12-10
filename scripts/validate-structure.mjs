import { promises as fs } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

async function exists(p) { try { await fs.access(p); return true } catch { return false } }
async function read(p) { return fs.readFile(p, 'utf-8') }
function note(ok, msg) { console.log(`${ok ? 'OK' : 'FAIL'} ${msg}`) }

let allOk = true

const dirs = [
  'src/services',
  'src/features',
  'src/ui',
  'src/i18n',
  'src/workers',
  'src/types'
]
for (const d of dirs) {
  const ok = await exists(path.join(root, d))
  note(ok, `dir ${d}`)
  if (!ok) allOk = false
}

const storageFile = path.join(root, 'src/services/boardsStorage.ts')
const storageOk = await exists(storageFile)
note(storageOk, 'file src/services/boardsStorage.ts')
if (!storageOk) allOk = false

const translationsFile = path.join(root, 'translations.ts')
const translationsOk = await exists(translationsFile)
note(translationsOk, 'file translations.ts')
if (translationsOk) {
  const txt = await read(translationsFile)
  const hasZH = /\bZH\b/.test(txt)
  const hasZho = /\bzho\b/.test(txt)
  note(hasZH, 'translations has ZH key')
  note(!hasZho, 'translations has no zho key')
  if (!hasZH || hasZho) allOk = false
}

const boardPanel = path.join(root, 'components/BoardPanel.tsx')
const boardPanelOk = await exists(boardPanel)
note(boardPanelOk, 'file components/BoardPanel.tsx')
if (boardPanelOk) {
  const txt = await read(boardPanel)
  const hasWorkerRef = /thumbWorker\.ts/.test(txt)
  note(hasWorkerRef, 'BoardPanel references thumbWorker.ts')
  if (!hasWorkerRef) allOk = false
}

const viteFile = path.join(root, 'vite.config.ts')
const viteOk = await exists(viteFile)
note(viteOk, 'file vite.config.ts')
if (viteOk) {
  const txt = await read(viteFile)
  const aliasSrc = /alias:\s*\{[\s\S]*?['\"]@['\"]:\s*path\.resolve\(\__dirname,\s*'src'\)/.test(txt)
  note(aliasSrc, "vite alias '@' points to src")
  if (!aliasSrc) allOk = false
}

const tsconfigFile = path.join(root, 'tsconfig.json')
const tsOk = await exists(tsconfigFile)
note(tsOk, 'file tsconfig.json')
if (tsOk) {
  const txt = await read(tsconfigFile)
  const hasPaths = /"paths"\s*:\s*\{[\s\S]*?"@\/\*"\s*:\s*\[\s*"src\/\*"\s*\]/.test(txt)
  note(hasPaths, "tsconfig paths '@/*' -> 'src/*'")
}

process.exit(allOk ? 0 : 1)
