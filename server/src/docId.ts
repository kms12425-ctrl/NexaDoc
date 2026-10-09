/**
 * docId 的生成与解析。
 *
 * 硬性约束：docId 必须是「ASCII 安全」的。原因是同一个 docId 同时被用作
 *   1. MongoDB `documents.docId`（REST 层用原始字符串查询、建立索引）
 *   2. Yjs room name（客户端把它拼进 WebSocket URL 路径：`/yjs/<docId>`）
 * 而浏览器会对 URL 路径里的非 ASCII 字符做 percent-encode（中文 → `%E9%98%B6…`），
 * 服务端从 pathname 取回的字符串就不再等于 REST 层用的 docId ——
 * 结果是同一篇文档在数据库里分裂成两条记录（内容存进「幽灵记录」，
 * 版本快照、权限、标题却作用在真实记录上）。
 *
 * 所以：生成时只保留 ASCII 字母/数字；解析时兜底做一次 decodeURIComponent，
 * 兼容历史遗留的（中文）URL。
 */

const MAX_SLUG_LENGTH = 40

/**
 * 由文档标题生成 ASCII 安全的 docId。
 * 中文标题会退化为 `doc-<时间戳>`（可读的标题仍然原样保存在 `documents.title` 里）。
 */
export function generateDocId(name: string): string
{
    const slug = name
        .normalize('NFKD') // é → e + 组合音标，下面再删掉音标
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // 中文等非 ASCII 字符 → '-'
        .replace(/^-+|-+$/g, '')
        .slice(0, MAX_SLUG_LENGTH)
        .replace(/-+$/g, '') // 截断后可能留下尾部 '-'

    return `${slug || 'doc'}-${Date.now()}`
}

/**
 * 从 WebSocket pathname（形如 `/yjs/<docId>`）中提取 docName。
 * 浏览器对非 ASCII 路径会 percent-encode，这里解码回原始 docId，
 * 保证与 REST 层使用的 docId 完全一致。
 */
export function decodeDocName(pathname: string): string
{
    const raw = pathname.replace(/^\/yjs\/?/, '')
    try {
        return decodeURIComponent(raw)
    } catch {
        return raw // 非法转义序列（例如路径里单独出现 '%'）——保持原样
    }
}
