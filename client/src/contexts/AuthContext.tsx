import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { authApi, getToken, setToken, clearToken } from '../services/api'
import type { User } from '../types'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, email?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* ── 启动时检查 token 有效性 ──────────────────────────────── */
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    // 尝试用 token 获取用户信息（通过 me 端点或解码 JWT）
    // 由于后端没有 /me 端点，我们解码 JWT 获取用户信息
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        clearToken()
        setLoading(false)
        return
      }
      setUser({
        id: payload.id,
        username: payload.username,
        displayName: payload.username,
        avatarColor: payload.avatarColor || '#1a73e8',
      })
    } catch {
      clearToken()
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setError(null)
    try {
      const res = await authApi.login(username, password)
      setToken(res.token)
      setUser(res.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      throw err
    }
  }, [])

  const register = useCallback(async (username: string, password: string, email?: string) => {
    setError(null)
    try {
      const res = await authApi.register(username, password, email)
      setToken(res.token)
      setUser(res.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
