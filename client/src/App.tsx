import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import DocsPage from './components/DocsPage'
import Editor from './components/Editor'
import LoginPage from './components/LoginPage'
import RegisterPage from './components/RegisterPage'
import DocumentTypeGuard from './components/DocumentTypeGuard'

const MarkdownHome = lazy(() => import('./components/markdown/MarkdownHome'))
const MarkdownEditor = lazy(() => import('./components/markdown/MarkdownEditor'))

function ProtectedRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="auth-loading">Loading…</div>
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Suspense fallback={<div className="route-status" role="status">Loading workspace…</div>}>
      <Routes>
        <Route path="/" element={<DocsPage />} />
        <Route path="/document/:id" element={
          <DocumentTypeGuard expectedType="rich">
            {(metadata) => <Editor key={metadata.id} metadata={metadata} />}
          </DocumentTypeGuard>
        } />
        <Route path="/markdown" element={<MarkdownHome />} />
        <Route path="/markdown/:id" element={
          <DocumentTypeGuard expectedType="markdown">
            {(metadata) => <MarkdownEditor key={metadata.id} metadata={metadata} />}
          </DocumentTypeGuard>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
