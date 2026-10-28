const KEY = 'plaatijzer:lastpr'

/** Remember the PR of the set that started the current rest, so the rest screen can show it. */
export function rememberPr(setId: string, label: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ setId, label }))
  } catch {
    /* ignore */
  }
}

export function prFor(setId: string | null): string | null {
  if (!setId) return null
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { setId: string; label: string } | null
    return v?.setId === setId ? v.label : null
  } catch {
    return null
  }
}
