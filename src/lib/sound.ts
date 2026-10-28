/**
 * iOS only plays Web Audio after a user gesture, so the context is created on the first tap
 * (`unlockAudio`) and reused for the end-of-rest beep.
 */
let ctx: AudioContext | null = null

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new C()
    // A silent tick primes the iOS audio session.
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    g.gain.value = 0
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.01)
  } catch {
    ctx = null
  }
}

export function beep() {
  if (!ctx) return
  const t = ctx.currentTime
  for (const [i, f] of [880, 880, 1320].entries()) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = f
    const start = t + i * 0.22
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(0.4, start + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
    o.connect(g).connect(ctx.destination)
    o.start(start)
    o.stop(start + 0.2)
  }
}

export function tap() {
  // Android only; iOS web apps cannot vibrate.
  if ('vibrate' in navigator) navigator.vibrate?.(10)
}
