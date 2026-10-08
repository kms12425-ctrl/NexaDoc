import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login, error } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const displayError = localError || error

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="8" fill="#1a73e8"/>
            <path d="M10 10h14l6 6v14H10V10z" fill="white" opacity="0.9"/>
            <path d="M24 10v6h6" fill="none" stroke="#1a73e8" strokeWidth="1.5"/>
            <rect x="14" y="18" width="12" height="1.5" rx="0.75" fill="#1a73e8"/>
            <rect x="14" y="21.5" width="12" height="1.5" rx="0.75" fill="#1a73e8"/>
            <rect x="14" y="25" width="8" height="1.5" rx="0.75" fill="#1a73e8"/>
          </svg>
          <h1>NexaDoc</h1>
        </div>

        <h2 className="auth-title">Sign in</h2>
        <p className="auth-subtitle">Enter your credentials to continue</p>

        {displayError && <div className="auth-error">{displayError}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field">
            <span className="auth-label">Username</span>
            <input
              ref={inputRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
              minLength={2}
            />
          </label>

          <label className="auth-field">
            <span className="auth-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
              minLength={6}
            />
          </label>

          <button type="submit" className="auth-submit" disabled={loading || !username || !password}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{' '}
          <a href="/register" onClick={(e) => { e.preventDefault(); navigate('/register') }}>
            Create one
          </a>
        </p>
      </div>
    </div>
  )
}
