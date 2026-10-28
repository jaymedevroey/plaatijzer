import { useState } from 'react'
import { supabase } from '../data/supabase'
import { PrimaryButton } from '../ui/kit'
import { IconRight } from '../ui/icons'

/** Single-user app: login only. Accounts are not created from the app. */
export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      setMsg(
        !navigator.onLine
          ? 'Geen internet. Inloggen kan alleen online; daarna werkt de app ook offline.'
          : error.message === 'Invalid login credentials'
            ? 'E-mail of wachtwoord klopt niet.'
            : error.message.includes('not confirmed')
              ? 'Bevestig eerst je account via de mail.'
              : 'Inloggen lukte niet. Probeer het opnieuw.',
      )
    }
  }

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div aria-hidden="true" className="hidden flex-col justify-between bg-s1 p-12 lg:flex">
        <span className="text-[14px] text-ink-3">Workout- en daglog voor de homegym</span>
        <span translate="no" className="font-cond text-[clamp(96px,11vw,176px)] font-bold uppercase leading-[0.8]">
          Plaat<br />ijzer<span className="text-accent">.</span>
        </span>
      </div>

      <div className="mx-auto flex min-h-[100dvh] max-w-[420px] flex-col justify-center gap-10 px-5 pb-32 pt-10 lg:pb-10">
        <h1 translate="no" className="font-cond text-[64px] font-bold uppercase leading-[0.82] lg:sr-only">
          Plaat&shy;ijzer<span className="text-accent">.</span>
        </h1>
        <p aria-hidden="true" className="hidden font-cond text-[32px] font-bold uppercase leading-none lg:block">Inloggen</p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label>
            <span className="sr-only">E-mail</span>
            <input type="email" name="email" autoComplete="email" spellCheck={false} required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)}
              className="h-14 w-full rounded-[14px] bg-s1 px-4 text-[16px] outline-none placeholder:text-ink-3 focus:bg-s2" />
          </label>
          <label>
            <span className="sr-only">Wachtwoord</span>
            <input type="password" name="password" autoComplete="current-password" required placeholder="Wachtwoord" value={password} onChange={(e) => setPassword(e.target.value)}
              className="h-14 w-full rounded-[14px] bg-s1 px-4 text-[16px] outline-none placeholder:text-ink-3 focus:bg-s2" />
          </label>
          {msg && <p role="alert" className="px-1 text-[14px] text-protein">{msg}</p>}
          <PrimaryButton type="submit" disabled={busy} className="mt-2">
            <span>{busy ? 'Even geduld…' : 'Inloggen'}</span>
            <IconRight />
          </PrimaryButton>
        </form>
      </div>
    </div>
  )
}
