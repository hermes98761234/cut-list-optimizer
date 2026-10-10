import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_STATE, invalidFields, loadState, saveState, type AppState, type Settings } from './lib/model'
import { tr, type T } from './i18n'
import { useOptimizer, type WorkerRequest } from './useOptimizer'
import { PartsEditor, StockEditor } from './components/ListEditor'
import Num from './components/Num'
import Results from './components/Results'

export default function App() {
  const [state, setState] = useState<AppState>(loadState)
  const { mode, settings } = state
  const t: T = (s, ...a) => tr(settings.lang, s, ...a)
  const bad = useMemo(() => invalidFields(state), [state])
  const one = mode === '1d'
  const parts = one ? state.parts1 : state.parts2
  const stock = one ? state.stock1 : state.stock2
  const setSettings = (patch: Partial<Settings>) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  const setParts = (p: typeof parts) => setState((s) => (one ? { ...s, parts1: p } : { ...s, parts2: p }))
  const setStock = (p: typeof stock) => setState((s) => (one ? { ...s, stock1: p } : { ...s, stock2: p }))

  // Blank names get P1, P2… so every cut is labelled in the diagrams and exports.
  const namedParts = useMemo(() => parts.map((p, i) => ({ ...p, label: p.label.trim() || `P${i + 1}` })), [parts])
  const namedStock = useMemo(() => stock.map((s, i) => ({ ...s, label: s.label.trim() || `S${i + 1}` })), [stock])
  const empty = parts.length === 0 || stock.length === 0
  const req: WorkerRequest | null =
    bad.size > 0 || empty
      ? null
      : { mode, parts: namedParts, stock: namedStock, kerf: settings.kerf, trim: settings.trim, algo: settings.algo, effort: settings.effort }
  const status = useOptimizer(req)

  useEffect(() => saveState(state), [state])
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = settings.theme
    root.lang = settings.lang
  }, [settings.theme, settings.lang])

  const example = () =>
    setState((s) => (one ? { ...s, parts1: DEFAULT_STATE.parts1, stock1: DEFAULT_STATE.stock1 } : { ...s, parts2: DEFAULT_STATE.parts2, stock2: DEFAULT_STATE.stock2 }))

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('Cut-list optimizer')}</span>
        <span className="hint">{t('Plan cuts from bars, lumber and sheets with the least waste.')}</span>
      </header>
      <div className="body">
        <aside className="side">
          <div className="panel">
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={one} className={one ? 'on' : ''} onClick={() => setState((s) => ({ ...s, mode: '1d' }))}>
                {t('Bars (1D)')}
              </button>
              <button role="tab" aria-selected={!one} className={!one ? 'on' : ''} onClick={() => setState((s) => ({ ...s, mode: '2d' }))}>
                {t('Sheets (2D)')}
              </button>
            </div>
            <StockEditor stock={stock} onChange={setStock} mode={mode} bad={bad} unit={settings.unit} currency={settings.currency} t={t} />
            <PartsEditor parts={parts} onChange={setParts} mode={mode} bad={bad} unit={settings.unit} currency={settings.currency} t={t} />
            <div className="row">
              <button onClick={example}>{t('Load example')}</button>
            </div>
            <div className="section">
              <h3>{t('Settings')}</h3>
              <div className="grid2">
                <label className="field">
                  <span>{t('Saw kerf')}</span>
                  <Num label={t('Saw kerf')} value={settings.kerf} bad={bad.has('settings.kerf')} onChange={(v) => setSettings({ kerf: v ?? NaN })} />
                </label>
                <label className="field">
                  <span>{t('Edge trim')}</span>
                  <Num label={t('Edge trim')} value={settings.trim} bad={bad.has('settings.trim')} onChange={(v) => setSettings({ trim: v ?? NaN })} />
                </label>
                <label className="field">
                  <span>{t('Units')}</span>
                  <select value={settings.unit} onChange={(e) => setSettings({ unit: e.target.value as Settings['unit'] })}>
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="in">in</option>
                  </select>
                </label>
                <label className="field">
                  <span>{t('Currency')}</span>
                  <input type="text" maxLength={4} value={settings.currency} onChange={(e) => setSettings({ currency: e.target.value })} />
                </label>
                {!one && (
                  <label className="field">
                    <span>{t('Algorithm')}</span>
                    <select value={settings.algo} onChange={(e) => setSettings({ algo: e.target.value as Settings['algo'] })}>
                      <option value="guillotine">{t('Guillotine (edge-to-edge cuts)')}</option>
                      <option value="maxrects">{t('MaxRects (tighter)')}</option>
                    </select>
                  </label>
                )}
                <label className="field">
                  <span>{t('Effort')}</span>
                  <select value={settings.effort} onChange={(e) => setSettings({ effort: e.target.value as Settings['effort'] })}>
                    <option value="fast">{t('Fast')}</option>
                    <option value="balanced">{t('Balanced')}</option>
                    <option value="thorough">{t('Thorough')}</option>
                  </select>
                </label>
                <label className="field">
                  <span>{t('Language')}</span>
                  <select value={settings.lang} onChange={(e) => setSettings({ lang: e.target.value as Settings['lang'] })}>
                    <option value="en">English</option>
                    <option value="uk">Українська</option>
                  </select>
                </label>
                <label className="field">
                  <span>{t('Theme')}</span>
                  <select value={settings.theme} onChange={(e) => setSettings({ theme: e.target.value as Settings['theme'] })}>
                    <option value="auto">{t('System')}</option>
                    <option value="light">{t('Light')}</option>
                    <option value="dark">{t('Dark')}</option>
                  </select>
                </label>
              </div>
              <p className="hint">{t('Sizes are unitless numbers: use the same unit everywhere. The unit only labels the results.')}</p>
            </div>
          </div>
        </aside>
        <main className="main">
          <Results
            status={status}
            invalid={bad.size > 0}
            empty={empty}
            parts={namedParts}
            stock={namedStock}
            kerf={settings.kerf}
            trim={settings.trim}
            unit={settings.unit}
            currency={settings.currency}
            t={t}
          />
        </main>
      </div>
      <p className="hint foot">
        {t('Heuristic packing: results are good, not guaranteed optimal. Everything runs in your browser.')}{' '}
        <a href="https://github.com/hermes98761234/cut-list-optimizer">{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}
