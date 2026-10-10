import { useEffect, useState } from 'react'
import type { Algo, Effort, Mode, Part, Stock } from './lib/model'
import type { Result1D } from './lib/pack1d'
import type { Result2D } from './lib/pack2d'

export type Output = { mode: '1d'; result: Result1D } | { mode: '2d'; result: Result2D }
export type Status = { state: 'idle' } | { state: 'pending' } | { state: 'done'; out: Output } | { state: 'error'; message: string }
export type WorkerRequest = { mode: Mode; parts: Part[]; stock: Stock[]; kerf: number; trim: number; algo: Algo; effort: Effort }
export type WorkerResponse = { out: Output } | { error: string }

const DEBOUNCE_MS = 250
const TIMEOUT_MS = 120_000

/**
 * Runs the optimiser in a worker. Any input change terminates the running worker and starts over;
 * results are tagged with the inputs they were computed for, so a stale result is never shown.
 */
export function useOptimizer(req: WorkerRequest | null): Status {
  const [done, setDone] = useState<{ key: string; status: Status }>({ key: '', status: { state: 'idle' } })
  const key = req ? JSON.stringify(req) : ''
  useEffect(() => {
    if (!key) return
    const r = JSON.parse(key) as WorkerRequest
    let w: Worker | undefined
    let timer = 0
    const debounce = window.setTimeout(() => {
      w = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })
      const finish = (status: Status) => {
        window.clearTimeout(timer)
        w?.terminate()
        setDone({ key, status })
      }
      timer = window.setTimeout(() => finish({ state: 'error', message: 'timed out' }), TIMEOUT_MS)
      w.onmessage = (e: MessageEvent<WorkerResponse>) => finish('out' in e.data ? { state: 'done', out: e.data.out } : { state: 'error', message: e.data.error })
      w.onerror = (e) => finish({ state: 'error', message: e.message || 'worker failed' })
      w.postMessage(r)
    }, DEBOUNCE_MS)
    return () => {
      window.clearTimeout(debounce)
      window.clearTimeout(timer)
      w?.terminate()
    }
  }, [key])
  if (!key) return { state: 'idle' }
  return done.key === key ? done.status : { state: 'pending' }
}
