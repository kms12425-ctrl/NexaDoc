import type { MarkdownSaveStatus } from '../../types'

export interface MarkdownSession {
  getMarkdown(): string
  subscribe(fn: (markdown: string) => void): () => void
  subscribeStatus(fn: (status: MarkdownSaveStatus) => void): () => void
  update(markdown: string): void
  saveNow(): Promise<void>
  setComposing?(composing: boolean): void
  destroy(): void
}
