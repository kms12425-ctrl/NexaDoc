import { describe, expect, it } from 'vitest'
import { markdownToDocxBlob } from './markdownToDocx'

describe('markdownToDocxBlob', () => {
  it('produces a non-empty docx blob for headings, emphasis, lists and code', async () => {
    const blob = await markdownToDocxBlob('# Title\n\nSome **bold** and *italic* text\n\n- item one\n- item two\n\n```js\nconst a = 1\n```')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('degrades tables to plain text without crashing', async () => {
    const blob = await markdownToDocxBlob('| a | b |\n| --- | --- |\n| 1 | 2 |')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('handles quotes, links, images and thematic breaks', async () => {
    const blob = await markdownToDocxBlob('> quote\n\n[link](https://example.com)\n\n![alt](img.png)\n\n---')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('handles empty markdown', async () => {
    const blob = await markdownToDocxBlob('')
    expect(blob.size).toBeGreaterThan(0)
  })
})
