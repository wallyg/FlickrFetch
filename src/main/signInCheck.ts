// Whether Flickr's answer to a request means the sign-in itself has been taken back (the app's access was removed on Flickr's website), as
// opposed to a network problem or a busy Flickr, which must never sign anyone out.

export class SignInRevokedError extends Error {
  constructor() { super('The sign-in was taken back on Flickr.'); this.name = 'SignInRevokedError' }
}

export function isSignInRevoked(status: number | undefined, data: unknown): boolean {
  // Flickr's own answer: 98 = login failed / invalid sign-in token
  if (data && typeof data === 'object' && (data as { stat?: unknown }).stat === 'fail' && Number((data as { code?: unknown }).code) === 98) return true
  // The OAuth layer's answer, as text like "oauth_problem=token_revoked"
  if (status === 401 && typeof data === 'string' && /oauth_problem=(token_rejected|token_revoked|token_expired)/.test(data)) return true
  return false
}
