import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Design system (see DESIGN.md):
 * - Surfaces: bg → s1 (cards, no border) → s2 (controls) → s3 (pressed/selected). Borders only on floating glass and sheets.
 * - Orange only for: the one primary CTA, the active set + its check, the timer, the trend line, the active tab, focus.
 * - Buttons: Primary · Secondary · Quiet · Icon. Nothing else.
 * - Radii: 8 (chips/inputs), 14 (buttons/rows), 24 (cards/sheets/tab bar).
 */

export function Label({ children, className = '', pr = false }: { children: ReactNode; className?: string; pr?: boolean }) {
  return <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${pr ? 'text-pr' : 'text-ink-3'} ${className}`}>{children}</span>
}

export function Card({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={`rounded-3xl bg-s1 p-4 lg:p-5 ${className}`}>{children}</As>
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="pt-2 font-cond text-[32px] font-bold uppercase leading-[0.95]">{children}</h1>
}

/** Every tab uses the same container and header, so screens line up on desktop. */
export function Page({ title, sub, aside, children }: { title: ReactNode; sub?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 safe-top lg:px-10 lg:pt-10">
      <header className="flex items-end justify-between gap-3 pb-4 pt-2 lg:pb-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-cond text-[32px] font-bold uppercase leading-[0.95] lg:text-[40px]">{title}</h1>
          {sub && <p className="num text-[14px] text-ink-3">{sub}</p>}
        </div>
        {aside}
      </header>
      {children}
    </div>
  )
}

/** Card title row: a real heading (no eyebrow labels), optional quiet detail on the right. */
export function CardHead({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      {aside != null && <span className="num text-right text-[13px] text-ink-3">{aside}</span>}
    </div>
  )
}

type BtnProps = { children: ReactNode; onClick?: () => void; className?: string; disabled?: boolean; type?: 'button' | 'submit'; label?: string }

export function PrimaryButton({ children, onClick, className = '', disabled, type = 'button', label }: BtnProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={`press flex h-14 w-full items-center justify-between rounded-[14px] bg-accent px-5 font-cond text-[20px] font-bold uppercase tracking-[0.02em] text-bg hover:bg-accent-hi disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, onClick, className = '', disabled, type = 'button', label }: BtnProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={`press flex h-11 items-center justify-center gap-2 rounded-[14px] bg-s2 px-4 text-[15px] font-semibold text-ink hover:bg-s3 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

export function QuietButton({ children, onClick, className = '', disabled, type = 'button', label }: BtnProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={`press flex h-11 items-center gap-1.5 px-2 text-[15px] font-semibold text-ink-2 hover:text-ink disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

export function IconButton({ children, onClick, className = '', label }: BtnProps & { label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`press flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-s2 text-ink hover:bg-s3 ${className}`}>
      {children}
    </button>
  )
}

/** Thin progress meter: a 3px track with a data-coloured fill. */
export function Meter({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <span className="block h-[3px] w-full overflow-hidden rounded-full bg-s3" aria-hidden="true">
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 500ms var(--ease-out-strong)' }} />
    </span>
  )
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Bottom sheet: focus moves in and is trapped, returns on close; page behind doesn't scroll; closes on backdrop tap and Escape. */
export function Sheet({ open, onClose, children, label, title }: { open: boolean; onClose: () => void; children: ReactNode; label: string; title?: string }) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current()
      if (e.key !== 'Tab' || !panel.current) return
      const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!els.length) return
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      opener?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={label}>
      <button aria-label="Sluiten" tabIndex={-1} className="anim-fade absolute inset-0 cursor-default bg-bg/75" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className="anim-sheet relative mx-auto max-h-[94dvh] w-full max-w-[480px] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-line bg-s1 px-4 pt-2.5 safe-bottom focus:outline-none"
      >
        <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-line-2" aria-hidden="true" />
        {title && <h2 className="pb-3 font-cond text-[24px] font-bold uppercase leading-none">{title}</h2>}
        {children}
      </div>
    </div>
  )
}

/** Settings-style row: label left, value right, optional chevron. `to` makes it a real link. */
export function Row({ label, value, onClick, to, chevron = true }: { label: string; value?: ReactNode; onClick?: () => void; to?: string; chevron?: boolean }) {
  const cls = 'press flex min-h-14 w-full items-center justify-between gap-4 px-4 text-left hover:bg-s2/60'
  const inner = (
    <>
      <span className="text-[16px]">{label}</span>
      <span className="num flex items-center gap-2 text-right text-[16px] text-ink-2">
        {value}
        {chevron && <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-3"><path d="M6 3l5 5-5 5" /></svg>}
      </span>
    </>
  )
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[14px] text-ink-3">{children}</p>
}
