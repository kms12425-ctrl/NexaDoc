import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor as TipTapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import FontFamily from '@tiptap/extension-font-family'
import Placeholder from '@tiptap/extension-placeholder'
import { createYjs } from '../services/yjsProvider'
import { documentsApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import html2pdf from 'html2pdf.js'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import type { CollabSession, RemoteUserState, DocumentAbilities } from '../types'
import { EditorToolbar } from './EditorToolbar'
import { FontSize } from '../extensions/FontSize'
import Link from '@tiptap/extension-link'
import VersionHistoryModal from './VersionHistoryModal'
import ShareModal from './ShareModal'
import CommentPanel from './CommentPanel'

/* ─── Word/character counter ─────────────────────────────────── */
function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

/* ─── Read document name from localStorage (fallback only) ─────── */
function loadDocNameFallback(docId: string): string {
  try {
    const docs = JSON.parse(localStorage.getItem('docs') || '[]')
    const doc = docs.find((d: { id: string }) => d.id === docId)
    return doc?.name || 'Untitled document'
  } catch {
    return 'Untitled document'
  }
}

/* ─── DOCX export helpers ──────────────────────────────────────── */
// TipTap 的 fontSize 是 "12pt" 格式，docx 需要半磅（half-points）
function convertFontSizeToHalfPt(fontSize?: string): number | undefined {
  if (!fontSize) return undefined
  const pt = parseInt(fontSize.replace('pt', ''), 10)
  return pt ? pt * 2 : undefined
}

// TipTap 的 fontFamily 是 "Arial, sans-serif"，docx 只需要字体名
function convertFontFamilyToName(fontFamily?: string): string | undefined {
  if (!fontFamily) return undefined
  return fontFamily.split(',')[0].replace(/"/g, '').trim()
}

// TipTap 的 textAlign 值转换为 docx AlignmentType
function convertAlignment(align?: string): 'left' | 'center' | 'right' | 'both' | undefined {
  switch (align) {
    case 'center': return 'center'
    case 'right': return 'right'
    case 'justify': return 'both'
    default: return 'left'
  }
}

/* ══════════════════════════════════════════════════════════════ */
export default function Editor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  // 标题状态——先用 fallback 快速渲染，API 返回后更新
  const [title, setTitle] = useState(() => loadDocNameFallback(id || ''))
  const [abilities, setAbilities] = useState<DocumentAbilities>({})
  const [users, setUsers] = useState<RemoteUserState[]>([])
  const [activeUser, setActiveUser] = useState<string>('')
  const [mode, setMode] = useState<'edit' | 'view'>('edit')
  const [connected, setConnected] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showComments, setShowComments] = useState(false)

  // 协作会话——同步创建，确保 useEditor 首次渲染就有 document
  // 传入认证用户的 id/name/color，替代随机生成
  const [session, setSession] = useState<CollabSession | null>(() => {
    if (!id) return null
    return createYjs(id, user ? {
      id: user.id,
      name: user.displayName || user.username,
      color: user.avatarColor,
    } : undefined)
  })
  const titleFromRemoteRef = useRef(false)

  /* ── 连接状态监听 + 清理 ─────────────────────────────── */
  useEffect(() => {
    if (!session) return

    const handleStatus = (event: { status: string }) => {
      setConnected(event.status === 'connected')
    }
    session.provider.on('status', handleStatus)

    return () => {
      session.provider.off('status', handleStatus)
      session.destroy()
      setSession(null)
    }
  }, [session])

  /* ── TipTap 编辑器 ─────────────────────────────────────────── */
  const editor = useEditor({
    extensions: [
      // 关闭 history——由 Collaboration 扩展提供 undo/redo
      StarterKit.configure({
        history: false,
      }),

      // Yjs CRDT 协作——绑定 TipTap 到 Y.Doc
      Collaboration.configure({
        document: session?.doc,
      }),

      // 远程光标——显示其他协作者的选区和用户名
      CollaborationCursor.configure({
        provider: session?.provider,
        user: session
          ? {
              name: session.user.name,
              color: session.user.color,
            }
          : undefined,
      }),

      // 字体
      FontFamily,

      // 字号（自定义扩展）
      FontSize,

      // 下划线（StarterKit 不含下划线）
      Underline,

      // 文本对齐
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),

      // 文字颜色
      TextStyle,
      Color,

      // 高亮
      Highlight.configure({
        multicolor: true,
      }),

      // 占位符
      Placeholder.configure({
        placeholder: 'Start typing your document…',
      }),

      // 链接
      Link.configure({
        openOnClick: false,
      }),
    ],
    onUpdate: ({ editor }) => {
      const text = editor.getText()
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0)
      setCharCount(Math.max(0, text.length - 1))
    },
  }, [session?.doc, session?.provider])

  /* ── Awareness 监听（协作者列表 + 标题同步）────────────── */
  useEffect(() => {
    if (!session) return

    const awareness = session.provider.awareness

    const handleAwarenessChange = () => {
      const states = Array.from(awareness.getStates().entries())
      const list: RemoteUserState[] = []
      let typing = ''

      states.forEach(([clientId, state]) => {
        if (!state.user) return
        // 不显示自己
        if (clientId === awareness.clientID) return

        list.push(state as RemoteUserState)

        if (state.selection) {
          typing = state.user.name
        }

        // 标题同步：接受远程标题更新
        if (state.docTitle && state.docTitle !== title) {
          titleFromRemoteRef.current = true
          setTitle(state.docTitle)
        }
      })

      setUsers(list)
      setActiveUser(typing)
    }

    awareness.on('change', handleAwarenessChange)
    return () => {
      awareness.off('change', handleAwarenessChange)
    }
  }, [session, id])

  /* ── 广播标题变化到其他 peers ────────────────────────────── */
  useEffect(() => {
    if (!session) return
    if (titleFromRemoteRef.current) {
      titleFromRemoteRef.current = false
      return
    }
    session.provider.awareness.setLocalStateField('docTitle', title)
  }, [title, session])

  /* ── 从 API 获取文档元数据 + 权限 ────────────────────────── */
  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const meta = await documentsApi.getMetadata(id)
        if (!cancelled) {
          setTitle(meta.name)
          setAbilities(meta.abilities)
          if (meta.abilities.canEdit === false) {
            setMode('view')
          }
        }
      } catch {
        // 文档不存在或无权限——忽略，fallback 标题已设置
      }
    })()
    return () => { cancelled = true }
  }, [id])

  /* ── 持久化标题到 API（debounce 1s）────────────────────────── */
  useEffect(() => {
    if (!id || !abilities.canEdit) return
    if (titleFromRemoteRef.current) return
    const timer = setTimeout(() => {
      documentsApi.updateMetadata(id, title).catch(() => {})
    }, 1000)
    return () => clearTimeout(timer)
  }, [id, title, abilities.canEdit])

  /* ── 广播本地选区变化（远程光标）───────────────────────── */
  useEffect(() => {
    if (!editor || !session) return

    const handleSelectionUpdate = ({ editor }: { editor: TipTapEditor }) => {
      const { from, to } = editor.state.selection
      session.provider.awareness.setLocalStateField('selection', { from, to })
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
    }
  }, [editor, session])

  /* ── 编辑/查看模式切换 ─────────────────────────────────── */
  useEffect(() => {
    if (!editor) return
    if (mode === 'view') {
      editor.setEditable(false)
    } else {
      editor.setEditable(true)
    }
  }, [mode, editor])

  /* ── 导出 handlers ───────────────────────────────────────── */
  const exportPDF = useCallback(() => {
    const content = document.querySelector('.ProseMirror') as HTMLElement | null
    if (!content) return
    html2pdf()
      .set({ margin: 10, filename: `${title}.pdf`, image: { type: 'jpeg', quality: 0.98 } })
      .from(content as any)
      .save()
  }, [title])

  const exportDocx = useCallback(async () => {
    if (!editor) return

    const json = editor.getJSON()
    const paragraphs: Paragraph[] = []

    const convertNode = (node: any) => {
      if (node.type === 'paragraph' || node.type === 'heading') {
        const textRuns: TextRun[] = []
        const headingLevel = node.attrs?.level

        if (node.content) {
          for (const child of node.content) {
            if (child.type === 'text') {
              textRuns.push(
                new TextRun({
                  text: child.text,
                  bold: child.marks?.some((m: any) => m.type === 'bold') || false,
                  italics: child.marks?.some((m: any) => m.type === 'italic') || false,
                  underline: child.marks?.some((m: any) => m.type === 'underline') ? {} : undefined,
                  strike: child.marks?.some((m: any) => m.type === 'strike') || false,
                  color: child.marks?.find((m: any) => m.type === 'textStyle')?.attrs?.color,
                  size: convertFontSizeToHalfPt(
                    child.marks?.find((m: any) => m.type === 'textStyle')?.attrs?.fontSize
                  ),
                  font: convertFontFamilyToName(
                    child.marks?.find((m: any) => m.type === 'textStyle')?.attrs?.fontFamily
                  ),
                })
              )
            }
          }
        }

        paragraphs.push(
          new Paragraph({
            children: textRuns.length > 0 ? textRuns : [new TextRun('')],
            heading: headingLevel ? (`Heading${headingLevel}` as any) : undefined,
            alignment: convertAlignment(node.attrs?.textAlign),
          })
        )
      } else if (node.type === 'bulletList' || node.type === 'orderedList') {
        if (node.content) {
          for (const item of node.content) {
            if (item.type === 'listItem' && item.content) {
              for (const child of item.content) {
                convertNode(child)
              }
            }
          }
        }
      } else if (node.type === 'blockquote') {
        if (node.content) {
          for (const child of node.content) {
            convertNode({ ...child, type: 'paragraph' })
          }
        }
      }
    }

    if (json.content) {
      for (const node of json.content) {
        convertNode(node)
      }
    }

    const doc = new Document({
      sections: [{ children: paragraphs }],
    })

    const blob = await Packer.toBlob(doc)
    saveAs(blob, `${title}.docx`)
  }, [editor, title])

  /* ── Handle title input change ─────────────────────────────── */
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value)
    },
    []
  )

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <>
      {/* ── Top navigation bar ─────────────────────────────── */}
      <div className="topbar">
        <div className="topbar-left">
          <button className="back-btn" onClick={() => navigate('/')} title="Back to documents">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="brand">
            <svg className="brand-icon" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="8" fill="#1a73e8"/>
              <path d="M10 10h14l6 6v14H10V10z" fill="white" opacity="0.9"/>
              <path d="M24 10v6h6" fill="none" stroke="#1a73e8" strokeWidth="1.5"/>
              <rect x="14" y="18" width="12" height="1.5" rx="0.75" fill="#1a73e8"/>
              <rect x="14" y="21.5" width="12" height="1.5" rx="0.75" fill="#1a73e8"/>
              <rect x="14" y="25" width="8" height="1.5" rx="0.75" fill="#1a73e8"/>
            </svg>
            <input
              className="doc-title-input"
              value={title}
              onChange={handleTitleChange}
              aria-label="Document title"
              spellCheck={false}
              readOnly={abilities.canEdit === false}
            />
          </div>
        </div>

        <div className="topbar-right">
          {/* Collaborator avatars */}
          <div className="avatars" aria-label="Active collaborators">
            {users.slice(0, 5).map((u, i) => (
              <div
                key={i}
                className="avatar"
                style={{ background: u.user?.color || '#1a73e8' }}
                title={u.user?.name || 'User'}
              >
                {(u.user?.name || 'U')[0].toUpperCase()}
              </div>
            ))}
          </div>

          <div className={`conn-badge ${connected ? 'online' : 'offline'}`}>
            <span className="conn-dot" />
            {connected ? 'Connected' : 'Offline'}
          </div>

          <button
            className={`mode-btn ${mode === 'edit' ? 'editing' : 'viewing'}`}
            onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
            title={mode === 'edit' ? 'Switch to view mode' : 'Switch to edit mode'}
          >
            {mode === 'edit' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Editing
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Viewing
              </>
            )}
          </button>

          <div className="export-group">
            <button className="export-btn" onClick={exportPDF} title="Export as PDF">PDF</button>
            <button className="export-btn" onClick={exportDocx} title="Export as DOCX">DOCX</button>
          </div>

          {/* Collaboration actions */}
          <div className="collab-actions">
            <button
              className="collab-btn"
              onClick={() => setShowShare(true)}
              title="Share document"
            >
              Share
            </button>
            <button
              className="collab-btn"
              onClick={() => setShowHistory(true)}
              title="Version history"
              disabled={abilities.canViewHistory === false}
            >
              History
            </button>
            <button
              className={`collab-btn ${showComments ? 'active' : ''}`}
              onClick={() => setShowComments(!showComments)}
              title="Comments"
            >
              Comments
            </button>
          </div>
        </div>
      </div>

      {/* ── Editor area ─────────────────────────────────────── */}
      <div className="editor-shell">
        <div className="editor-container">
          {/* Status row */}
          <div className="editor-meta">
            {activeUser && (
              <span className="typing-indicator">
                <span className="typing-dots">
                  <span /><span /><span />
                </span>
                {activeUser} is typing…
              </span>
            )}
            <span className="word-count">
              {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} characters
            </span>
          </div>

          {/* TipTap 编辑器 */}
          <div className={`tiptap-wrapper ${showComments ? 'with-comments' : ''}`}>
            <EditorToolbar editor={editor} />
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Comment side panel */}
        {showComments && session && (
          <CommentPanel
            docId={id || ''}
            canComment={abilities.canComment !== false}
            onClose={() => setShowComments(false)}
          />
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}
      {showShare && (
        <ShareModal
          docId={id || ''}
          canShare={abilities.canShare !== false}
          onClose={() => setShowShare(false)}
        />
      )}
      {showHistory && session && (
        <VersionHistoryModal
          docId={id || ''}
          ydoc={session.doc}
          canViewHistory={abilities.canViewHistory !== false}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  )
}
