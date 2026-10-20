/** Initial text index for A2. A6 will add full wiki-link analysis for the save path. */
export function initialSearchText(markdown: string): string {
  let fence: { marker: string; size: number } | null = null
  const lines: string[] = []
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (match) {
      if (!fence) {
        fence = { marker: match[1][0], size: match[1].length }
        continue
      }
      if (match[1][0] === fence.marker && match[1].length >= fence.size && !match[2].trim()) {
        fence = null
        continue
      }
    }
    if (fence) { lines.push(line); continue }
    if (/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) continue
    lines.push(line
      .replace(/!?(\[([^\]]*)\])\([^\n)]*\)/g, '$2')
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_all, title: string, label?: string) => label ?? title)
      .replace(/<[^>]*>/g, '')
      .replace(/^\s{0,3}(?:#{1,6}\s+|(?:>\s*)+|[-+*]\s+|\d+[.)]\s+)/, '')
      .replace(/^\s*\[[ xX]\]\s+/, '')
      .replace(/[`*_~|]/g, ' '))
  }
  return lines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 500_000)
}
