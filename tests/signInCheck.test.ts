import test from 'node:test'
import assert from 'node:assert/strict'
import { isSignInRevoked } from '../src/main/signInCheck'

// Only a sign-in Flickr has taken back signs the user out; a network problem or a busy Flickr never does.
test('Flickr saying the sign-in token is no good counts as taken back', () => {
  assert.equal(isSignInRevoked(200, { stat: 'fail', code: 98, message: 'Invalid auth token' }), true)
  assert.equal(isSignInRevoked(200, { stat: 'fail', code: '98' }), true)
  assert.equal(isSignInRevoked(401, 'oauth_problem=token_revoked'), true)
  assert.equal(isSignInRevoked(401, 'oauth_problem=token_rejected&x=1'), true)
})
test('other problems do not', () => {
  assert.equal(isSignInRevoked(200, { stat: 'ok' }), false)
  assert.equal(isSignInRevoked(200, { stat: 'fail', code: 100, message: 'Invalid API key' }), false)   // the app's key, not the user's sign-in
  assert.equal(isSignInRevoked(200, { stat: 'fail', code: 105 }), false)                              // service unavailable
  assert.equal(isSignInRevoked(401, 'oauth_problem=timestamp_refused'), false)                         // the computer's clock
  assert.equal(isSignInRevoked(503, 'busy'), false)
  assert.equal(isSignInRevoked(undefined, undefined), false)
  assert.equal(isSignInRevoked(undefined, null), false)
})
