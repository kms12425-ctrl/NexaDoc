import type { DocumentMeta } from '../types'

export const getDocs = (): DocumentMeta[] => {
  try {
    const docs = JSON.parse(localStorage.getItem('docs') || '[]')
    return docs.filter((d: DocumentMeta) => d.id && d.name)
  } catch {
    return []
  }
}

export const saveDocs = (docs: DocumentMeta[]): void => {
  localStorage.setItem('docs', JSON.stringify(docs))
}
