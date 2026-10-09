import { describe, it, expect, beforeEach } from 'vitest'
import { getDocs, saveDocs } from './storage'
import type { DocumentMeta } from '../types'

beforeEach(() => {
  localStorage.clear()
})

describe('getDocs', () => {
  it('returns empty array when no docs in localStorage', () => {
    expect(getDocs()).toEqual([])
  })

  it('returns parsed docs', () => {
    const docs: DocumentMeta[] = [
      { id: 'doc1', name: 'Doc 1', createdAt: 1000, updatedAt: 2000 },
      { id: 'doc2', name: 'Doc 2', createdAt: 3000, updatedAt: 4000 },
    ]
    localStorage.setItem('docs', JSON.stringify(docs))
    expect(getDocs()).toHaveLength(2)
    expect(getDocs()[0].id).toBe('doc1')
  })

  it('filters out entries without id', () => {
    const docs = [
      { id: 'doc1', name: 'Doc 1', createdAt: 1000, updatedAt: 2000 },
      { name: 'No ID', createdAt: 1000, updatedAt: 2000 },
    ]
    localStorage.setItem('docs', JSON.stringify(docs))
    expect(getDocs()).toHaveLength(1)
  })

  it('filters out entries without name', () => {
    const docs = [
      { id: 'doc1', name: 'Doc 1', createdAt: 1000, updatedAt: 2000 },
      { id: 'doc2', createdAt: 1000, updatedAt: 2000 },
    ]
    localStorage.setItem('docs', JSON.stringify(docs))
    expect(getDocs()).toHaveLength(1)
  })

  it('returns empty array on JSON parse error', () => {
    localStorage.setItem('docs', 'garbage{not json')
    expect(getDocs()).toEqual([])
  })
})

describe('saveDocs', () => {
  it('saves docs to localStorage as JSON', () => {
    const docs: DocumentMeta[] = [
      { id: 'doc1', name: 'Doc 1', createdAt: 1000, updatedAt: 2000 },
    ]
    saveDocs(docs)
    const raw = localStorage.getItem('docs')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toEqual(docs)
  })

  it('saves multiple docs', () => {
    const docs: DocumentMeta[] = [
      { id: 'a', name: 'A', createdAt: 1, updatedAt: 2 },
      { id: 'b', name: 'B', createdAt: 3, updatedAt: 4 },
    ]
    saveDocs(docs)
    expect(getDocs()).toHaveLength(2)
  })
})
