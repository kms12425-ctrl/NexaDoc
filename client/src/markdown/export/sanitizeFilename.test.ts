import { describe, expect, it } from 'vitest'
import { sanitizeFilename } from './sanitizeFilename'

describe('sanitizeFilename', () => {
  it('removes illegal and control characters', () => {
    expect(sanitizeFilename('a<b>:c"d/e\\f|g?h*i')).toBe('abcdefghi')
    expect(sanitizeFilename('a\u0000b\u001fc\u007fd')).toBe('abcd')
  })

  it('collapses whitespace and strips trailing dots and spaces', () => {
    expect(sanitizeFilename('  hello   world  ')).toBe('hello world')
    expect(sanitizeFilename('report...  ')).toBe('report')
  })

  it('falls back to untitled for empty or dot-only titles', () => {
    expect(sanitizeFilename('')).toBe('untitled')
    expect(sanitizeFilename('   ')).toBe('untitled')
    expect(sanitizeFilename('..')).toBe('untitled')
    expect(sanitizeFilename('?*<>:"/\\|')).toBe('untitled')
  })

  it('keeps CJK titles and interior dots', () => {
    expect(sanitizeFilename('会议纪要')).toBe('会议纪要')
    expect(sanitizeFilename('v1.2 release notes')).toBe('v1.2 release notes')
  })
})
