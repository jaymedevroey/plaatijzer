import { useSyncExternalStore } from 'react'
import { beep } from '../lib/sound'

/**
 * Rest timer based on timestamps: it survives the app going to the background,
 * a reload or the screen locking, because remaining time is always computed from `endAt`.
 */
export interface TimerState {
  endAt: number
  durationSec: number
  label: string
  /** Set that started the rest, to show the PR chip / next set. */
  setId: string | null
  alerted: boolean
}

const KEY = 'plaatijzer:timer'
let state: TimerState | null = load()
const subs = new Set<() => void>()

function load(): TimerState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TimerState) : null
  } catch {
    return null
  }
}

function persist() {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode: timer still works in memory */
  }
  subs.forEach((f) => f())
}

export const timer = {
  start(durationSec: number, label: string, setId: string | null) {
    state = { endAt: Date.now() + durationSec * 1000, durationSec, label, setId, alerted: false }
    persist()
  },
  adjust(deltaSec: number) {
    if (!state) return
    state = { ...state, endAt: state.endAt + deltaSec * 1000, durationSec: Math.max(5, state.durationSec + deltaSec), alerted: false }
    persist()
  },
  stop() {
    state = null
    persist()
  },
  get(): TimerState | null {
    return state
  },
}

// One ticker for the whole app: re-render subscribers 4×/s and fire the alarm once at zero.
let tick = 0
setInterval(() => {
  if (!state) return
  tick++
  if (!state.alerted && Date.now() >= state.endAt) {
    state = { ...state, alerted: true }
    persist()
    beep()
    if ('vibrate' in navigator) navigator.vibrate?.([120, 80, 120])
  }
  subs.forEach((f) => f())
}, 250)

function subscribe(f: () => void) {
  subs.add(f)
  return () => subs.delete(f)
}

export function useTimer(): { state: TimerState | null; remaining: number; tick: number } {
  const s = useSyncExternalStore(subscribe, () => state)
  useSyncExternalStore(subscribe, () => tick)
  const remaining = s ? (s.endAt - Date.now()) / 1000 : 0
  return { state: s, remaining, tick }
}
