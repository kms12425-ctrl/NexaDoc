/**
 * 生成安全的导出文件名（对应计划 8.8 节）。
 * - 去除 Windows / macOS / Linux 的非法字符：`<>:"/\|?*`
 * - 去除控制字符（0x00–0x1f 与 0x7f）
 * - 折叠连续空白、去掉末尾的点与空格（Windows 不允许）
 * - 空标题或退化为 `.` / `..` 时使用 fallback（默认 `untitled`）
 */
export function sanitizeFilename(title: string, fallback = 'untitled'): string {
  const cleaned = title
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
  if (!cleaned || cleaned === '.' || cleaned === '..') return fallback
  return cleaned
}
