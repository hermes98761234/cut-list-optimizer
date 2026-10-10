import type { Bar } from '../lib/pack1d'
import type { Sheet } from '../lib/pack2d'
import { num } from '../lib/format'

import { fillOf, type Colors } from './colors'

const VW = 1000

/** One bar: parts drawn to scale, kerf gaps visible, the leftover marked as an offcut. */
export function BarDiagram({ bar, colors, kerf, trim, offcut }: { bar: Bar; colors: Colors; kerf: number; trim: number; offcut: string }) {
  const k = VW / bar.length
  const H = 46
  const end = bar.cuts.length ? bar.cuts[bar.cuts.length - 1].pos + bar.cuts[bar.cuts.length - 1].length : 0
  const rest = bar.length - trim - (trim + end)
  return (
    <svg viewBox={`0 0 ${VW} ${H}`} className="diagram" role="img" aria-label={offcut}>
      <rect x={0} y={0} width={VW} height={H} className="stock-rect" />
      {trim > 0 && <rect x={0} y={0} width={trim * k} height={H} className="trim-rect" />}
      {trim > 0 && <rect x={VW - trim * k} y={0} width={trim * k} height={H} className="trim-rect" />}
      {bar.cuts.map((c, i) => {
        const x = (trim + c.pos) * k, w = c.length * k
        const text = `${c.label} ${num(c.length)}`
        return (
          <g key={i}>
            <title>{text}</title>
            <rect x={x} y={2} width={w} height={H - 4} fill={fillOf(colors, c.partId)} className="piece" />
            {w > text.length * 7.5 ? (
              <text x={x + w / 2} y={H / 2 + 5} textAnchor="middle" className="piece-text">{text}</text>
            ) : w > num(c.length).length * 7.5 ? (
              <text x={x + w / 2} y={H / 2 + 5} textAnchor="middle" className="piece-text">{num(c.length)}</text>
            ) : null}
          </g>
        )
      })}
      {rest * k > 60 && (
        <text x={(trim + end + kerf) * k + (rest - kerf) * k / 2} y={H / 2 + 5} textAnchor="middle" className="offcut-text">{offcut}</text>
      )}
    </svg>
  )
}

/** One sheet: parts to scale with their sizes; a mark shows parts that keep their grain direction. */
export function SheetDiagram({ sheet, colors, grainIds, trim, label }: { sheet: Sheet; colors: Colors; grainIds: Set<string>; trim: number; label: string }) {
  const k = VW / sheet.length
  const H = sheet.width * k
  return (
    <svg viewBox={`0 0 ${VW} ${H}`} className="diagram sheet" role="img" aria-label={label}>
      <rect x={0} y={0} width={VW} height={H} className="stock-rect" />
      {trim > 0 && <rect x={trim * k} y={trim * k} width={VW - 2 * trim * k} height={H - 2 * trim * k} className="trim-frame" />}
      {sheet.placements.map((p, i) => {
        const x = p.x * k, y = p.y * k, w = p.w * k, h = p.h * k
        const dims = `${num(p.w)}×${num(p.h)}`
        const title = `${p.label} ${dims}${p.rotated ? ' ↻' : ''}`
        const roomName = w > p.label.length * 8 + 6
        const roomDims = w > dims.length * 8 + 6
        const grain = grainIds.has(p.partId)
        return (
          <g key={i}>
            <title>{title}</title>
            <rect x={x} y={y} width={w} height={h} fill={fillOf(colors, p.partId)} className="piece" />
            {h >= 20 && roomName && p.label && (
              <text x={x + w / 2} y={y + h / 2 + (h >= 40 && roomDims ? -3 : 5)} textAnchor="middle" className="piece-text">{p.label}</text>
            )}
            {h >= 40 && roomDims && (
              <text x={x + w / 2} y={y + h / 2 + 15} textAnchor="middle" className="piece-text small">{dims}{p.rotated ? ' ↻' : ''}</text>
            )}
            {h >= 20 && !roomName && roomDims && !p.label && (
              <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle" className="piece-text small">{dims}</text>
            )}
            {grain && w > 24 && h > 12 && <text x={x + 5} y={y + 14} className="piece-text small">→</text>}
          </g>
        )
      })}
    </svg>
  )
}
