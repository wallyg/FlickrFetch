// The text a person can copy from the error screen to report what happened: plain, short, and safe to paste (no photo titles, no tokens).
const MAX_STACK_LINES = 12

export function describeError(error: unknown, componentStack: string, screen: string): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error'
  const where = (error instanceof Error && error.stack ? error.stack : '').split('\n').slice(0, MAX_STACK_LINES).join('\n')
  const parts = componentStack.split('\n').map(l => l.trim()).filter(Boolean).slice(0, MAX_STACK_LINES).join('\n')
  const lines = [`FlickrFetch error on ${screen}`, '', message]
  if (where) lines.push('', where)
  if (parts) lines.push('', 'Screens involved:', parts)
  return lines.join('\n')
}
