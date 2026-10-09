import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateId } from './generateId'

describe('generateId', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pure ASCII title', () => {
    expect(generateId('Hello World')).toBe('hello-world-1700000000000')
  })

  it('Chinese title falls back to doc-', () => {
    expect(generateId('测试文档')).toBe('doc-1700000000000')
  })

  it('special characters become hyphens', () => {
    expect(generateId('A&B!C')).toBe('a-b-c-1700000000000')
  })

  it('empty string falls back to doc-', () => {
    expect(generateId('')).toBe('doc-1700000000000')
  })

  it('truncates slug to 40 chars', () => {
    const result = generateId('a'.repeat(100))
    const slug = result.replace(/-1700000000000$/, '')
    expect(slug.length).toBeLessThanOrEqual(40)
  })

  it('accented characters stripped via NFKD', () => {
    expect(generateId('café')).toBe('cafe-1700000000000')
  })
})
