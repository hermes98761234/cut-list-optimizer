import type { T } from '../i18n'
import { csv1d, csv2d, num, pct } from '../lib/format'
import type { Part, Stock } from '../lib/model'
import type { Output, Status } from '../useOptimizer'
import type { Colors } from './colors'
import { BarDiagram, SheetDiagram } from './Diagrams'

type Props = {
  status: Status
  invalid: boolean
  empty: boolean
  parts: Part[]
  stock: Stock[]
  kerf: number
  trim: number
  unit: string
  currency: string
  t: T
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function Results({ status, invalid, empty, parts, stock, kerf, trim, unit, currency, t }: Props) {
  if (invalid) return <div className="box"><p className="verdict err">{t('Fix the highlighted fields.')}</p></div>
  if (empty) return <div className="box"><p className="hint">{t('Add parts and stock to get a cutting plan.')}</p></div>
  if (status.state === 'error') return <div className="box"><p className="verdict err">{t('Error: {0}', status.message)}</p></div>
  if (status.state !== 'done') return <div className="box"><p className="hint">{t('Optimising…')}</p></div>
  return <Done out={status.out} parts={parts} stock={stock} kerf={kerf} trim={trim} unit={unit} currency={currency} t={t} />
}

function Done({ out, parts, stock, kerf, trim, unit, currency, t }: Omit<Props, 'status' | 'invalid' | 'empty'> & { out: Output }) {
  const colors: Colors = new Map(parts.map((p, i) => [p.id, i]))
  const grainIds = new Set(parts.filter((p) => p.grain).map((p) => p.id))
  const money = (v: number) => `${currency}${num(v)}`
  const two = out.mode === '2d'
  const r = out.result
  const count = out.mode === '1d' ? out.result.bars.length : out.result.sheets.length
  const placed = out.mode === '1d' ? out.result.bars.reduce((s, b) => s + b.cuts.length, 0) : out.result.sheets.reduce((s, b) => s + b.placements.length, 0)
  const total = parts.reduce((s, p) => s + p.qty, 0)
  const stockLabel = (id: string) => stock.find((s) => s.id === id)?.label || `S${stock.findIndex((s) => s.id === id) + 1}`

  return (
    <>
      <div className="box">
        <p className={`verdict ${r.unplaced.length ? 'warn' : 'ok'}`}>
          {r.unplaced.length
            ? t('{0} of {1} parts could not be placed.', r.unplaced.length, total)
            : two
              ? t('All {0} parts fit on {1} sheets.', placed, count)
              : t('All {0} parts fit on {1} bars.', placed, count)}
        </p>
        <div className="stats">
          <div><span>{two ? t('Sheets') : t('Bars')}</span><b>{count}</b></div>
          <div><span>{t('Total cost')}</span><b>{money(r.totalCost)}</b></div>
          <div><span>{t('Waste')}</span><b>{pct(r.waste)}</b></div>
          <div><span>{t('Used')}</span><b>{pct(1 - r.waste)}</b></div>
        </div>
        {r.unplaced.length > 0 && (
          <p className="warn-text">
            {t('Too large for any stock, or stock ran out:')}{' '}
            {r.unplaced.map((u) => ('width' in u ? `${u.label || '?'} ${num(u.length)}×${num(u.width)}` : `${u.label || '?'} ${num(u.length)}`)).join(', ')}
          </p>
        )}
        <h3>{t('Buy list')}</h3>
        <table className="data">
          <tbody>
            {Object.entries(r.stockCount).map(([id, n]) => {
              const s = stock.find((x) => x.id === id)
              return (
                <tr key={id}>
                  <td>{stockLabel(id)}</td>
                  <td>{s ? (two ? `${num(s.length)}×${num(s.width)} ${unit}` : `${num(s.length)} ${unit}`) : ''}</td>
                  <td>× {n}</td>
                  <td>{money((s?.cost ?? 0) * n)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="row noprint">
          <button
            onClick={() => download(two ? 'cut-list-sheets.csv' : 'cut-list-bars.csv', out.mode === '1d' ? csv1d(out.result) : csv2d(out.result))}
          >
            {t('Download CSV')}
          </button>
          <button onClick={() => window.print()}>{t('Print / Save as PDF')}</button>
          <span className="hint">{t('Kerf {0} {1}, edge trim {2} {1}.', num(kerf), unit, num(trim))}</span>
        </div>
      </div>

      {out.mode === '1d'
        ? out.result.bars.map((b, i) => {
            const end = b.cuts.length ? b.cuts[b.cuts.length - 1].pos + b.cuts[b.cuts.length - 1].length : 0
            const left = b.length - 2 * trim - end
            const offcut = t('offcut {0}', num(Math.max(0, left - (b.cuts.length ? kerf : 0))))
            return (
              <div className="box result-item" key={i}>
                <h3>
                  {t('Bar {0}', i + 1)} · {stockLabel(b.stockId)} ({num(b.length)} {unit}) · {t('waste {0}', pct(1 - b.cuts.reduce((s, c) => s + c.length, 0) / b.length))}
                </h3>
                <BarDiagram bar={b} colors={colors} kerf={kerf} trim={trim} offcut={offcut} />
                <p className="cuts">{b.cuts.map((c) => `${c.label || '?'} ${num(c.length)}`).join('  |  ')}</p>
              </div>
            )
          })
        : out.result.sheets.map((s, i) => (
            <div className="box result-item" key={i}>
              <h3>
                {t('Sheet {0}', i + 1)} · {stockLabel(s.stockId)} ({num(s.length)}×{num(s.width)} {unit}) · {t('waste {0}', pct(1 - s.used / (s.length * s.width)))}
              </h3>
              <SheetDiagram sheet={s} colors={colors} grainIds={grainIds} trim={trim} label={t('Sheet {0}', i + 1)} />
              <table className="data print-only">
                <tbody>
                  {s.placements.map((p, j) => (
                    <tr key={j}>
                      <td>{p.label || '?'}</td>
                      <td>{num(p.w)}×{num(p.h)}{p.rotated ? ' ↻' : ''}</td>
                      <td>@ {num(p.x)}, {num(p.y)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
    </>
  )
}
