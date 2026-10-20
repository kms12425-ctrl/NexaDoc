import { initialSearchText } from './initialSearchText'

export interface MarkdownAnalysis {
  searchText: string
  outgoingLinks: Array<{ title: string; label?: string }>
}

/** Mask matching backtick runs before looking for links; code samples are not references. */
function withoutInlineCode(line: string): string {
  const runs = [...line.matchAll(/`+/g)]
  const next = new Map<number, number>()
  const partners: Array<number | undefined> = []
  for (let index = runs.length - 1; index >= 0; index--) {
    partners[index] = next.get(runs[index][0].length)
    next.set(runs[index][0].length, index)
  }
  const parts: string[] = []
  let cursor = 0
  for (let index = 0; index < runs.length; index++) {
    const start = runs[index].index!
    let slashes = 0
    for (let at = start - 1; at >= 0 && line[at] === '\\'; at--) slashes++
    const partner = partners[index]
    if (slashes % 2 || partner === undefined) continue
    const end = runs[partner].index! + runs[partner][0].length
    parts.push(line.slice(cursor, start), ' '.repeat(end - start))
    cursor = end
    index = partner
  }
  return parts.join('') + line.slice(cursor)
}

export function analyzeMarkdown(markdown: string): MarkdownAnalysis {
  let fence: { marker: string; length: number } | null = null
  const outgoingLinks: MarkdownAnalysis['outgoingLinks'] = []
  const seen = new Set<string>()
  for (const line of markdown.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (marker) {
      if (!fence && !(marker[1][0] === '`' && marker[2].includes('`'))) {
        fence = { marker: marker[1][0], length: marker[1].length }; continue
      }
      if (fence && marker[1][0] === fence.marker && marker[1].length >= fence.length && !marker[2].trim()) { fence = null; continue }
    }
    if (fence || /^(?: {4}|\t)/.test(line)) continue
    const text = withoutInlineCode(line)
    const pattern = /\[\[([^\]|\r\n]+)(?:\|([^\]\r\n]+))?\]\]/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text))) {
      let slashCount = 0
      for (let at = match.index - 1; at >= 0 && text[at] === '\\'; at--) slashCount++
      if (slashCount % 2) continue
      const title = match[1].trim()
      const label = match[2]?.trim()
      const key = JSON.stringify([title, label])
      if (!title || seen.has(key)) continue
      seen.add(key)
      outgoingLinks.push({ title, ...(label ? { label } : {}) })
    }
  }
  return { searchText: initialSearchText(markdown), outgoingLinks }
}
