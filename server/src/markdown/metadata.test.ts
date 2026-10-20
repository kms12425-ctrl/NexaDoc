import { describe, expect, it } from 'vitest'
import { normalizeTags } from './metadata'
import { initialSearchText } from './initialSearchText'

describe('initial Markdown metadata', () => {
  it('normalizes tags, whitespace and case-insensitive duplicates', () => {
    expect(normalizeTags([' #Work ', 'work', '# 学习 ', 'two\t words', '##笔记', '', '#', 1, null, 'a'.repeat(31)]))
      .toEqual(['Work', '学习', 'two words', '笔记'])
  })
  it('limits the number of valid unique tags to 20', () => {
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => '#' + i))).toEqual(Array.from({ length: 20 }, (_, i) => String(i)))
  })
  it('handles omitted or non-array tags without a crash', () => {
    for (const input of [undefined, null, 'tag', {}]) expect(normalizeTags(input)).toEqual([])
  })
  it('removes basic Markdown syntax while preserving Chinese text and displayed labels', () => {
    expect(initialSearchText('# 中文 **标题**\n\n- [ ] 任务\n> 引用\n[链接](https://example.com) ![图片](image.png) [[目标|标签]] `code`'))
      .toBe('中文 标题 任务 引用 链接 图片 标签 code')
  })
  it('keeps fenced code content but drops fence delimiters and table separators', () => {
    expect(initialSearchText('~~~js\nconst x = "**raw**"\n~~~\n| A | B |\n| --- | :---: |\n| 1 | 2 |'))
      .toBe('const x = "**raw**" A B 1 2')
  })
  it('supports longer and mixed code fences without ending the block prematurely', () => {
    expect(initialSearchText('````text\n~~~\n```\n**code**\n````\n# Tail')).toBe('~~~ ``` **code** Tail')
  })
})
