import { pack1d } from './lib/pack1d'
import { pack2d } from './lib/pack2d'
import type { WorkerRequest, WorkerResponse } from './useOptimizer'

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const r = e.data
  let msg: WorkerResponse
  try {
    msg =
      r.mode === '1d'
        ? { out: { mode: '1d', result: pack1d({ parts: r.parts, stock: r.stock, kerf: r.kerf, trim: r.trim, effort: r.effort }) } }
        : { out: { mode: '2d', result: pack2d({ parts: r.parts, stock: r.stock, kerf: r.kerf, trim: r.trim, effort: r.effort, algo: r.algo }) } }
  } catch (err) {
    msg = { error: err instanceof Error ? err.message : String(err) }
  }
  self.postMessage(msg)
}
