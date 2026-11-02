import { useEffect, useRef } from 'react'
import { getNotificationWsUrl, getToken } from '../services/api'
export interface MarkdownNotice { type: string; docId?: string; name?: string }

/** Reconnect notifications and revalidate on open to recover missed permission events. */
export function useMarkdownNotifications(onNotice: (notice: MarkdownNotice) => void, enabled = true) {
  const latest = useRef(onNotice); latest.current = onNotice
  useEffect(() => {
    if (!enabled || !getToken()) return
    let active = true; let socket: WebSocket | undefined; let timer: ReturnType<typeof setTimeout>
    const connect = () => {
      if (!active || !navigator.onLine || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return
      const current = new WebSocket(getNotificationWsUrl())
      socket = current
      current.onmessage = (message) => {
        try { const value = JSON.parse(message.data) as MarkdownNotice; if (active) latest.current(value) } catch { /* Ignore malformed notifications. */ }
      }
      current.onclose = () => { if (active && socket === current) timer = setTimeout(connect, 1500) }
      current.onerror = () => current.close()
    }
    const offline = () => socket?.close()
    window.addEventListener('online', connect); window.addEventListener('offline', offline)
    connect()
    return () => { active = false; clearTimeout(timer); socket?.close(); window.removeEventListener('online', connect); window.removeEventListener('offline', offline) }
  }, [enabled])
}
