import { useMemo } from 'react'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import FontFamily from '@tiptap/extension-font-family'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { FontSize } from '../extensions/FontSize'

/* ── Shared extensions for HTML generation ───────────────────── */
const previewExtensions = [
  StarterKit.configure({ history: false }),
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  FontFamily,
  FontSize,
  Link.configure({ openOnClick: false }),
  Placeholder.configure({ placeholder: '' }),
]

/* ── Thumbnail dimensions ────────────────────────────────────── */
const THUMB_W = 208
const THUMB_H = 263
const SCALE = 0.32          // 208 / 650 ≈ 0.32 (650px ≈ A4-ish content width)
const CONTENT_W = Math.round(THUMB_W / SCALE)   // ≈ 650
const CONTENT_H = Math.round(THUMB_H / SCALE)   // ≈ 822

interface TemplateThumbnailProps {
  /** Pre-rendered HTML (for document previews) */
  html?: string
  /** TipTap JSON content (for template previews) */
  templateContent?: object
}

export default function TemplateThumbnail({ html, templateContent }: TemplateThumbnailProps)
{
  const contentHtml = useMemo(() =>
  {
    if (html) return html
    if (templateContent) {
      try {
        return generateHTML(templateContent as any, previewExtensions as any)
      } catch {
        return ''
      }
    }
    return ''
  }, [html, templateContent])

  if (!contentHtml || contentHtml === '<p></p>') {
    return (
      <div
        className="doc-thumbnail doc-thumbnail-placeholder"
        style={{ width: THUMB_W, height: THUMB_H }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dadce0" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
    )
  }

  return (
    <div
      className="doc-thumbnail"
      style={{ width: THUMB_W, height: THUMB_H }}
    >
      <div
        className="doc-thumbnail-content"
        style={{
          width: CONTENT_W,
          minHeight: CONTENT_H,
          transform: `scale(${SCALE})`,
          transformOrigin: 'top left',
        }}
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    </div>
  )
}
