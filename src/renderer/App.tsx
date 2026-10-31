import React, { useEffect, useState } from 'react'
import type { AuthState, FlickrUser } from '../shared/types'
import LoginPage from './pages/LoginPage'
import MainPage from './pages/MainPage'

export default function App(): React.JSX.Element {
  const [authState, setAuthState] = useState<AuthState>({
    status: 'loading',
    user: null,
    error: null
  })

  // On mount: check if already authenticated (token on disk from a previous session)
  useEffect(() => {
    window.flickrAPI.getAuthState().then(({ user }) => {
      setAuthState({
        status: user ? 'authenticated' : 'unauthenticated',
        user,
        error: null
      })
    })
  }, [])

  const handleAuthSuccess = (user: FlickrUser): void => {
    setAuthState({ status: 'authenticated', user, error: null })
  }

  const handleSignOut = (): void => {
    window.flickrAPI.signOut().then(() => {
      setAuthState({ status: 'unauthenticated', user: null, error: null })
    })
  }

  if (authState.status === 'loading') {
    return (
      <div style={styles.centered}>
        <p style={styles.loadingText}>Loading…</p>
      </div>
    )
  }

  if (authState.status === 'authenticated' && authState.user) {
    return <MainPage user={authState.user} onSignOut={handleSignOut} />
  }

  return (
    <LoginPage onAuthSuccess={handleAuthSuccess} />
  )
}

const styles: Record<string, React.CSSProperties> = {
  centered: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
  },
  loadingText: {
    color: '#999',
    fontSize: '16px'
  }
}
