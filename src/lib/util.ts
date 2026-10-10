export const EPS = 1e-7

/** Small deterministic PRNG, so the same input always gives the same layout. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Number of random re-orderings tried on top of the fixed ones. */
export const RANDOM_TRIES = { fast: 0, balanced: 15, thorough: 80 } as const
