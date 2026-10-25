import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink } from 'docx'
import type { Root, RootContent, PhrasingContent, List } from 'mdast'

/**
 * Markdown → DOCX（对应计划 8.8 节）。
 * 客户端用 remark（unified + remark-parse + remark-gfm）解析为 mdast，
 * 再映射为 docx 的 Paragraph/TextRun。支持范围与已知降级：
 *  - 支持：标题 1–6、段落、粗体/斜体/删除线/行内代码、链接、无序/有序列表、引用、代码块、分割线。
 *  - 表格：P1，降级为 `单元格 | 单元格` 纯文本（不崩溃）。
 *  - 图片：P0 跳过，仅保留 alt 文本。
 */

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
]

interface RunStyle { bold?: boolean; italics?: boolean; strike?: boolean; mono?: boolean }

interface GfmTable {
  type: 'table'
  children: Array<{ type: 'tableRow'; children: Array<{ type: 'tableCell'; children: PhrasingContent[] }> }>
}

function textRun(text: string, style: RunStyle): TextRun {
  return new TextRun({ text, bold: style.bold, italics: style.italics, strike: style.strike, font: style.mono ? { name: 'Consolas' } : undefined })
}

function plainText(content: PhrasingContent[]): string {
  let text = ''
  for (const node of content) {
    if (node.type === 'text' || node.type === 'inlineCode') text += node.value
    else if (node.type === 'image') text += node.alt ?? ''
    else if ('children' in node) text += plainText(node.children as PhrasingContent[])
  }
  return text
}

function codeRuns(code: string): TextRun[] {
  const runs: TextRun[] = []
  code.split(/\r?\n/).forEach((line, index) => {
    if (index > 0) runs.push(new TextRun({ break: 1 }))
    runs.push(new TextRun({ text: line, font: { name: 'Consolas' } }))
  })
  return runs
}

function inlineRuns(content: PhrasingContent[], style: RunStyle = {}): Array<TextRun | ExternalHyperlink> {
  const result: Array<TextRun | ExternalHyperlink> = []
  for (const node of content) {
    switch (node.type) {
      case 'text':
        result.push(textRun(node.value, style))
        break
      case 'inlineCode':
        result.push(textRun(node.value, { ...style, mono: true }))
        break
      case 'strong':
        result.push(...inlineRuns(node.children, { ...style, bold: true }))
        break
      case 'emphasis':
        result.push(...inlineRuns(node.children, { ...style, italics: true }))
        break
      case 'delete':
        result.push(...inlineRuns(node.children, { ...style, strike: true }))
        break
      case 'break':
        result.push(new TextRun({ break: 1 }))
        break
      case 'image':
        // P0：图片跳过，仅保留 alt 文本（斜体标记降级）。
        result.push(textRun(node.alt ?? '', { ...style, italics: true }))
        break
      case 'link': {
        const children = inlineRuns(node.children, style).filter((run): run is TextRun => run instanceof TextRun)
        result.push(new ExternalHyperlink({ children, link: node.url }))
        break
      }
      case 'html':
        // 原始 HTML 不导出，避免在 DOCX 中引入可执行内容。
        break
      default:
        // linkReference / imageReference 等罕见节点跳过。
        break
    }
  }
  return result
}

function listToParagraphs(list: List, depth: number): Paragraph[] {
  const blocks: Paragraph[] = []
  let index = 0
  for (const item of list.children) {
    if (item.type !== 'listItem') continue
    index += 1
    for (const child of item.children) {
      if (child.type === 'paragraph') {
        if (list.ordered) {
          blocks.push(new Paragraph({ children: [textRun(`${index}. `, {}), ...inlineRuns(child.children)], indent: { left: depth * 480 } }))
        } else {
          blocks.push(new Paragraph({ children: inlineRuns(child.children), bullet: { level: depth }, indent: { left: depth * 480 } }))
        }
      } else if (child.type === 'list') {
        blocks.push(...listToParagraphs(child, depth + 1))
      } else {
        blocks.push(...blockToParagraphs(child))
      }
    }
  }
  return blocks
}

function tableToParagraphs(table: GfmTable): Paragraph[] {
  const blocks: Paragraph[] = []
  for (const row of table.children) {
    const cells = row.children.map((cell) => plainText(cell.children))
    blocks.push(new Paragraph({ children: [textRun(cells.join(' | '), {})] }))
  }
  return blocks
}

function blockToParagraphs(node: RootContent): Paragraph[] {
  switch (node.type) {
    case 'heading': {
      const level = Math.min(Math.max(node.depth, 1), 6)
      return [new Paragraph({ children: inlineRuns(node.children), heading: HEADING_LEVELS[level - 1] })]
    }
    case 'paragraph':
      return [new Paragraph({ children: inlineRuns(node.children) })]
    case 'blockquote': {
      const blocks: Paragraph[] = []
      for (const child of node.children) blocks.push(...blockToParagraphs(child))
      return blocks
    }
    case 'code':
      return [new Paragraph({ children: codeRuns(node.value), spacing: { before: 120, after: 120 } })]
    case 'thematicBreak':
      return [new Paragraph({ children: [textRun('───', {})] })]
    case 'list':
      return listToParagraphs(node, 0)
    case 'table':
      return tableToParagraphs(node as unknown as GfmTable)
    default:
      return []
  }
}

/** 将 Markdown 源码转换为 docx 的 Blob，供 file-saver 下载。 */
export async function markdownToDocxBlob(markdown: string): Promise<Blob> {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root
  const paragraphs: Paragraph[] = []
  for (const node of tree.children) paragraphs.push(...blockToParagraphs(node))
  const doc = new Document({ sections: [{ children: paragraphs }] })
  return Packer.toBlob(doc)
}
