import type { Algo, Effort, Part, Stock } from './model'
import { EPS, mulberry32, RANDOM_TRIES } from './util'

export type Placement = { partId: string; label: string; x: number; y: number; w: number; h: number; rotated: boolean }
export type Sheet = { stockId: string; stockLabel: string; length: number; width: number; cost: number; placements: Placement[]; used: number }
export type Result2D = {
  sheets: Sheet[]
  unplaced: { partId: string; label: string; length: number; width: number }[]
  totalCost: number
  stockArea: number
  partArea: number
  /** Share of the stock area that is not part (offcuts, kerf, trim), 0..1. */
  waste: number
  stockCount: Record<string, number>
}
export type Problem2D = { parts: Part[]; stock: Stock[]; kerf: number; trim: number; algo: Algo; effort: Effort }

type Rect = { x: number; y: number; w: number; h: number }
/** `l` is the part's length (x axis, along the grain), `w` its width (y axis). */
type Item = { partId: string; label: string; l: number; w: number; grain: boolean }
type Heuristic = 'bssf' | 'blsf' | 'baf' | 'bl'
type Cand = { bin: Bin; fi: number; rotated: boolean; s1: number; s2: number }

/**
 * One sheet being filled. Guillotine bins keep disjoint free rectangles split with a kerf gap, so every
 * layout can be cut edge to edge. MaxRects bins keep overlapping maximal free rectangles; the kerf is
 * handled by growing the sheet and every part by one kerf.
 */
class Bin {
  free: Rect[]
  placed: Placement[] = []
  used = 0
  readonly si: number
  readonly stock: Stock
  readonly algo: Algo
  readonly kerf: number
  readonly trim: number
  readonly heur: Heuristic
  readonly splitShort: boolean
  constructor(si: number, stock: Stock, algo: Algo, kerf: number, trim: number, heur: Heuristic, splitShort: boolean) {
    this.si = si
    this.stock = stock
    this.algo = algo
    this.kerf = kerf
    this.trim = trim
    this.heur = heur
    this.splitShort = splitShort
    const W = stock.length - 2 * trim, H = stock.width - 2 * trim
    const k = algo === 'maxrects' ? kerf : 0
    this.free = W > EPS && H > EPS ? [{ x: 0, y: 0, w: W + k, h: H + k }] : []
  }

  private dims(it: Item, rotated: boolean) {
    const k = this.algo === 'maxrects' ? this.kerf : 0
    return rotated ? { w: it.w + k, h: it.l + k } : { w: it.l + k, h: it.w + k }
  }

  find(it: Item): Cand | null {
    let best: Cand | null = null
    for (let fi = 0; fi < this.free.length; fi++) {
      const f = this.free[fi]
      for (const rotated of it.grain ? [false] : [false, true]) {
        const d = this.dims(it, rotated)
        if (d.w > f.w + EPS || d.h > f.h + EPS) continue
        const dw = f.w - d.w, dh = f.h - d.h
        let s1: number, s2: number
        switch (this.heur) {
          case 'bssf':
            s1 = Math.min(dw, dh)
            s2 = Math.max(dw, dh)
            break
          case 'blsf':
            s1 = Math.max(dw, dh)
            s2 = Math.min(dw, dh)
            break
          case 'baf':
            s1 = f.w * f.h - d.w * d.h
            s2 = Math.min(dw, dh)
            break
          default: // bottom-left
            s1 = f.y + d.h
            s2 = f.x
        }
        if (!best || s1 < best.s1 - EPS || (Math.abs(s1 - best.s1) <= EPS && s2 < best.s2 - EPS)) best = { bin: this, fi, rotated, s1, s2 }
      }
    }
    return best
  }

  place(it: Item, c: Cand) {
    const f = this.free[c.fi]
    const d = this.dims(it, c.rotated)
    const actual = c.rotated ? { w: it.w, h: it.l } : { w: it.l, h: it.w }
    this.placed.push({ partId: it.partId, label: it.label, x: this.trim + f.x, y: this.trim + f.y, w: actual.w, h: actual.h, rotated: c.rotated })
    this.used += it.l * it.w
    if (this.algo === 'guillotine') this.splitGuillotine(c.fi, d.w, d.h)
    else this.splitMaxRects({ x: f.x, y: f.y, w: d.w, h: d.h })
  }

  private splitGuillotine(fi: number, w: number, h: number) {
    const f = this.free[fi]
    this.free.splice(fi, 1)
    const k = this.kerf
    const lw = f.w - w - k, lh = f.h - h - k // room left to the right of / below the part, past the saw cut
    // horizontal split: the strip below spans the full width; vertical: the strip on the right spans the full height
    const horizontal = this.splitShort ? f.w - w < f.h - h : f.w - w >= f.h - h
    const right: Rect = horizontal ? { x: f.x + w + k, y: f.y, w: lw, h } : { x: f.x + w + k, y: f.y, w: lw, h: f.h }
    const below: Rect = horizontal ? { x: f.x, y: f.y + h + k, w: f.w, h: lh } : { x: f.x, y: f.y + h + k, w, h: lh }
    for (const r of [right, below]) if (r.w > EPS && r.h > EPS) this.free.push(r)
  }

  private splitMaxRects(p: Rect) {
    const out: Rect[] = []
    for (const f of this.free) {
      if (p.x >= f.x + f.w - EPS || p.x + p.w <= f.x + EPS || p.y >= f.y + f.h - EPS || p.y + p.h <= f.y + EPS) {
        out.push(f)
        continue
      }
      if (p.x > f.x + EPS) out.push({ x: f.x, y: f.y, w: p.x - f.x, h: f.h })
      if (p.x + p.w < f.x + f.w - EPS) out.push({ x: p.x + p.w, y: f.y, w: f.x + f.w - p.x - p.w, h: f.h })
      if (p.y > f.y + EPS) out.push({ x: f.x, y: f.y, w: f.w, h: p.y - f.y })
      if (p.y + p.h < f.y + f.h - EPS) out.push({ x: f.x, y: p.y + p.h, w: f.w, h: f.y + f.h - p.y - p.h })
    }
    this.free = out.filter((a, i) => !out.some((b, j) => j !== i && contains(b, a) && (!contains(a, b) || j < i)))
  }
}

const contains = (a: Rect, b: Rect) => b.x >= a.x - EPS && b.y >= a.y - EPS && b.x + b.w <= a.x + a.w + EPS && b.y + b.h <= a.y + a.h + EPS

type Variant = { heur: Heuristic; splitShort: boolean }
const variants = (algo: Algo): Variant[] =>
  algo === 'guillotine'
    ? (['bssf', 'baf', 'blsf'] as const).flatMap((heur) => [true, false].map((splitShort) => ({ heur, splitShort })))
    : (['bssf', 'baf', 'blsf', 'bl'] as const).map((heur) => ({ heur, splitShort: true }))

/** Cutting-stock heuristic for rectangles: many orderings x placement rules, the best layout wins. */
export function pack2d(prob: Problem2D): Result2D {
  const { stock, kerf, trim, algo } = prob
  const items: Item[] = []
  for (const p of prob.parts) for (let i = 0; i < p.qty; i++) items.push({ partId: p.id, label: p.label, l: p.length, w: p.width, grain: p.grain })

  const keys: ((it: Item) => number)[] = [(i) => i.l * i.w, (i) => Math.max(i.l, i.w), (i) => i.l + i.w, (i) => i.l, (i) => i.w]
  const orders: Item[][] = keys.map((k) => [...items].sort((a, b) => k(b) - k(a)))
  const rnd = mulberry32(98765)
  for (let r = 0; r < RANDOM_TRIES[prob.effort]; r++) {
    const noisy = new Map(items.map((it) => [it, it.l * it.w * (0.7 + 0.6 * rnd())]))
    orders.push([...items].sort((a, b) => noisy.get(b)! - noisy.get(a)!))
  }

  let best: { bins: Bin[]; unplaced: Item[] } | null = null
  let bestScore: number[] = []
  for (const v of variants(algo)) {
    for (const order of orders) {
      const run = packOnce(order, stock, kerf, trim, algo, v)
      const score = scoreOf(run.bins, run.unplaced.length)
      if (!best || lex(score, bestScore) < 0) {
        best = run
        bestScore = score
      }
    }
  }
  return toResult(best ?? { bins: [], unplaced: [] })
}

function scoreOf(bins: Bin[], unplaced: number): number[] {
  let cost = 0, area = 0, sq = 0
  for (const b of bins) {
    cost += b.stock.cost
    const a = b.stock.length * b.stock.width
    area += a
    sq -= (b.used / a) ** 2 // prefer full sheets plus one nearly empty over several half-full
  }
  return [unplaced, round(cost), bins.length, round(area), round(sq)]
}
const round = (v: number) => Math.round(v * 1e6) / 1e6
function lex(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

function packOnce(order: Item[], stock: Stock[], kerf: number, trim: number, algo: Algo, v: Variant) {
  const left = stock.map((s) => s.qty ?? Infinity)
  const mk = (si: number) => new Bin(si, stock[si], algo, kerf, trim, v.heur, v.splitShort)
  const bins: Bin[] = []
  const unplaced: Item[] = []
  const placed = new Array<boolean>(order.length).fill(false)
  for (let i = 0; i < order.length; i++) {
    const it = order[i]
    let cand: Cand | null = null
    for (const b of bins) {
      const c = b.find(it)
      if (c && (!cand || c.s1 < cand.s1 - EPS || (Math.abs(c.s1 - cand.s1) <= EPS && c.s2 < cand.s2))) cand = c
    }
    if (cand) {
      cand.bin.place(it, cand)
      placed[i] = true
      continue
    }
    // open a new sheet of the type with the lowest cost per area filled when packed greedily
    let pick: Bin | null = null, pickCand: Cand | null = null, pickRatio = Infinity
    for (let si = 0; si < stock.length; si++) {
      if (left[si] < 1) continue
      const probe = mk(si)
      const c = probe.find(it)
      if (!c) continue
      let ratio = 0
      if (stock.length > 1) {
        probe.place(it, c)
        for (let j = i + 1; j < order.length; j++) {
          if (placed[j]) continue
          const cj = probe.find(order[j])
          if (cj) probe.place(order[j], cj)
        }
        const area = stock[si].length * stock[si].width
        ratio = stock[si].cost > 0 ? stock[si].cost / probe.used : area / probe.used - 1 + 1e-9
        const fresh = mk(si)
        const c0 = fresh.find(it)!
        if (ratio < pickRatio - 1e-12 || (Math.abs(ratio - pickRatio) <= 1e-12 && pick && area < pick.stock.length * pick.stock.width)) {
          pick = fresh
          pickCand = c0
          pickRatio = ratio
        }
      } else {
        pick = probe
        pickCand = c
      }
    }
    if (!pick || !pickCand) {
      unplaced.push(it)
      placed[i] = true
      continue
    }
    left[pick.si]--
    bins.push(pick)
    pick.place(it, pickCand)
    placed[i] = true
  }
  // shrink pass: repack a sheet's parts into a cheaper (or smaller) sheet when they all fit
  for (let bi = 0; bi < bins.length; bi++) {
    const b = bins[bi]
    const parts: Item[] = b.placed.map((p) => ({ partId: p.partId, label: p.label, l: p.rotated ? p.h : p.w, w: p.rotated ? p.w : p.h, grain: !p.rotated && order.find((o) => o.partId === p.partId)?.grain === true }))
    parts.sort((a, c) => c.l * c.w - a.l * a.w)
    let cur = b
    for (let si = 0; si < stock.length; si++) {
      if (left[si] < 1 || si === cur.si) continue
      const c = stock[si], s = cur.stock
      if (!(c.cost < s.cost - 1e-12 || (Math.abs(c.cost - s.cost) <= 1e-12 && c.length * c.width < s.length * s.width - EPS))) continue
      if (c.length * c.width < b.used - EPS) continue
      const trial = mk(si)
      let ok = true
      for (const it of parts) {
        const cd = trial.find(it)
        if (!cd) {
          ok = false
          break
        }
        trial.place(it, cd)
      }
      if (ok) cur = trial
    }
    if (cur !== b) {
      left[b.si]++
      left[cur.si]--
      bins[bi] = cur
    }
  }
  return { bins, unplaced }
}

function toResult(run: { bins: Bin[]; unplaced: Item[] }): Result2D {
  const sheets: Sheet[] = run.bins.map((b) => ({
    stockId: b.stock.id,
    stockLabel: b.stock.label,
    length: b.stock.length,
    width: b.stock.width,
    cost: b.stock.cost,
    placements: b.placed,
    used: b.used,
  }))
  sheets.sort((a, b) => b.length * b.width - a.length * a.width || b.used - a.used)
  const stockArea = sheets.reduce((t, s) => t + s.length * s.width, 0)
  const partArea = sheets.reduce((t, s) => t + s.used, 0)
  const stockCount: Record<string, number> = {}
  for (const s of sheets) stockCount[s.stockId] = (stockCount[s.stockId] ?? 0) + 1
  return {
    sheets,
    unplaced: run.unplaced.map((u) => ({ partId: u.partId, label: u.label, length: u.l, width: u.w })),
    totalCost: sheets.reduce((t, s) => t + s.cost, 0),
    stockArea,
    partArea,
    waste: stockArea > 0 ? 1 - partArea / stockArea : 0,
    stockCount,
  }
}
