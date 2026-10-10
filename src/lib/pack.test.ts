import { describe, expect, it } from 'vitest'
import { csv1d, csv2d } from './format'
import type { Part, Stock } from './model'
import { pack1d, type Result1D } from './pack1d'
import { pack2d, type Result2D } from './pack2d'
import { mulberry32 } from './util'

const part = (id: string, length: number, qty: number, width = 0, grain = false): Part => ({ id, label: id, length, width, qty, grain })
const bar = (id: string, length: number, cost = 1, qty?: number): Stock => ({ id, label: id, length, width: 0, cost, qty })
const sheet = (id: string, length: number, width: number, cost = 1, qty?: number): Stock => ({ id, label: id, length, width, cost, qty })

function check1d(r: Result1D, parts: Part[], kerf: number, trim = 0) {
  const want = parts.reduce((t, p) => t + p.qty, 0)
  expect(r.bars.reduce((t, b) => t + b.cuts.length, 0) + r.unplaced.length).toBe(want)
  for (const b of r.bars) {
    let end = trim
    b.cuts.forEach((c, i) => {
      // cuts are laid out in order, separated by one kerf; positions are measured after the trim
      expect(c.pos).toBeGreaterThanOrEqual(0)
      if (i > 0) expect(c.pos).toBeCloseTo(end - trim + kerf, 6)
      end = trim + c.pos + c.length
    })
    expect(end).toBeLessThanOrEqual(b.length - trim + 1e-6)
  }
}

describe('pack1d', () => {
  it('packs a perfect fit into the minimum number of bars', () => {
    const parts = [part('a', 50, 2), part('b', 30, 2), part('c', 20, 2)]
    const r = pack1d({ parts, stock: [bar('s', 100)], kerf: 0, trim: 0, effort: 'balanced' })
    expect(r.bars).toHaveLength(2)
    expect(r.waste).toBeCloseTo(0, 9)
    check1d(r, parts, 0)
  })

  it('charges one kerf between neighbouring cuts', () => {
    const fits = pack1d({ parts: [part('a', 45, 2)], stock: [bar('s', 100)], kerf: 10, trim: 0, effort: 'fast' })
    expect(fits.bars).toHaveLength(1) // 45 + 10 + 45 = 100
    const no = pack1d({ parts: [part('a', 46, 2)], stock: [bar('s', 100)], kerf: 10, trim: 0, effort: 'fast' })
    expect(no.bars).toHaveLength(2) // 46 + 10 + 46 = 102
  })

  it('keeps cut positions valid and respects the lower bound', () => {
    const rnd = mulberry32(7)
    for (let n = 0; n < 20; n++) {
      const parts = Array.from({ length: 6 }, (_, i) => part('p' + i, 20 + Math.floor(rnd() * 80), 1 + Math.floor(rnd() * 4)))
      const kerf = 3, trim = 2
      const r = pack1d({ parts, stock: [bar('s', 240)], kerf, trim, effort: 'balanced' })
      check1d(r, parts, kerf, trim)
      const total = parts.reduce((t, p) => t + p.length * p.qty, 0)
      expect(r.bars.length).toBeGreaterThanOrEqual(Math.ceil(total / 236))
      expect(r.unplaced).toHaveLength(0)
    }
  })

  it('reports parts longer than every bar as unplaced', () => {
    const r = pack1d({ parts: [part('big', 300, 1), part('ok', 50, 1)], stock: [bar('s', 200)], kerf: 0, trim: 0, effort: 'fast' })
    expect(r.unplaced.map((u) => u.partId)).toEqual(['big'])
    expect(r.bars).toHaveLength(1)
  })

  it('prefers the cheaper stock mix', () => {
    // 3 x 90: three 100-bars cost 30; one 300-bar costs 12 but needs room for the kerf-free parts
    const r = pack1d({ parts: [part('a', 90, 3)], stock: [bar('short', 100, 10), bar('long', 300, 12)], kerf: 0, trim: 0, effort: 'balanced' })
    expect(r.totalCost).toBe(12)
    expect(r.bars).toHaveLength(1)
  })

  it('shrinks a nearly empty last bar to a shorter, cheaper stock', () => {
    const r = pack1d({ parts: [part('a', 90, 2), part('b', 40, 1)], stock: [bar('long', 200, 10), bar('short', 50, 2)], kerf: 0, trim: 0, effort: 'fast' })
    // 90 + 90 + 40 = 220 > 200, so two bars are needed; the 40 goes on a short bar
    expect(r.bars.filter((b) => b.stockId === 'short')).toHaveLength(1)
    expect(r.totalCost).toBe(12)
  })

  it('honours a limited stock quantity', () => {
    const r = pack1d({ parts: [part('a', 60, 3)], stock: [bar('s', 100, 1, 2)], kerf: 0, trim: 0, effort: 'fast' })
    expect(r.bars).toHaveLength(2)
    expect(r.unplaced).toHaveLength(1)
  })
})

function check2d(r: Result2D, parts: Part[], kerf: number, trim: number) {
  const want = parts.reduce((t, p) => t + p.qty, 0)
  expect(r.sheets.reduce((t, s) => t + s.placements.length, 0) + r.unplaced.length).toBe(want)
  for (const s of r.sheets) {
    for (const p of s.placements) {
      expect(p.x).toBeGreaterThanOrEqual(trim - 1e-6)
      expect(p.y).toBeGreaterThanOrEqual(trim - 1e-6)
      expect(p.x + p.w).toBeLessThanOrEqual(s.length - trim + 1e-6)
      expect(p.y + p.h).toBeLessThanOrEqual(s.width - trim + 1e-6)
      const src = parts.find((q) => q.id === p.partId)!
      const dims = p.rotated ? [src.width, src.length] : [src.length, src.width]
      expect([p.w, p.h]).toEqual(dims)
      if (src.grain) expect(p.rotated).toBe(false)
    }
    for (let i = 0; i < s.placements.length; i++)
      for (let j = i + 1; j < s.placements.length; j++) {
        const a = s.placements[i], b = s.placements[j]
        // a saw cut separates any two parts: the gap along some axis is at least one kerf
        const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))
        const gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h))
        expect(Math.max(gx, gy)).toBeGreaterThanOrEqual(kerf - 1e-6)
      }
  }
}

describe.each(['guillotine', 'maxrects'] as const)('pack2d %s', (algo) => {
  const base = { algo, effort: 'balanced' as const }
  it('tiles four quarters of a sheet with no waste', () => {
    const parts = [part('q', 50, 4, 50)]
    const r = pack2d({ ...base, parts, stock: [sheet('s', 100, 100)], kerf: 0, trim: 0 })
    expect(r.sheets).toHaveLength(1)
    expect(r.waste).toBeCloseTo(0, 9)
    check2d(r, parts, 0, 0)
  })

  it('accounts for the kerf between parts', () => {
    const two = [part('a', 49, 2, 100)]
    expect(pack2d({ ...base, parts: two, stock: [sheet('s', 100, 100)], kerf: 2, trim: 0 }).sheets).toHaveLength(1) // 49 + 2 + 49
    const wide = [part('a', 50, 2, 100)]
    expect(pack2d({ ...base, parts: wide, stock: [sheet('s', 100, 100)], kerf: 2, trim: 0 }).sheets).toHaveLength(2) // 102 > 100
  })

  it('rotates a part unless its grain is locked', () => {
    const free = [part('a', 90, 1, 40)]
    const f = pack2d({ ...base, parts: free, stock: [sheet('s', 50, 100)], kerf: 0, trim: 0 })
    expect(f.unplaced).toHaveLength(0)
    expect(f.sheets[0].placements[0].rotated).toBe(true)
    const locked = [part('a', 90, 1, 40, true)]
    const l = pack2d({ ...base, parts: locked, stock: [sheet('s', 50, 100)], kerf: 0, trim: 0 })
    expect(l.unplaced).toHaveLength(1)
  })

  it('applies trim to every edge', () => {
    const parts = [part('a', 96, 1, 96)]
    expect(pack2d({ ...base, parts, stock: [sheet('s', 100, 100)], kerf: 0, trim: 2 }).sheets).toHaveLength(1)
    expect(pack2d({ ...base, parts, stock: [sheet('s', 100, 100)], kerf: 0, trim: 3 }).unplaced).toHaveLength(1)
  })

  it('produces valid layouts on random jobs', () => {
    const rnd = mulberry32(42)
    for (let n = 0; n < 12; n++) {
      const parts = Array.from({ length: 7 }, (_, i) =>
        part('p' + i, 20 + Math.floor(rnd() * 90), 1 + Math.floor(rnd() * 3), 20 + Math.floor(rnd() * 70), rnd() < 0.3),
      )
      const kerf = 3, trim = 5
      const r = pack2d({ ...base, effort: 'fast', parts, stock: [sheet('s', 244, 122)], kerf, trim })
      check2d(r, parts, kerf, trim)
      expect(r.unplaced).toHaveLength(0)
      const area = parts.reduce((t, p) => t + p.length * p.width * p.qty, 0)
      expect(r.sheets.length).toBeGreaterThanOrEqual(Math.ceil(area / (234 * 112)))
    }
  })

  it('picks the cheaper sheet size for the leftovers', () => {
    const parts = [part('a', 100, 2, 100), part('b', 40, 1, 40)]
    const r = pack2d({ ...base, parts, stock: [sheet('big', 100, 100, 10), sheet('small', 50, 50, 3)], kerf: 0, trim: 0 })
    expect(r.totalCost).toBe(23)
  })
})

describe('csv', () => {
  it('writes one row per cut and escapes commas', () => {
    const r1 = pack1d({ parts: [part('a,b', 40, 2)], stock: [bar('s', 100)], kerf: 5, trim: 0, effort: 'fast' })
    const lines = csv1d(r1).trim().split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('1,s,100,"a,b",40,0')
    expect(lines[2]).toBe('1,s,100,"a,b",40,45')
    const r2 = pack2d({ parts: [part('x', 10, 1, 20)], stock: [sheet('s', 50, 50)], kerf: 0, trim: 0, algo: 'guillotine', effort: 'fast' })
    expect(csv2d(r2).trim().split('\n')[1]).toBe('1,s,50,50,x,0,0,10,20,no')
  })
})
