import { describe, expect, it } from 'vitest'
import { dateTicks, nearestIndex, niceTicks } from './chartScale'

describe('chart scales', () => {
  it('weight ticks in half kilos with one decimal', () => {
    expect(niceTicks(69.9, 71.6, 4)).toEqual({ ticks: [70, 70.5, 71, 71.5], decimals: 1 })
  })
  it('a range just over 2 kg still gets half kilos instead of two lonely lines', () => {
    expect(niceTicks(70.4, 72.5, 4).ticks).toEqual([70.5, 71, 71.5, 72, 72.5])
  })
  it('strength ticks in whole kilos', () => {
    expect(niceTicks(65.5, 72.4, 4)).toEqual({ ticks: [66, 68, 70, 72], decimals: 0 })
  })
  it('a month on a phone gets the Mondays', () => {
    expect(dateTicks('2026-09-28', '2026-10-28', 300).map((t) => t.label)).toEqual(['28 sep', '5 okt', '12 okt', '19 okt', '26 okt'])
  })
  it('a narrow month falls back to every other Monday', () => {
    expect(dateTicks('2026-09-29', '2026-10-28', 200).map((t) => t.label)).toEqual(['5 okt', '19 okt'])
  })
  it('a year gets month names, January with its year', () => {
    const t = dateTicks('2026-10-29', '2027-10-28', 700).map((x) => x.label)
    expect(t[0]).toBe('nov')
    expect(t).toContain("jan '27")
    expect(t.length).toBeLessThanOrEqual(12)
  })
  it('finds the closest point', () => {
    expect(nearestIndex([0, 10, 20, 30], 14)).toBe(1)
    expect(nearestIndex([0, 10, 20, 30], 16)).toBe(2)
    expect(nearestIndex([0, 10, 20, 30], -5)).toBe(0)
    expect(nearestIndex([0, 10, 20, 30], 99)).toBe(3)
    expect(nearestIndex([5], 0)).toBe(0)
  })
})
