import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  addConnection,
  removeConnection,
  notifyUser,
  isUserOnline,
} from './notifications'
import type { WebSocket } from 'ws'

function createMockWs(open: boolean = true): WebSocket {
  const ws = {
    OPEN: 1,
    CLOSED: 3,
    readyState: open ? 1 : 3,
    send: vi.fn(),
  } as unknown as WebSocket
  return ws
}

describe('addConnection', () => {
  it('registers a user connection and marks online', () => {
    const ws = createMockWs()
    addConnection('u-add-1', ws)
    expect(isUserOnline('u-add-1')).toBe(true)
  })

  it('supports multiple connections per user', () => {
    const ws1 = createMockWs()
    const ws2 = createMockWs()
    addConnection('u-add-2', ws1)
    addConnection('u-add-2', ws2)
    expect(isUserOnline('u-add-2')).toBe(true)
    // 通知两个都应收到
    notifyUser('u-add-2', { type: 'test' })
    expect(ws1.send).toHaveBeenCalledTimes(1)
    expect(ws2.send).toHaveBeenCalledTimes(1)
  })
})

describe('removeConnection', () => {
  it('removes a connection and marks offline when last one', () => {
    const ws = createMockWs()
    addConnection('u-rem-1', ws)
    expect(isUserOnline('u-rem-1')).toBe(true)

    removeConnection('u-rem-1', ws)
    expect(isUserOnline('u-rem-1')).toBe(false)
  })

  it('keeps user online if other connections remain', () => {
    const ws1 = createMockWs()
    const ws2 = createMockWs()
    addConnection('u-rem-2', ws1)
    addConnection('u-rem-2', ws2)

    removeConnection('u-rem-2', ws1)
    expect(isUserOnline('u-rem-2')).toBe(true)
  })

  it('does not throw for non-existent user', () => {
    const ws = createMockWs()
    expect(() => removeConnection('nobody', ws)).not.toThrow()
  })
})

describe('notifyUser', () => {
  it('sends JSON event to all open connections', () => {
    const ws1 = createMockWs(true)
    const ws2 = createMockWs(true)
    addConnection('u-notify-1', ws1)
    addConnection('u-notify-1', ws2)

    const event = { type: 'document-shared', docId: 'abc' }
    notifyUser('u-notify-1', event)

    const expected = JSON.stringify(event)
    expect(ws1.send).toHaveBeenCalledWith(expected)
    expect(ws2.send).toHaveBeenCalledWith(expected)
  })

  it('skips offline user without error', () => {
    expect(() => notifyUser('offline-user', { type: 'test' })).not.toThrow()
  })

  it('only sends to OPEN connections, skips CLOSED', () => {
    const wsOpen = createMockWs(true)
    const wsClosed = createMockWs(false)
    addConnection('u-notify-2', wsOpen)
    addConnection('u-notify-2', wsClosed)

    notifyUser('u-notify-2', { type: 'test' })

    expect(wsOpen.send).toHaveBeenCalledTimes(1)
    expect(wsClosed.send).not.toHaveBeenCalled()
  })
})

describe('isUserOnline', () => {
  it('returns false for unknown user', () => {
    expect(isUserOnline('never-seen')).toBe(false)
  })

  it('returns true after addConnection', () => {
    const ws = createMockWs()
    addConnection('u-online-1', ws)
    expect(isUserOnline('u-online-1')).toBe(true)
  })
})
