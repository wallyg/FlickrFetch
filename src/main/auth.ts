import { safeStorage, app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import * as crypto from 'crypto'
import OAuth from 'oauth-1.0a'
import axios from 'axios'
import { FLICKR_API_KEY, FLICKR_API_SECRET } from './config'
import { USER_AGENT } from './userAgent'
import type { FlickrTokenData } from '../shared/types'

const TOKEN_FILE = join(app.getPath('userData'), 'token.enc')

// A request that gets no answer for this long fails instead of hanging
const HTTP_TIMEOUT_MS = 30000

const REQUEST_TOKEN_URL = 'https://www.flickr.com/services/oauth/request_token'
const AUTHORIZE_URL = 'https://www.flickr.com/services/oauth/authorize'
const ACCESS_TOKEN_URL = 'https://www.flickr.com/services/oauth/access_token'

// oob = "out of band" — tells Flickr to show a numeric verifier code instead of redirecting
const CALLBACK_URL = 'oob'

// Identify ourselves to Flickr instead of sending the default "axios/x.x.x" user agent,
// which CloudFront WAF blocks as an automated tool.

// Holds the request token and secret in memory between startOAuthFlow and verifyOAuth
let pendingRequestToken: string | null = null
let pendingRequestTokenSecret: string | null = null

const oauth = new OAuth({
  consumer: { key: FLICKR_API_KEY, secret: FLICKR_API_SECRET },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.createHmac('sha1', key).update(base_string).digest('base64')
  }
})

// Step 1: Get a request token and return the Flickr authorization URL
export async function startOAuthFlow(): Promise<string> {
  const requestData = {
    url: REQUEST_TOKEN_URL,
    method: 'POST',
    data: { oauth_callback: CALLBACK_URL }
  }

  const headers = oauth.toHeader(oauth.authorize(requestData))

  const response = await axios.post(REQUEST_TOKEN_URL, null, {
    timeout: HTTP_TIMEOUT_MS,
    headers: {
      ...headers,
      'User-Agent': USER_AGENT,
      'Accept': 'text/plain, */*'
    }
  })

  const params = new URLSearchParams(response.data)
  const oauthToken = params.get('oauth_token')
  const oauthTokenSecret = params.get('oauth_token_secret')

  if (!oauthToken || !oauthTokenSecret) {
    throw new Error('Failed to get request token from Flickr')
  }

  // Store both in memory — needed when the user enters the verifier code
  pendingRequestToken = oauthToken
  pendingRequestTokenSecret = oauthTokenSecret

  return `${AUTHORIZE_URL}?oauth_token=${oauthToken}&perms=read`
}

// Step 2: Exchange the verifier code (typed by user) for an access token
export async function verifyOAuth(verifierCode: string): Promise<FlickrTokenData> {
  if (!pendingRequestToken || !pendingRequestTokenSecret) {
    throw new Error('No pending auth session — please click Connect to Flickr again')
  }

  const oauthToken = pendingRequestToken
  const tokenSecret = pendingRequestTokenSecret

  // Clear immediately after use
  pendingRequestToken = null
  pendingRequestTokenSecret = null

  // Put oauth_verifier in the URL so it's part of the signature base string
  // AND is physically present in the request Flickr receives — no ambiguity.
  const accessTokenUrl = `${ACCESS_TOKEN_URL}?oauth_verifier=${encodeURIComponent(verifierCode)}`

  const requestData = {
    url: accessTokenUrl,
    method: 'POST'
  }

  const token = { key: oauthToken, secret: tokenSecret }
  const headers = oauth.toHeader(oauth.authorize(requestData, token))

  let response
  try {
    response = await axios.post(accessTokenUrl, null, {
      timeout: HTTP_TIMEOUT_MS,
      headers: {
        ...headers,
        'User-Agent': USER_AGENT,
        'Accept': 'text/plain, */*'
      }
    })
  } catch (err: unknown) {
    // Only the status is logged: the response and the verifier code are secrets
    const e = err as { response?: { status?: number } }
    process.stderr.write(`[flickrfetch] sign-in failed: HTTP ${e.response?.status ?? 'no response'}\n`)
    throw err
  }

  const params = new URLSearchParams(response.data)
  const accessToken = params.get('oauth_token')
  const accessTokenSecret = params.get('oauth_token_secret')
  const nsid = params.get('user_nsid')
  const username = params.get('username')
  const fullname = params.get('fullname')

  if (!accessToken || !accessTokenSecret || !nsid || !username) {
    throw new Error('Incomplete response from Flickr — please try again')
  }

  const tokenData: FlickrTokenData = {
    accessToken,
    accessTokenSecret,
    nsid: decodeURIComponent(nsid),
    username: decodeURIComponent(username),
    realname: fullname ? decodeURIComponent(fullname) : decodeURIComponent(username)
  }

  persistToken(tokenData)
  return tokenData
}

// Kept in memory only when this computer cannot encrypt it (then it is never written to disk)
let memoryToken: FlickrTokenData | null = null

// Encrypt and save the token to disk, readable by this user only
function persistToken(tokenData: FlickrTokenData): void {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('safeStorage not available: the sign-in is kept for this session only and not saved')
    memoryToken = tokenData
    return
  }
  memoryToken = null
  const encrypted = safeStorage.encryptString(JSON.stringify(tokenData))
  writeFileSync(TOKEN_FILE, encrypted.toString('base64'), { encoding: 'utf-8', mode: 0o600 })
}

// Read and decrypt the stored token, or return null if not found
export function loadToken(): FlickrTokenData | null {
  if (memoryToken) return memoryToken
  if (!existsSync(TOKEN_FILE)) return null

  try {
    const buf = Buffer.from(readFileSync(TOKEN_FILE, 'utf-8'), 'base64')
    if (!safeStorage.isEncryptionAvailable()) return null   // an old unencrypted file is not trusted
    return JSON.parse(safeStorage.decryptString(buf)) as FlickrTokenData
  } catch (err) {
    console.error('Failed to load token:', err)
    return null
  }
}

// Delete the stored token (sign out)
export function clearToken(): void {
  memoryToken = null
  if (existsSync(TOKEN_FILE)) {
    unlinkSync(TOKEN_FILE)
  }
  pendingRequestToken = null
  pendingRequestTokenSecret = null
}

// Build an OAuth-signed header for Flickr API calls
export function getOAuthHeader(
  url: string,
  method: string,
  tokenData: FlickrTokenData
): Record<string, string> {
  const token = { key: tokenData.accessToken, secret: tokenData.accessTokenSecret }
  const requestData = { url, method }
  const header = oauth.toHeader(oauth.authorize(requestData, token))
  return { Authorization: header.Authorization }
}
