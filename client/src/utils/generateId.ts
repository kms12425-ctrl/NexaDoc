/**
 * 客户端本地 docId 生成——必须与后端 `server/src/docId.ts` 的 generateDocId 遵守同一约定：
 * **docId 只能包含 ASCII 字符**。
 *
 * 原因：docId 会被拼进 WebSocket 路径（`/yjs/<docId>`），浏览器会把中文等非 ASCII
 * 字符 percent-encode，服务端拿到的 room name 就不再等于 REST 层的 docId，
 * 同一篇文档会在数据库里分裂成两条记录。
 *
 * 注：目前创建文档走 REST（`POST /api/documents`，docId 由后端生成），
 * 本函数保留作为客户端本地生成 id 时的一致性实现。
 */
const MAX_SLUG_LENGTH = 40

export const generateId = (name: string): string =>
{
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // 中文等非 ASCII 字符 → '-'
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '')

  return `${slug || 'doc'}-${Date.now()}`
}
