import React, { useState } from 'react'
import splashImg from '../assets/splash.png'
import type { FlickrUser } from '../../shared/types'

interface LoginPageProps {
  onAuthSuccess: (user: FlickrUser) => void
}

export default function LoginPage({ onAuthSuccess }: LoginPageProps): React.JSX.Element {
  // 'idle'       → showing Connect button
  // 'waiting'    → browser is open, waiting for user to paste verifier code
  // 'verifying'  → exchanging verifier code for access token
  const [step, setStep] = useState<'idle' | 'waiting' | 'verifying'>('idle')
  const [verifierCode, setVerifierCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async (): Promise<void> => {
    setError(null)
    try {
      await window.flickrAPI.startAuth()
      // Browser is now open — show the verifier code input
      setStep('waiting')
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to connect to Flickr'
      // Strip Electron's IPC error prefix if present
      const message = raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
      setError(message)
    }
  }

  const handleVerify = async (): Promise<void> => {
    const code = verifierCode.trim()
    if (!code) {
      setError('Please enter the code from Flickr.')
      return
    }
    setStep('verifying')
    setError(null)
    try {
      const { user } = await window.flickrAPI.verifyAuth(code)
      onAuthSuccess(user)
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Could not verify code.'
      const message = raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
      setError(message)
      setStep('waiting')
    }
  }

  const handleStartOver = (): void => {
    setStep('idle')
    setVerifierCode('')
    setError(null)
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <img src={splashImg} alt="FlickrFetch" style={styles.headerImg} />
        </div>
        <div style={styles.body}>
          <p style={styles.subtitle}>Sign in to download your photos &amp; videos with full metadata</p>

          {step === 'idle' && (
            <button style={styles.button} onClick={handleConnect}>
              Connect to Flickr
            </button>
          )}

          {(step === 'waiting' || step === 'verifying') && (
            <div style={styles.verifierSection}>
              <p style={styles.instructions}>
                Your browser opened Flickr's authorization page.<br />
                After you click <strong>OK, I'LL AUTHORIZE IT</strong>, Flickr will show you a 9-digit code.<br />
                Paste it below:
              </p>
              <input
                style={styles.input}
                type="text"
                placeholder="e.g. 123-456-789"
                value={verifierCode}
                onChange={(e) => setVerifierCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleVerify() }}
                disabled={step === 'verifying'}
                autoFocus
              />
              <button
                style={{
                  ...styles.button,
                  ...(step === 'verifying' ? styles.buttonDisabled : {})
                }}
                onClick={handleVerify}
                disabled={step === 'verifying'}
              >
                {step === 'verifying' ? 'Connecting…' : 'Connect'}
              </button>
              <button style={styles.startOverButton} onClick={handleStartOver}>
                Start over
              </button>
            </div>
          )}

          {error && (
            <p style={styles.errorText}>⚠️ {error}</p>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#FEF4EA',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '0 0 36px 0',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    maxWidth: '400px',
    width: '100%',
    overflow: 'hidden'
  },
  header: {
    width: '100%',
    marginBottom: '0'
  },
  headerImg: {
    width: '100%',
    height: 'auto',
    display: 'block',
    borderRadius: '16px 16px 0 0'
  },
  body: {
    padding: '0 32px 8px'
  },
  subtitle: {
    fontSize: '14px',
    color: '#888',
    margin: '20px 0 24px',
    lineHeight: '1.5'
  },
  button: {
    backgroundColor: '#FF0084',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '14px 28px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
    transition: 'opacity 0.15s'
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed'
  },
  verifierSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  instructions: {
    fontSize: '14px',
    color: '#444',
    lineHeight: '1.6',
    margin: '0',
    textAlign: 'left'
  },
  input: {
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '12px 14px',
    fontSize: '16px',
    width: '100%',
    boxSizing: 'border-box',
    letterSpacing: '0.05em',
    outline: 'none'
  },
  startOverButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '4px'
  },
  errorText: {
    marginTop: '12px',
    fontSize: '13px',
    color: '#cc0000'
  }
}
