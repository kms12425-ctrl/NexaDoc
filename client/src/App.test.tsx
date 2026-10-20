import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentWithAbilities } from './services/api'
import App from './App'

const { getMetadata, mountEditor } = vi.hoisted(() => ({
  getMetadata: vi.fn(),
  mountEditor: vi.fn(),
}))

vi.mock('./services/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./services/api')>()
  return {
    ...original,
    documentsApi: { ...original.documentsApi, getMetadata },
  }
})
vi.mock('./components/DocsPage', () => ({ default: () => <h1>Docs workspace</h1> }))
// Route tests exercise the metadata guard; body loading is covered by editor/session tests.
vi.mock('./markdown/contentApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('./markdown/contentApi')>(),
  createMarkdownTransport: () => ({ load: () => new Promise(() => {}), save: vi.fn() }),
}))
vi.mock('./components/Editor', () => ({
  default: ({ metadata }: { metadata: DocumentWithAbilities }) => {
    mountEditor(metadata)
    return <h1>Rich editor: {metadata.name}</h1>
  },
}))

const rich: DocumentWithAbilities = {
  id: 'rich-note', name: 'Rich note', editorType: 'rich',
  createdAt: 1, updatedAt: 1, abilities: { canView: true, canEdit: true },
}
const markdown: DocumentWithAbilities = { ...rich, id: 'md-note', name: 'Study notes', editorType: 'markdown' }

function renderAt(path: string, authenticated = true) {
  window.history.replaceState(null, '', path)
  if (authenticated) {
    const payload = btoa(JSON.stringify({
      id: 'u1', username: 'alice', exp: Math.floor(Date.now() / 1000) + 3600,
    }))
    sessionStorage.setItem('cdocs_token', `e30.${payload}.signature`)
  }
  return render(<App />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_MARKDOWN_API_ENABLED', 'false')
  getMetadata.mockResolvedValue(rich)
})
afterEach(() => vi.unstubAllEnvs())

describe('workspace routes', () => {
  it.each(['/markdown', '/markdown/md-note'])('requires login for %s', async (path) => {
    renderAt(path, false)

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(getMetadata).not.toHaveBeenCalled()
    expect(mountEditor).not.toHaveBeenCalled()
  })

  it('loads the Markdown workspace without requesting document metadata', async () => {
    renderAt('/markdown')

    expect(await screen.findByRole('heading', { name: 'Your Markdown workspace' })).toBeInTheDocument()
    expect(getMetadata).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Start a new document' })).toBeInTheDocument()
    expect(screen.getByText('Markdown document creation and storage are not available yet. You can explore the templates below.')).toBeInTheDocument()
  })

  it('keeps document actions on the Markdown home page and workspace switching in the menu', async () => {
    const user = userEvent.setup()
    renderAt('/markdown')
    const search = await screen.findByRole('searchbox', { name: 'Search Markdown' })
    expect(search).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'New document' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Open app menu' }))
    expect(screen.queryByRole('menuitem', { name: 'New Markdown document' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Search Markdown' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('menuitemradio', { name: 'Docs' }))

    expect(await screen.findByRole('heading', { name: 'Docs workspace' })).toBeInTheDocument()
  })

  it('redirects a Markdown document before mounting the rich editor', async () => {
    getMetadata.mockResolvedValue(markdown)
    renderAt('/document/md-note?from=search#section')

    expect(await screen.findByRole('heading', { name: 'Study notes' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/markdown/md-note')
    expect(window.location.search).toBe('?from=search')
    expect(window.location.hash).toBe('#section')
    expect(mountEditor).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
  })

  it('treats missing editorType as rich and corrects the Markdown URL', async () => {
    const legacy = { ...rich, editorType: undefined }
    getMetadata.mockResolvedValue(legacy)
    renderAt('/markdown/rich-note')

    expect(await screen.findByRole('heading', { name: 'Rich editor: Rich note' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/document/rich-note')
    expect(mountEditor).toHaveBeenCalledWith(legacy)
  })

  it('waits for metadata before mounting an editor and passes the loaded permissions', async () => {
    let resolve!: (document: DocumentWithAbilities) => void
    getMetadata.mockReturnValue(new Promise<DocumentWithAbilities>((done) => { resolve = done }))
    renderAt('/document/rich-note')

    expect(await screen.findByRole('status')).toHaveTextContent('Opening document…')
    expect(mountEditor).not.toHaveBeenCalled()
    const readonly = { ...rich, abilities: { canEdit: false } }
    await act(async () => { resolve(readonly) })

    expect(await screen.findByRole('heading', { name: 'Rich editor: Rich note' })).toBeInTheDocument()
    expect(mountEditor).toHaveBeenCalledWith(readonly)
  })

  it('fails closed on metadata errors and allows retry', async () => {
    const user = userEvent.setup()
    getMetadata.mockRejectedValueOnce(new Error('Document not found'))
    renderAt('/document/rich-note')

    expect(await screen.findByRole('heading', { name: 'Unable to open document' })).toBeInTheDocument()
    expect(mountEditor).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Rich editor: Rich note' })).toBeInTheDocument()
    expect(getMetadata).toHaveBeenCalledTimes(2)
  })

  it('logs out when the metadata request is unauthorized', async () => {
    getMetadata.mockRejectedValueOnce(new Error('Unauthorized'))
    renderAt('/markdown/md-note')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(sessionStorage.getItem('cdocs_token')).toBeNull()
    expect(mountEditor).not.toHaveBeenCalled()
  })

  it('signs out from the Markdown workspace', async () => {
    const user = userEvent.setup()
    renderAt('/markdown')
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(sessionStorage.getItem('cdocs_token')).toBeNull()
  })
})
