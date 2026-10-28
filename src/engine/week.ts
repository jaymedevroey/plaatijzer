import type { ProgramDay, Schedule, Workout } from '../lib/types'
import { addDays, isoDate, parseDate, weekStart } from '../lib/dates'

/** Next day in the rotation: the one after the last finished workout's day. */
export function nextDay(days: ProgramDay[], finished: Workout[]): ProgramDay | undefined {
  if (!days.length) return undefined
  const last = [...finished].reverse().find((w) => w.day_id)
  const idx = last ? days.findIndex((d) => d.id === last.day_id) : -1
  return days[(idx + 1) % days.length]
}

export interface PlanDay {
  date: string
  isToday: boolean
  past: boolean
  done: { id: string; name: string; minutes: number }[]
  /** Program day expected on this gym day (today or later), following the rotation. */
  planned: string | null
  /** A gym day that passed without a workout. */
  skipped: boolean
  volley: 'training' | 'match' | null
}

/** Monday to Sunday of the current week: what happened, and what the rotation puts on the coming gym days. */
export function weekPlan(today: string, days: ProgramDay[], finished: Workout[], schedule: Schedule): PlanDay[] {
  const names = new Map(days.map((d) => [d.id, d.name]))
  const first = nextDay(days, finished)
  let idx = first ? days.indexOf(first) : 0
  const ws = weekStart(today)
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(ws, i)
    const dow = parseDate(date).getDay()
    const done = finished
      .filter((w) => isoDate(new Date(w.started_at)) === date)
      .map((w) => ({
        id: w.id,
        name: (w.day_id && names.get(w.day_id)) || 'Training',
        minutes: w.finished_at ? Math.round((Date.parse(w.finished_at) - Date.parse(w.started_at)) / 60000) : 0,
      }))
    const gym = schedule.gymDays.includes(dow)
    let planned: string | null = null
    if (gym && date >= today && done.length === 0 && days.length) {
      planned = days[idx % days.length].name
      idx++
    }
    return { date, isToday: date === today, past: date < today, done, planned, skipped: gym && date < today && done.length === 0, volley: schedule.volley[dow] ?? null }
  })
}
