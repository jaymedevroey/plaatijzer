/**
 * Pull rule: the server row replaces the local one unless the local row has unpushed changes that are newer.
 * Compares instants, not strings: the server sends "2026-01-01T00:00:00+00:00", the client writes "2026-01-01T00:00:00.000Z".
 */
export function remoteWins(remoteUpdatedAt: string, local?: { dirty?: 0 | 1; updated_at: string }): boolean {
  if (!local || !local.dirty) return true
  return Date.parse(remoteUpdatedAt) >= Date.parse(local.updated_at)
}
