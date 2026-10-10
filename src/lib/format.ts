import type { Result1D } from './pack1d'
import type { Result2D } from './pack2d'

/** A number with at most `d` decimals and no trailing zeros. */
export const num = (v: number, d = 2) => String(+v.toFixed(d))
export const pct = (v: number) => `${(v * 100).toFixed(1)}%`

const cell = (v: string | number) => {
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csv = (rows: (string | number)[][]) => rows.map((r) => r.map(cell).join(',')).join('\n') + '\n'

/** One row per cut: bar number, stock, part, length, offset from the bar start. */
export function csv1d(r: Result1D): string {
  const rows: (string | number)[][] = [['bar', 'stock', 'stock_length', 'part', 'length', 'start']]
  r.bars.forEach((b, i) => b.cuts.forEach((c) => rows.push([i + 1, b.stockLabel, num(b.length), c.label, num(c.length), num(c.pos)])))
  for (const u of r.unplaced) rows.push(['unplaced', '', '', u.label, num(u.length), ''])
  return csv(rows)
}

/** One row per placed part: sheet number, stock, part, position and size as laid out. */
export function csv2d(r: Result2D): string {
  const rows: (string | number)[][] = [['sheet', 'stock', 'sheet_length', 'sheet_width', 'part', 'x', 'y', 'length', 'width', 'rotated']]
  r.sheets.forEach((s, i) =>
    s.placements.forEach((p) => rows.push([i + 1, s.stockLabel, num(s.length), num(s.width), p.label, num(p.x), num(p.y), num(p.w), num(p.h), p.rotated ? 'yes' : 'no'])),
  )
  for (const u of r.unplaced) rows.push(['unplaced', '', '', '', u.label, '', '', num(u.length), num(u.width), ''])
  return csv(rows)
}
