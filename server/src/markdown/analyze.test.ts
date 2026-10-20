import { describe, expect, it } from 'vitest'
import { analyzeMarkdown } from './analyze'

describe('Markdown analysis used by body saves', () => {
  it('parses Chinese, English and labeled links and deduplicates exact references', () => {
    expect(analyzeMarkdown('[[ 中文 ]] [[Docs|read me]] [[中文]]').outgoingLinks).toEqual([{ title: '中文' }, { title: 'Docs', label: 'read me' }])
  })
  it.each(['```', '~~~', '````'])('excludes fenced examples with %s', (fence) => {
    expect(analyzeMarkdown(`${fence}md\n[[example]]\n${fence}\n[[real]]`).outgoingLinks).toEqual([{ title: 'real' }])
  })
  it('ignores inline code, indented code and escaped references', () => {
    expect(analyzeMarkdown('`[[one]]` ``[[two]]`` [[real]]\n    [[indented]]\n\\[[escaped]]').outgoingLinks).toEqual([{ title: 'real' }])
  })
  it('keeps longer fences open until a matching closing delimiter', () => {
    expect(analyzeMarkdown('````\n```\n[[code]]\n~~~\n````\n[[real]]').outgoingLinks).toEqual([{ title: 'real' }])
  })
  it('tolerates incomplete syntax and both line endings', () => {
    expect(analyzeMarkdown('[[open\r\n[[目标]]\n[[x|显示]]').outgoingLinks).toEqual([{ title: '目标' }, { title: 'x', label: '显示' }])
  })
  it('does not treat mismatched inline code delimiters as a matching pair', () => {
    expect(analyzeMarkdown('``[[visible]]`').outgoingLinks).toEqual([{ title: 'visible' }])
  })
  it('distinguishes a same-line code span from a fenced block', () => {
    expect(analyzeMarkdown('```[[example]]``` [[real]]').outgoingLinks).toEqual([{ title: 'real' }])
  })
})
