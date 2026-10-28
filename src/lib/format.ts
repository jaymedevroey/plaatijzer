/** Dutch number formatting: comma decimals, no trailing ",0". */
export function kg(n: number | null | undefined, decimals = 2): string {
  if (n == null || Number.isNaN(n)) return '–'
  const r = Math.round(n * 10 ** decimals) / 10 ** decimals
  return r.toLocaleString('nl-BE', { maximumFractionDigits: decimals })
}

export function signed(n: number, decimals = 2): string {
  const s = kg(Math.abs(n), decimals)
  return `${n < 0 ? '−' : '+'}${s}`
}

export function int(n: number | null | undefined): string {
  if (n == null) return '–'
  return Math.round(n).toLocaleString('nl-BE')
}

export function duration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
