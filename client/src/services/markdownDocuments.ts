import { documentsApi, type DocumentWithAbilities } from './api'

export interface MarkdownDocumentMeta extends DocumentWithAbilities {
  editorType: 'markdown'
}

// A1/A2/A3 are integrated. Set false when connecting this client to a legacy server.
export function isMarkdownApiEnabled(): boolean {
  const flag = import.meta.env.VITE_MARKDOWN_API_ENABLED
  return flag === undefined || flag === '' || flag === 'true'
}

function requireMarkdownApi(): void {
  if (!isMarkdownApiEnabled()) throw new Error('Markdown documents are not available yet.')
}

export const markdownDocumentsApi = {
  async list(): Promise<MarkdownDocumentMeta[]> {
    requireMarkdownApi()
    const documents = await documentsApi.list('markdown')
    if (!Array.isArray(documents)) throw new Error('Unable to load Markdown documents.')
    return documents.filter((doc): doc is MarkdownDocumentMeta =>
      doc.editorType === 'markdown' && !doc.shared && doc.abilities?.canView !== false,
    ).sort((a, b) => b.updatedAt - a.updatedAt)
  },

  async create(name: string, markdown: string): Promise<MarkdownDocumentMeta> {
    requireMarkdownApi()
    const document = await documentsApi.create(name, { editorType: 'markdown', markdown, tags: [] })
    if (document.editorType !== 'markdown') {
      throw new Error('Markdown document creation is not supported by this server.')
    }
    return { ...document, editorType: 'markdown' }
  },

  async remove(id: string): Promise<void> {
    requireMarkdownApi()
    await documentsApi.remove(encodeURIComponent(id))
  },
}
