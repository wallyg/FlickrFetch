import React, { useState } from 'react'
import logoTrayImg from '../assets/logo-tray.png'
import '@fontsource/lato/400.css'
import '@fontsource/lato/700.css'
import '@fontsource/lato/400-italic.css'
import type { FlickrUser } from '../../shared/types'
import ProblemModal from '../components/ProblemModal'

interface LoginPageProps {
  onAuthSuccess: (user: FlickrUser) => void
}

export default function LoginPage({ onAuthSuccess }: LoginPageProps): React.JSX.Element {
  const [step, setStep] = useState<'idle' | 'waiting' | 'verifying'>('idle')
  const [showProblem, setShowProblem] = useState(false)
  const [verifierCode, setVerifierCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [codeValid, setCodeValid] = useState(false)

  const normalizeCode = (raw: string): string => raw.replace(/[\s-]/g, '')

  const handleCodeChange = (val: string): void => {
    setVerifierCode(val)
    setError(null)
    setCodeValid(normalizeCode(val).length >= 6)
  }

  const handleConnect = async (): Promise<void> => {
    setError(null)
    try {
      await window.flickrAPI.startAuth()
      setStep('waiting')
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to open Flickr.'
      setError(raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    }
  }

  const handleReopenFlickr = async (): Promise<void> => {
    setError(null)
    try {
      await window.flickrAPI.startAuth()
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to open Flickr.'
      setError(raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    }
  }

  const handleVerify = async (): Promise<void> => {
    const code = normalizeCode(verifierCode).trim()
    if (!code) { setError('Please enter the authorization code from Flickr.'); return }
    setStep('verifying')
    setError(null)
    try {
      const { user } = await window.flickrAPI.verifyAuth(code)
      onAuthSuccess(user)
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Could not verify code.'
      setError(raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
      setStep('waiting')
    }
  }

  const isConnecting = step === 'verifying'
  const connectDisabled = !codeValid || isConnecting

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        {/* ── Left column: brand image ── */}
        <div style={styles.leftCol}>
          <img
            src={logoTrayImg}
            alt="FlickrFetch"
            style={styles.brandImage}
            draggable={false}
          />
          <button style={styles.problemLink} onClick={() => setShowProblem(true)}>
            The Problem FlickrFetch Solves
          </button>
          {/* Subtle wave at the bottom */}
          <div style={styles.waveContainer} aria-hidden="true">
            <svg viewBox="0 0 320 52" preserveAspectRatio="none" style={{ width: '100%', height: '52px', display: 'block' }}>
              <path d="M0,36 Q80,8 160,28 Q240,48 320,18 L320,52 L0,52 Z" fill="rgba(0,99,220,0.07)" />
              <path d="M0,46 Q80,28 160,42 Q240,56 320,32 L320,52 L0,52 Z" fill="rgba(255,0,132,0.05)" />
            </svg>
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={styles.columnDivider} />

        {/* ── Right column ── */}
        <div style={styles.rightCol}>
          <div style={styles.formGroup}>

            {step === 'idle' ? (
              /* ── Intro / marketing view ── */
              <>
                <h1 style={styles.tagline}>
                  <span style={styles.taglineNav}>Your photos.</span><br />
                  <span style={styles.taglineBlue}>All of them.</span><br />
                  <span style={styles.taglineNav}>Everything about them.</span>
                </h1>

                <p style={styles.taglineBody}>
                  Flickr stores your photos — but not inside them. Titles, tags, descriptions,
                  and licenses live on Flickr's servers, not in your files. FlickrFetch downloads
                  your library and embeds that metadata directly into each photo and video, so
                  your archive travels with you — independent of Flickr, forever.
                </p>

                <div style={styles.introCta}>
                  <button
                    style={{ ...styles.primaryBtn, ...styles.connectBtn }}
                    onClick={handleConnect}
                    disabled={isConnecting}
                  >
                    <span style={styles.flickrDots} aria-hidden="true">
                      <span style={styles.dotBlue} />
                      <span style={styles.dotPink} />
                    </span>
                    {isConnecting ? 'Opening Flickr…' : 'Connect Flickr Account'}
                  </button>
                </div>

                {error && <p style={styles.errorText} role="alert">⚠️ {error}</p>}

                <p style={styles.trustText}>
                  Authorization takes place on Flickr in your browser. We never see your password.
                </p>
              </>
            ) : (
              /* ── Authorization flow ── */
              <>
                <h1 style={styles.heading}>Almost there</h1>
                <p style={styles.intro}>
                  Flickr is open in your browser. Approve access and copy the code it gives you.
                </p>

                <div style={styles.stepsArea}>
                  <p style={styles.stepLabel}>1. Authorize in your browser</p>
                  <p style={styles.stepBody}>
                    Approve FlickrFetch's access on Flickr. You'll receive an authorization code.
                  </p>
                  {step === 'waiting' && (
                    <p style={styles.statusText}>
                      Continue in your browser, then paste your code below.
                    </p>
                  )}
                  <button
                    style={styles.outlinedBtn}
                    onClick={handleReopenFlickr}
                    disabled={isConnecting}
                  >
                    Reopen Flickr
                  </button>

                  <p style={{ ...styles.stepLabel, marginTop: '20px' }}>2. Enter your authorization code</p>
                  <input
                    id="verifier-input"
                    style={styles.input}
                    type="text"
                    placeholder="Paste the code from Flickr"
                    value={verifierCode}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !connectDisabled) handleVerify() }}
                    disabled={isConnecting}
                    autoComplete="off"
                    aria-label="Authorization code"
                  />
                  {error && (
                    <p style={styles.errorText} role="alert">⚠️ {error}</p>
                  )}
                  <button
                    style={{
                      ...styles.primaryBtn,
                      ...(connectDisabled ? styles.primaryBtnDisabled : {})
                    }}
                    onClick={handleVerify}
                    disabled={connectDisabled}
                    aria-busy={isConnecting}
                  >
                    {isConnecting ? 'Connecting…' : 'Connect account'}
                  </button>
                </div>

                <p style={styles.trustText}>
                  Authorization takes place on Flickr in your browser.
                </p>
              </>
            )}

          </div>
        </div>

      </div>
      {showProblem && <ProblemModal onClose={() => setShowProblem(false)} />}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: 'var(--ff-cream)',
    fontFamily: "'Lato', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  card: {
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
    width: '880px',
    maxWidth: 'calc(100vw - 48px)',
    minHeight: '520px',
    overflow: 'hidden'
  },

  // ── Left column ──
  leftCol: {
    width: '320px',
    flexShrink: 0,
    backgroundColor: 'var(--ff-cream)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    padding: '32px'
  },
  brandImage: {
    width: '240px',
    objectFit: 'contain',
    position: 'relative',
    zIndex: 1,
    userSelect: 'none'
  } as React.CSSProperties,
  waveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 0
  },
  problemLink: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--ff-blue)',
    opacity: 0.8,
    textDecoration: 'underline',
    textDecorationStyle: 'dotted' as const,
    textUnderlineOffset: '3px',
    padding: '0',
    fontFamily: "'Lato', -apple-system, sans-serif",
    textAlign: 'center' as const,
    lineHeight: 1.4,
    position: 'relative' as const,
    zIndex: 1,
  },

  // ── Divider ──
  columnDivider: {
    width: '1px',
    backgroundColor: 'rgba(0,0,0,0.07)',
    flexShrink: 0,
    alignSelf: 'stretch'
  },

  // ── Right column ──
  rightCol: {
    flex: 1,
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    padding: '36px 36px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%'
  },
  heading: {
    fontSize: '24px',
    fontWeight: '700',
    lineHeight: '30px',
    color: 'var(--ff-navy)',
    margin: '0 0 10px',
    fontFamily: "'Lato', -apple-system, sans-serif"
  },
  intro: {
    fontSize: '14px',
    lineHeight: '21px',
    color: '#555',
    margin: '0'
  },
  stepsArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '24px'
  },
  stepLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--ff-navy)',
    margin: '0',
    fontFamily: "'Lato', -apple-system, sans-serif"
  },
  stepBody: {
    fontSize: '13px',
    lineHeight: '19px',
    color: '#666',
    margin: '6px 0 0'
  },
  statusText: {
    fontSize: '13px',
    color: 'var(--ff-blue)',
    margin: '0',
    fontStyle: 'italic'
  },
  outlinedBtn: {
    alignSelf: 'flex-start' as const,
    height: '38px',
    backgroundColor: 'transparent',
    color: 'var(--ff-navy)',
    border: '1.5px solid rgba(0,0,0,0.18)',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'Lato', -apple-system, sans-serif",
    padding: '0 16px',
    marginTop: '12px'
  },
  input: {
    height: '38px',
    border: '1.5px solid #ddd',
    borderRadius: '8px',
    padding: '0 12px',
    fontSize: '15px',
    letterSpacing: '0.04em',
    color: 'var(--ff-navy)',
    outline: 'none',
    fontFamily: "'Lato', -apple-system, sans-serif",
    boxSizing: 'border-box' as const,
    width: '100%',
    marginTop: '8px',
    backgroundColor: '#fff'
  },
  primaryBtn: {
    height: '40px',
    backgroundColor: 'var(--ff-pink-action)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Lato', -apple-system, sans-serif",
    width: '100%',
    transition: 'opacity 0.15s'
  },
  primaryBtnDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed' as const
  },
  errorText: {
    fontSize: '13px',
    color: '#c0000a',
    margin: '0',
    lineHeight: 1.5
  },
  trustText: {
    fontSize: '12px',
    color: '#aaa',
    margin: '16px 0 0',
    lineHeight: 1.5
  },

  // ── Intro / marketing view ──
  tagline: {
    margin: '0 0 20px',
    fontSize: '34px',
    fontWeight: '700',
    lineHeight: 1.18,
    fontFamily: "'Lato', -apple-system, sans-serif",
    letterSpacing: '-0.01em',
  },
  taglineNav: {
    color: 'var(--ff-navy)',
  },
  taglineBlue: {
    color: 'var(--ff-blue)',
  },
  taglineBody: {
    fontSize: '14px',
    lineHeight: '1.65',
    color: '#5a5a6a',
    margin: '0 0 28px',
    maxWidth: '420px',
  },
  introCta: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  connectBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    height: '48px',
    fontSize: '15px',
    letterSpacing: '0.01em',
  },
  flickrDots: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  } as React.CSSProperties,
  dotBlue: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    opacity: 0.9,
  } as React.CSSProperties,
  dotPink: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.65)',
  } as React.CSSProperties,
}
