import type { Parent, Root, Text, Link } from 'mdast'
import type { Plugin } from 'unified'

const excluded = new Set(['link', 'linkReference', 'image', 'imageReference', 'code', 'inlineCode', 'html'])
const pattern = () => /\[\[([^\]|\r\n]+)(?:\|([^\]\r\n]+))?\]\]/g

/** Only transform text nodes. Code, raw HTML and existing links stay untouched. */
const remarkWikiLink: Plugin<[], Root> = () => (tree, file) => {
  const source = String(file.value)
  function walk(parent: Parent) {
    const children: Parent['children'] = []
    for (const node of parent.children) {
      if (node.type !== 'text') {
        if ('children' in node && !excluded.has(node.type)) walk(node as Parent)
        children.push(node)
        continue
      }
      const raw = source.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? 0)
      const rawMatches = [...raw.matchAll(pattern())]
      let ordinal = 0
      let cursor = 0
      for (const match of node.value.matchAll(pattern())) {
        const rawMatch = rawMatches[ordinal++]
        let slashes = 0
        for (let at = (rawMatch?.index ?? 0) - 1; at >= 0 && raw[at] === '\\'; at--) slashes++
        const title = match[1].trim()
        if (!title || slashes % 2) continue
        const index = match.index!
        if (index > cursor) children.push({ type: 'text', value: node.value.slice(cursor, index) } as Text)
        children.push({
          type: 'link', url: `/markdown?q=${encodeURIComponent(title)}`,
          children: [{ type: 'text', value: match[2]?.trim() || title }],
          data: { hProperties: { 'data-wiki-title': title } },
        } as Link)
        cursor = index + match[0].length
      }
      if (cursor === 0) children.push(node)
      else if (cursor < node.value.length) children.push({ type: 'text', value: node.value.slice(cursor) } as Text)
    }
    parent.children = children
  }
  walk(tree)
}

export default remarkWikiLink
