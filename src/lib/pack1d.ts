import type { Effort, Part, Stock } from './model'
import { EPS, mulberry32, RANDOM_TRIES } from './util'

export type Cut1D = { partId: string; label: string; length: number; pos: number }
export type Bar = { stockId: string; stockLabel: string; length: number; cost: number; cuts: Cut1D[]; used: number }
export type Result1D = {
  bars: Bar[]
  unplaced: { partId: string; label: string; length: number }[]
  totalCost: number
  /** Sum of the stock bar lengths used. */
  stockLength: number
  /** Sum of the cut part lengths. */
  partLength: number
  /** Share of the stock that is not part (offcuts, kerf, trim), 0..1. */
  waste: number
  /** Stock used per stock id. */
  stockCount: Record<string, number>
}
export type Problem1D = { parts: Part[]; stock: Stock[]; kerf: number; trim: number; effort: Effort }

type Item = { partId: string; label: string; length: number }
type Open = { si: number; items: Item[]; used: number }

/** Length a bar of this stock offers once both ends are trimmed. */
const usable = (s: Stock, trim: number) => s.length - 2 * trim

/** Cutting-stock heuristic (first/best fit decreasing over many orderings) with stock-type choice by cost per used length. */
export function pack1d(prob: Problem1D): Result1D {
  const { stock, kerf, trim } = prob
  const items: Item[] = []
  for (const p of prob.parts) for (let i = 0; i < p.qty; i++) items.push({ partId: p.id, label: p.label, length: p.length })

  const orders: Item[][] = [[...items].sort((a, b) => b.length - a.length)]
  const rnd = mulberry32(12345)
  for (let r = 0; r < RANDOM_TRIES[prob.effort]; r++) {
    const key = new Map(items.map((it) => [it, it.length * (0.75 + 0.5 * rnd())]))
    orders.push([...items].sort((a, b) => key.get(b)! - key.get(a)!))
  }

  let best: { bars: Open[]; unplaced: Item[] } | null = null
  let bestScore: number[] = []
  for (const order of orders) {
    const run = packOnce(order, stock, kerf, trim)
    const score = scoreOf(run.bars, run.unplaced.length, stock)
    if (!best || lex(score, bestScore) < 0) {
      best = run
      bestScore = score
    }
  }
  return toResult(best ?? { bars: [], unplaced: [] }, stock, kerf)
}

function scoreOf(bars: Open[], unplaced: number, stock: Stock[]): number[] {
  let cost = 0, len = 0, sq = 0
  for (const b of bars) {
    cost += stock[b.si].cost
    len += stock[b.si].length
    const left = stock[b.si].length - b.used
    sq -= left * left // prefer a few long offcuts over many short ones
  }
  return [unplaced, round(cost), bars.length, round(len), sq]
}
const round = (v: number) => Math.round(v * 1e6) / 1e6
function lex(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

function packOnce(order: Item[], stock: Stock[], kerf: number, trim: number) {
  const left = stock.map((s) => s.qty ?? Infinity)
  const bars: Open[] = []
  const unplaced: Item[] = []
  const placed = new Array<boolean>(order.length).fill(false)
  for (let i = 0; i < order.length; i++) {
    const it = order[i]
    // best fit: the open bar left with the least room
    let bi = -1, room = Infinity
    for (let j = 0; j < bars.length; j++) {
      const b = bars[j]
      const r = usable(stock[b.si], trim) - (b.used + kerf + it.length)
      if (r >= -EPS && r < room) {
        room = r
        bi = j
      }
    }
    if (bi >= 0) {
      bars[bi].items.push(it)
      bars[bi].used += kerf + it.length
      placed[i] = true
      continue
    }
    // open a new bar of the type with the lowest cost per used length when filled greedily
    let pick = -1, pickRatio = Infinity
    for (let si = 0; si < stock.length; si++) {
      if (left[si] < 1 || usable(stock[si], trim) < it.length - EPS) continue
      let used = it.length
      for (let j = i + 1; j < order.length; j++) {
        if (!placed[j] && used + kerf + order[j].length <= usable(stock[si], trim) + EPS) used += kerf + order[j].length
      }
      const ratio = stock[si].cost > 0 ? stock[si].cost / used : stock[si].length / used - 1 + 1e-9
      if (ratio < pickRatio - 1e-12 || (Math.abs(ratio - pickRatio) <= 1e-12 && pick >= 0 && stock[si].length < stock[pick].length)) {
        pickRatio = ratio
        pick = si
      }
    }
    if (pick < 0) {
      unplaced.push(it)
      placed[i] = true
      continue
    }
    left[pick]--
    bars.push({ si: pick, items: [it], used: it.length })
    placed[i] = true
  }
  // shrink pass: a bar that ended up mostly empty may fit a cheaper (or shorter) stock
  for (const b of bars) {
    let bestSi = b.si
    for (let si = 0; si < stock.length; si++) {
      if (si === b.si || left[si] < 1 || usable(stock[si], trim) < b.used - EPS) continue
      const c = stock[si], cur = stock[bestSi]
      if (c.cost < cur.cost - 1e-12 || (Math.abs(c.cost - cur.cost) <= 1e-12 && c.length < cur.length)) bestSi = si
    }
    if (bestSi !== b.si) {
      left[b.si]++
      left[bestSi]--
      b.si = bestSi
    }
  }
  return { bars, unplaced }
}

function toResult(run: { bars: Open[]; unplaced: Item[] }, stock: Stock[], kerf: number): Result1D {
  const bars: Bar[] = run.bars.map((b) => {
    let pos = 0
    const cuts = b.items.map((it) => {
      const c = { partId: it.partId, label: it.label, length: it.length, pos }
      pos += it.length + kerf
      return c
    })
    const s = stock[b.si]
    return { stockId: s.id, stockLabel: s.label, length: s.length, cost: s.cost, cuts, used: b.used }
  })
  // keep the bars sorted by stock then by fullest first, so the list reads well
  bars.sort((a, b) => b.length - a.length || b.used - a.used)
  const stockLength = bars.reduce((t, b) => t + b.length, 0)
  const partLength = bars.reduce((t, b) => t + b.cuts.reduce((u, c) => u + c.length, 0), 0)
  const stockCount: Record<string, number> = {}
  for (const b of bars) stockCount[b.stockId] = (stockCount[b.stockId] ?? 0) + 1
  return {
    bars,
    unplaced: run.unplaced,
    totalCost: bars.reduce((t, b) => t + b.cost, 0),
    stockLength,
    partLength,
    waste: stockLength > 0 ? 1 - partLength / stockLength : 0,
    stockCount,
  }
}
