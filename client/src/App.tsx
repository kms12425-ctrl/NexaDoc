import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import DocsPage from './components/DocsPage'
import Editor from './components/Editor'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'

function ProtectedRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="auth-loading">Loading…</div>
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<DocsPage />} />
      <Route path="/document/:id" element={<Editor />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ProtectedRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
