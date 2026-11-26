import React from 'react'
import { primaryBtn, quietBtn } from './kit'
import { describeError } from './errorDetails'

// What a person sees when a screen hits an error, instead of a blank white window (#254): a short plain message, a Reload button, and the details
// folded away so they can be copied and reported. Around the whole app (scope "app") and around the tab content (scope "tab", which clears when you
// switch tab, so one broken tab does not stop you using the rest).

interface Props { scope: 'app' | 'tab'; resetKey?: string; children: React.ReactNode }
interface State { error: unknown; stack: string; copied: boolean }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, stack: '', copied: false }

  static getDerivedStateFromError(error: unknown): Partial<State> { return { error: error ?? new Error('Unknown error') } }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('[flickrfetch] a screen crashed:', error, info.componentStack)
    this.setState({ stack: info.componentStack ?? '' })
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null, stack: '', copied: false })
  }

  private copy = (): void => {
    const text = describeError(this.state.error, this.state.stack, this.props.scope === 'app' ? 'the app' : `the ${this.props.resetKey ?? 'current'} tab`)
    void navigator.clipboard.writeText(text).then(() => this.setState({ copied: true }), () => { /* the text stays on screen to select by hand */ })
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children
    const details = describeError(this.state.error, this.state.stack, this.props.scope === 'app' ? 'the app' : `the ${this.props.resetKey ?? 'current'} tab`)
    return (
      <div role="alert" style={this.props.scope === 'app' ? { ...box, height: '100vh' } : { ...box, flex: 1, minHeight: 0 }}>
        <div style={card}>
          <h2 style={title}>Something went wrong on this screen</h2>
          <p style={text}>Your photos, downloads and settings are safe. {this.props.scope === 'tab' ? 'Try again, switch to another tab, or reload.' : 'Reload to start again.'}</p>
          <div style={actions}>
            <button style={primaryBtn} onClick={() => window.location.reload()}>Reload</button>
            {this.props.scope === 'tab' && <button style={quietBtn} onClick={() => this.setState({ error: null, stack: '', copied: false })}>Try again</button>}
          </div>
          <details style={{ marginTop: 18 }}>
            <summary style={summary}>What happened</summary>
            <pre style={pre}>{details}</pre>
            <button style={quietBtn} onClick={this.copy}>{this.state.copied ? 'Copied' : 'Copy details'}</button>
          </details>
        </div>
      </div>
    )
  }
}

const box: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'auto', background: 'var(--ff-cream)' }
const card: React.CSSProperties = { width: 'min(560px, 100%)', background: 'var(--ff-surface)', border: '1px solid var(--ff-border)', borderRadius: 12, padding: '28px 32px', boxShadow: '0 12px 40px var(--ff-shadow-soft)' }
const title: React.CSSProperties = { margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--ff-navy)' }
const text: React.CSSProperties = { margin: '0 0 18px', fontSize: 14, color: 'var(--ff-text-secondary)', lineHeight: 1.5 }
const actions: React.CSSProperties = { display: 'flex', gap: 10 }
const summary: React.CSSProperties = { cursor: 'pointer', fontSize: 13, color: 'var(--ff-text-secondary)', marginBottom: 8 }
const pre: React.CSSProperties = { margin: '0 0 10px', padding: 12, background: 'var(--ff-grey-100)', borderRadius: 6, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 220, overflow: 'auto', userSelect: 'text' }
