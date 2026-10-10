import type { Mode, Part, Stock } from '../lib/model'
import { newPart, newStock } from '../lib/model'
import type { T } from '../i18n'
import Num from './Num'

type Common = { mode: Mode; bad: Set<string>; unit: string; currency: string; t: T }

export function PartsEditor({ parts, onChange, mode, bad, unit, t }: Common & { parts: Part[]; onChange: (p: Part[]) => void }) {
  const set = (i: number, patch: Partial<Part>) => onChange(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const two = mode === '2d'
  return (
    <div className="section">
      <h3>{t('Parts to cut')}</h3>
      <div className="tablewrap">
        <table className="edit">
          <thead>
            <tr>
              <th>{t('Name')}</th>
              <th>{t('Length')} ({unit})</th>
              {two && <th>{t('Width')} ({unit})</th>}
              <th>{t('Qty')}</th>
              {two && <th title={t('Keep the grain: length runs along the sheet, never rotated')}>{t('Grain')}</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {parts.map((p, i) => (
              <tr key={p.id}>
                <td>
                  <input type="text" aria-label={t('Name')} placeholder={`P${i + 1}`} value={p.label} onChange={(e) => set(i, { label: e.target.value })} />
                </td>
                <td>
                  <Num label={t('Length')} value={p.length} bad={bad.has(`${p.id}.length`)} onChange={(v) => set(i, { length: v ?? NaN })} />
                </td>
                {two && (
                  <td>
                    <Num label={t('Width')} value={p.width} bad={bad.has(`${p.id}.width`)} onChange={(v) => set(i, { width: v ?? NaN })} />
                  </td>
                )}
                <td>
                  <Num label={t('Qty')} value={p.qty} min={1} bad={bad.has(`${p.id}.qty`)} onChange={(v) => set(i, { qty: v ?? NaN })} />
                </td>
                {two && (
                  <td className="center">
                    <input type="checkbox" aria-label={t('Grain')} checked={p.grain} onChange={(e) => set(i, { grain: e.target.checked })} />
                  </td>
                )}
                <td>
                  <button className="small danger" aria-label={t('Remove')} title={t('Remove')} onClick={() => onChange(parts.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {parts.length === 0 && <p className="hint">{t('Add at least one part.')}</p>}
      <div className="row">
        <button onClick={() => onChange([...parts, newPart(mode)])}>{t('+ Add part')}</button>
        {parts.length > 0 && (
          <button className="small" onClick={() => onChange([])}>
            {t('Clear')}
          </button>
        )}
      </div>
    </div>
  )
}

export function StockEditor({ stock, onChange, mode, bad, unit, currency, t }: Common & { stock: Stock[]; onChange: (s: Stock[]) => void }) {
  const set = (i: number, patch: Partial<Stock>) => onChange(stock.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const two = mode === '2d'
  return (
    <div className="section">
      <h3>{two ? t('Sheet stock') : t('Bar stock')}</h3>
      <div className="tablewrap">
        <table className="edit">
          <thead>
            <tr>
              <th>{t('Name')}</th>
              <th>{t('Length')} ({unit})</th>
              {two && <th>{t('Width')} ({unit})</th>}
              <th>{t('Cost')} ({currency})</th>
              <th title={t('Leave empty for unlimited')}>{t('Max qty')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {stock.map((s, i) => (
              <tr key={s.id}>
                <td>
                  <input type="text" aria-label={t('Name')} placeholder={`S${i + 1}`} value={s.label} onChange={(e) => set(i, { label: e.target.value })} />
                </td>
                <td>
                  <Num label={t('Length')} value={s.length} bad={bad.has(`${s.id}.length`)} onChange={(v) => set(i, { length: v ?? NaN })} />
                </td>
                {two && (
                  <td>
                    <Num label={t('Width')} value={s.width} bad={bad.has(`${s.id}.width`)} onChange={(v) => set(i, { width: v ?? NaN })} />
                  </td>
                )}
                <td>
                  <Num label={t('Cost')} value={s.cost} bad={bad.has(`${s.id}.cost`)} onChange={(v) => set(i, { cost: v ?? NaN })} />
                </td>
                <td>
                  <Num label={t('Max qty')} value={s.qty} optional min={1} placeholder="∞" bad={bad.has(`${s.id}.qty`)} onChange={(v) => set(i, { qty: v })} />
                </td>
                <td>
                  <button className="small danger" aria-label={t('Remove')} title={t('Remove')} onClick={() => onChange(stock.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {stock.length === 0 && <p className="hint">{t('Add at least one stock size.')}</p>}
      <div className="row">
        <button onClick={() => onChange([...stock, newStock(mode)])}>{t('+ Add stock')}</button>
      </div>
    </div>
  )
}
