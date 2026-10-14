import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateDocId, decodeDocName } from './docId'

describe('generateDocId', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pure ASCII title', () => {
    expect(generateDocId('My Document')).toMatch(/^my-document-1700000000000-[0-9a-f]{8}$/)
  })

  it('trims and lowercases', () => {
    expect(generateDocId('  Hello World  ')).toMatch(/^hello-world-1700000000000-[0-9a-f]{8}$/)
  })

  it('Chinese title falls back to doc-', () => {
    expect(generateDocId('我的文档')).toMatch(/^doc-1700000000000-[0-9a-f]{8}$/)
  })

  it('special characters become hyphens', () => {
    expect(generateDocId('A & B! C?')).toMatch(/^a-b-c-1700000000000-[0-9a-f]{8}$/)
  })

  it('accented characters are stripped via NFKD', () => {
    expect(generateDocId('café résumé')).toMatch(/^cafe-resume-1700000000000-[0-9a-f]{8}$/)
  })

  it('truncates to 40 chars for slug', () => {
    const long = 'a'.repeat(100)
    const result = generateDocId(long)
    const slug = result.replace(/-1700000000000-[0-9a-f]{8}$/, '')
    expect(slug.length).toBeLessThanOrEqual(40)
  })

  it('trims trailing hyphens after truncation', () => {
    // 43 chars: 40 'a' + '---' → truncated to 40, then trailing '-' trimmed
    const result = generateDocId('a'.repeat(40) + '---')
    const slug = result.replace(/-1700000000000-[0-9a-f]{8}$/, '')
    expect(slug).not.toMatch(/-$/)
  })

  it('empty string falls back to doc-', () => {
    expect(generateDocId('')).toMatch(/^doc-1700000000000-[0-9a-f]{8}$/)
  })

  it('only special chars falls back to doc-', () => {
    expect(generateDocId('!!!???')).toMatch(/^doc-1700000000000-[0-9a-f]{8}$/)
  })

  it('appends an 8-hex random suffix (V-6 hardening)', () => {
    const a = generateDocId('My Document')
    const b = generateDocId('My Document')
    expect(a).toMatch(/^my-document-1700000000000-[0-9a-f]{8}$/)
    expect(b).toMatch(/^my-document-1700000000000-[0-9a-f]{8}$/)
    expect(a).not.toBe(b)
  })
})

describe('decodeDocName', () => {
  it('extracts docName from /yjs/ path', () => {
    expect(decodeDocName('/yjs/my-doc-123')).toBe('my-doc-123')
  })

  it('decodes percent-encoded Chinese', () => {
    expect(decodeDocName('/yjs/%E6%88%91%E7%9A%84')).toBe('我的')
  })

  it('falls back to raw on invalid escape sequence', () => {
    expect(decodeDocName('/yjs/test%gg')).toBe('test%gg')
  })

  it('handles path without /yjs/ prefix', () => {
    expect(decodeDocName('my-doc')).toBe('my-doc')
  })

  it('handles empty path after prefix', () => {
    expect(decodeDocName('/yjs/')).toBe('')
  })

  it('handles /yjs without trailing slash', () => {
    expect(decodeDocName('/yjs')).toBe('')
  })
})
