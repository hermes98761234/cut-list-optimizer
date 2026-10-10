export type Unit = 'mm' | 'cm' | 'in'
export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'
export type Mode = '1d' | '2d'
export type Algo = 'guillotine' | 'maxrects'
export type Effort = 'fast' | 'balanced' | 'thorough'

/**
 * A part to cut. `length` is the only size for bars (1D); sheets (2D) also use `width`.
 * `grain`: the part's length must run along the sheet's length, so it is never rotated.
 */
export type Part = { id: string; label: string; length: number; width: number; qty: number; grain: boolean }
/** Stock to cut from. `qty` undefined means unlimited. Bars ignore `width`. */
export type Stock = { id: string; label: string; length: number; width: number; cost: number; qty?: number }

export type Settings = {
  unit: Unit
  lang: Lang
  theme: Theme
  kerf: number
  /** Removed from every edge of a sheet, or from each end of a bar. */
  trim: number
  algo: Algo
  effort: Effort
  currency: string
}
export type AppState = {
  mode: Mode
  settings: Settings
  parts1: Part[]
  stock1: Stock[]
  parts2: Part[]
  stock2: Stock[]
}

export const MAX_QTY = 10000
export const newId = () => Math.random().toString(36).slice(2, 10)
export const newPart = (mode: Mode): Part => ({ id: newId(), label: '', length: mode === '1d' ? 500 : 600, width: 300, qty: 1, grain: false })
export const newStock = (mode: Mode): Stock => ({ id: newId(), label: '', length: mode === '1d' ? 2400 : 2440, width: 1220, cost: 0 })

const p = (id: string, label: string, length: number, width: number, qty: number, grain = false): Part => ({ id, label, length, width, qty, grain })

/** A small bookcase from 18 mm plywood, and a deck/frame job from lumber. */
export const DEFAULT_STATE: AppState = {
  mode: '2d',
  settings: { unit: 'mm', lang: 'en', theme: 'auto', kerf: 3, trim: 0, algo: 'guillotine', effort: 'balanced', currency: '$' },
  parts1: [
    p('b1', 'Rail', 1200, 0, 4),
    p('b2', 'Post', 800, 0, 6),
    p('b3', 'Brace', 650, 0, 5),
    p('b4', 'Block', 450, 0, 8),
    p('b5', 'Spacer', 300, 0, 6),
  ],
  stock1: [
    { id: 's1', label: '2400 bar', length: 2400, width: 0, cost: 6 },
    { id: 's2', label: '3000 bar', length: 3000, width: 0, cost: 8 },
  ],
  parts2: [
    p('p1', 'Side', 1800, 300, 2, true),
    p('p2', 'Shelf', 764, 280, 5, true),
    p('p3', 'Top', 800, 300, 1, true),
    p('p4', 'Back', 1764, 780, 1),
    p('p5', 'Drawer front', 380, 150, 4),
    p('p6', 'Drawer side', 280, 120, 8),
    p('p7', 'Plinth', 764, 80, 2),
  ],
  stock2: [{ id: 't1', label: 'Plywood 18 mm', length: 2440, width: 1220, cost: 48 }],
}

const validSize = (v: number) => Number.isFinite(v) && v > 0 && v <= 1e6
const validQty = (v: number) => Number.isInteger(v) && v >= 1 && v <= MAX_QTY

/** Field keys that fail validation: `settings.kerf`, `<id>.<field>`. */
export function invalidFields(s: AppState): Set<string> {
  const bad = new Set<string>()
  if (!(Number.isFinite(s.settings.kerf) && s.settings.kerf >= 0)) bad.add('settings.kerf')
  if (!(Number.isFinite(s.settings.trim) && s.settings.trim >= 0)) bad.add('settings.trim')
  const oneD = s.mode === '1d'
  for (const x of oneD ? s.parts1 : s.parts2) {
    if (!validSize(x.length)) bad.add(`${x.id}.length`)
    if (!oneD && !validSize(x.width)) bad.add(`${x.id}.width`)
    if (!validQty(x.qty)) bad.add(`${x.id}.qty`)
  }
  for (const x of oneD ? s.stock1 : s.stock2) {
    if (!validSize(x.length)) bad.add(`${x.id}.length`)
    if (!oneD && !validSize(x.width)) bad.add(`${x.id}.width`)
    if (!(Number.isFinite(x.cost) && x.cost >= 0)) bad.add(`${x.id}.cost`)
    if (x.qty !== undefined && !validQty(x.qty)) bad.add(`${x.id}.qty`)
  }
  return bad
}

const KEY = 'clo:v1'
const oneOf = <V extends string>(v: unknown, allowed: readonly V[], fallback: V): V => (allowed.includes(v as V) ? (v as V) : fallback)
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const isRec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const cleanParts = (v: unknown, fallback: Part[]): Part[] =>
  Array.isArray(v)
    ? v.filter(isRec).map((x) => ({
        id: typeof x.id === 'string' ? x.id : newId(),
        label: typeof x.label === 'string' ? x.label : '',
        length: num(x.length, NaN),
        width: num(x.width, NaN),
        qty: num(x.qty, 1),
        grain: x.grain === true,
      }))
    : fallback
const cleanStock = (v: unknown, fallback: Stock[]): Stock[] =>
  Array.isArray(v)
    ? v.filter(isRec).map((x) => ({
        id: typeof x.id === 'string' ? x.id : newId(),
        label: typeof x.label === 'string' ? x.label : '',
        length: num(x.length, NaN),
        width: num(x.width, NaN),
        cost: num(x.cost, 0),
        qty: typeof x.qty === 'number' ? x.qty : undefined,
      }))
    : fallback

export function loadState(): AppState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (isRec(s) && isRec(s.settings)) {
      // Saved data may come from an older version or be hand-edited: keep only what we understand.
      const d = DEFAULT_STATE.settings, st = s.settings
      return {
        mode: oneOf(s.mode, ['1d', '2d'], DEFAULT_STATE.mode),
        settings: {
          unit: oneOf(st.unit, ['mm', 'cm', 'in'], d.unit),
          lang: oneOf(st.lang, ['en', 'uk'], d.lang),
          theme: oneOf(st.theme, ['auto', 'light', 'dark'], d.theme),
          kerf: num(st.kerf, d.kerf),
          trim: num(st.trim, d.trim),
          algo: oneOf(st.algo, ['guillotine', 'maxrects'], d.algo),
          effort: oneOf(st.effort, ['fast', 'balanced', 'thorough'], d.effort),
          currency: typeof st.currency === 'string' ? st.currency.slice(0, 4) : d.currency,
        },
        parts1: cleanParts(s.parts1, DEFAULT_STATE.parts1),
        stock1: cleanStock(s.stock1, DEFAULT_STATE.stock1),
        parts2: cleanParts(s.parts2, DEFAULT_STATE.parts2),
        stock2: cleanStock(s.stock2, DEFAULT_STATE.stock2),
      }
    }
  } catch {
    // fall through to the defaults
  }
  return DEFAULT_STATE
}

export function saveState(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage may be full or disabled; the app still works
  }
}
