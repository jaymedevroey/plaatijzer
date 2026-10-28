import type { Equipment, Inventory } from '../lib/types'

const EPS = 1e-6

/** Plates per side (largest first) to load `total` on the bar; null if not exactly loadable. */
export function platesPerSide(total: number, inv: Inventory): number[] | null {
  let side = (total - inv.barKg) / 2
  if (side < -EPS) return null
  const plates = [...inv.plates].sort((a, b) => b - a)
  const out: number[] = []
  for (const p of plates) {
    // We assume enough pairs of each plate size for a home gym (up to 4 pairs each).
    let count = 0
    while (side + EPS >= p && count < 4) {
      side -= p
      out.push(p)
      count++
    }
  }
  return Math.abs(side) < EPS ? out : null
}

/** All loadable weights for an equipment type, ascending. */
export function loadableWeights(equipment: Equipment, inv: Inventory): number[] {
  if (equipment === 'dumbbell') return [...inv.dumbbells].sort((a, b) => a - b)
  if (equipment === 'cable') {
    const out: number[] = []
    for (let w = inv.cableStep; w <= inv.cableMax + EPS; w += inv.cableStep) out.push(round(w))
    return out
  }
  if (equipment === 'barbell') {
    const step = 2 * Math.min(...inv.plates)
    const out: number[] = []
    for (let w = inv.barKg; w <= inv.barKg + 200; w += step) {
      const r = round(w)
      if (platesPerSide(r, inv)) out.push(r)
    }
    return out
  }
  // Bodyweight: added load in 2.5 kg steps (belt / dumbbell between feet).
  const out: number[] = []
  for (let w = 0; w <= 40; w += 2.5) out.push(w)
  return out
}

/** The next heavier loadable weight, or the same weight if you are at the top. */
export function nextWeight(current: number, equipment: Equipment, inv: Inventory): number {
  const list = loadableWeights(equipment, inv)
  return list.find((w) => w > current + EPS) ?? current
}

export function prevWeight(current: number, equipment: Equipment, inv: Inventory): number {
  const list = loadableWeights(equipment, inv)
  return [...list].reverse().find((w) => w < current - EPS) ?? current
}

/** Closest loadable weight to `w`. */
export function snap(w: number, equipment: Equipment, inv: Inventory): number {
  const list = loadableWeights(equipment, inv)
  if (!list.length) return w
  return list.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best), list[0])
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
