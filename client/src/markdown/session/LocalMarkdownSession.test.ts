import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalMarkdownSession } from './LocalMarkdownSession'
import { MarkdownApiError, MarkdownConflictError, type MarkdownContentTransport } from '../contentApi'

const initial = { markdown: '# Server', revision: 0, updatedAt: 1 }
let sessions: LocalMarkdownSession[] = []
const transport = () => ({ load: vi.fn(async () => initial), save: vi.fn(async (_markdown: string, base: number) => ({ revision: base + 1, updatedAt: Date.now() })) })
function make(api: MarkdownContentTransport = transport(), extra: Partial<ConstructorParameters<typeof LocalMarkdownSession>[0]> = {}) {
  const session = new LocalMarkdownSession({ docId: 'doc', userId: 'user', initial, transport: api, ...extra })
  sessions.push(session)
  return session
}
beforeEach(() => { vi.useFakeTimers(); localStorage.clear() })
afterEach(() => { sessions.forEach((session) => session.destroy()); sessions = []; vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('LocalMarkdownSession', () => {
  it('debounces saves for 800ms and avoids requests for unchanged source', async () => {
    const api = transport(); const session = make(api)
    await session.saveNow(); expect(api.save).not.toHaveBeenCalled()
    session.update('a'); await vi.advanceTimersByTimeAsync(500)
    session.update('ab'); await vi.advanceTimersByTimeAsync(799)
    expect(api.save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(api.save).toHaveBeenCalledWith('ab', 0, false)
    expect(session.getSnapshot()).toMatchObject({ status: 'saved', revision: 1, dirty: false })
    expect(localStorage.getItem(session.draftKey)).toBeNull()
  })
  it('throttles draft writes at 300ms while keeping the latest text', async () => {
    const set = vi.spyOn(Storage.prototype, 'setItem'); const session = make()
    session.update('one'); await vi.advanceTimersByTimeAsync(100)
    session.update('two'); await vi.advanceTimersByTimeAsync(100)
    session.update('three'); await vi.advanceTimersByTimeAsync(99)
    expect(set).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(set).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem(session.draftKey)!)).toMatchObject({ markdown: 'three', revision: 0 })
  })
  it('serializes in-flight writes and never removes a newer draft after an older save succeeds', async () => {
    let first!: (value: { revision: number; updatedAt: number }) => void
    let second!: (value: { revision: number; updatedAt: number }) => void
    const api = transport()
    api.save.mockReturnValueOnce(new Promise((resolve) => { first = resolve })).mockReturnValueOnce(new Promise((resolve) => { second = resolve }))
    const session = make(api)
    session.update('A'); const saving = session.saveNow()
    session.update('B'); await vi.advanceTimersByTimeAsync(300)
    expect(api.save).toHaveBeenCalledTimes(1)
    first({ revision: 1, updatedAt: 2 }); await vi.advanceTimersByTimeAsync(0)
    expect(api.save).toHaveBeenNthCalledWith(2, 'B', 1, false)
    expect(JSON.parse(localStorage.getItem(session.draftKey)!)).toMatchObject({ markdown: 'B', revision: 1 })
    second({ revision: 2, updatedAt: 3 }); await saving
    expect(session.getSnapshot()).toMatchObject({ status: 'saved', revision: 2 })
    expect(localStorage.getItem(session.draftKey)).toBeNull()
  })
  it('saves a reversion made while an earlier write was pending', async () => {
    let finish!: (value: { revision: number; updatedAt: number }) => void
    const api = transport(); api.save.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const session = make(api); session.update('Changed'); const pending = session.saveNow()
    session.update(initial.markdown); finish({ revision: 1, updatedAt: 2 }); await pending
    expect(api.save).toHaveBeenLastCalledWith(initial.markdown, 1, false)
  })
  it('keeps a failed network save locally and retries on reconnect', async () => {
    const api = transport(); api.save.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const session = make(api); session.update('Offline source'); await session.saveNow()
    expect(session.getSnapshot().status).toBe('offline')
    expect(JSON.parse(localStorage.getItem(session.draftKey)!).markdown).toBe('Offline source')
    window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(0)
    expect(session.getSnapshot().status).toBe('saved')
    expect(api.save).toHaveBeenCalledTimes(2)
  })
  it('pauses all automatic retries on a 409 and only overwrites with the explicit latest revision', async () => {
    const api = transport(); api.save.mockRejectedValueOnce(new MarkdownConflictError({ markdown: 'Remote', revision: 3, updatedAt: 3 }))
    const session = make(api); session.update('Mine'); await session.saveNow()
    session.update('Mine revised'); window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(2000)
    await session.saveNow(); expect(api.save).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot()).toMatchObject({ status: 'conflict', conflict: { markdown: 'Remote' } })
    await session.overwriteConflict()
    expect(api.save).toHaveBeenLastCalledWith('Mine revised', 3, false)
    expect(session.getSnapshot()).toMatchObject({ status: 'saved', revision: 4 })
  })
  it('repeats the conflict when the server changes again before an explicit overwrite', async () => {
    const api = transport(); api.save.mockRejectedValueOnce(new MarkdownConflictError({ markdown: 'Remote', revision: 1, updatedAt: 2 }))
    api.save.mockRejectedValueOnce(new MarkdownConflictError({ markdown: 'Newest', revision: 2, updatedAt: 3 }))
    const session = make(api); session.update('Mine'); await session.saveNow(); await session.overwriteConflict()
    expect(session.getMarkdown()).toBe('Mine')
    expect(session.getSnapshot()).toMatchObject({ status: 'conflict', conflict: { revision: 2 } })
  })
  it('loads the fresh server version only after the user chooses it', async () => {
    const api = transport(); api.save.mockRejectedValueOnce(new MarkdownConflictError({ markdown: 'Remote', revision: 1, updatedAt: 2 }))
    api.load.mockResolvedValue({ markdown: 'Freshest', revision: 2, updatedAt: 3 })
    const session = make(api); session.update('Mine'); await session.saveNow(); await session.loadLatest()
    expect(session.getMarkdown()).toBe('Freshest')
    expect(session.getSnapshot()).toMatchObject({ status: 'saved', conflict: null, revision: 2 })
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(session.draftKey)).toBeNull()
  })
  it('offers recovery before making any write, and restores only after approval', async () => {
    localStorage.setItem('md_draft:user:doc', JSON.stringify({ markdown: 'Draft', revision: 0, savedAt: Date.now() }))
    const api = transport(); const session = make(api)
    session.update('Ignored while deciding'); await vi.advanceTimersByTimeAsync(2000)
    expect(session.getMarkdown()).toBe(initial.markdown)
    expect(api.save).not.toHaveBeenCalled()
    session.recoverDraft(); expect(session.getMarkdown()).toBe('Draft')
    await vi.advanceTimersByTimeAsync(800)
    expect(api.save).toHaveBeenCalledWith('Draft', 0, false)
  })
  it('protects an older conflicting draft instead of silently discarding or overwriting it', () => {
    localStorage.setItem('md_draft:user:doc', JSON.stringify({ markdown: 'Old draft', revision: 0, savedAt: 1 }))
    const api = transport(); const session = make(api, { initial: { ...initial, revision: 2, updatedAt: 10 } })
    expect(session.getSnapshot().recovery?.markdown).toBe('Old draft')
    session.recoverDraft()
    expect(session.getSnapshot()).toMatchObject({ status: 'conflict', conflict: { revision: 2 } })
    expect(api.save).not.toHaveBeenCalled()
  })
  it('discards a draft on explicit choice and isolates drafts between accounts', () => {
    localStorage.setItem('md_draft:user:doc', JSON.stringify({ markdown: 'Draft', revision: 0, savedAt: 1 }))
    const other = make(transport(), { userId: 'other' }); expect(other.getSnapshot().recovery).toBeNull()
    const session = make(); session.discardDraft()
    expect(session.getMarkdown()).toBe(initial.markdown)
    expect(localStorage.getItem(session.draftKey)).toBeNull()
  })
  it('ignores corrupt draft payloads without making network writes', () => {
    localStorage.setItem('md_draft:user:doc', '{bad')
    const api = transport(); const session = make(api)
    expect(session.getSnapshot().recovery).toBeNull()
    expect(api.save).not.toHaveBeenCalled()
  })
  it('does not let draft quota errors stop server saves', async () => {
    const api = transport(); const session = make(api, { storage: { getItem: () => null, setItem: () => { throw new Error('Quota') }, removeItem: () => {} } })
    session.update('Work'); await vi.advanceTimersByTimeAsync(300)
    expect(session.getSnapshot().draftWarning).toContain('unavailable')
    await session.saveNow(); expect(session.getSnapshot().status).toBe('saved')
  })
  it('never saves a partially composed IME value', async () => {
    const api = transport(); const session = make(api)
    session.setComposing(true); session.update('zhong'); await vi.advanceTimersByTimeAsync(1600)
    expect(api.save).not.toHaveBeenCalled()
    session.update('中文'); session.setComposing(false); await vi.advanceTimersByTimeAsync(800)
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(api.save).toHaveBeenCalledWith('中文', 0, false)
  })
  it('does not edit, restore or save in read-only mode', async () => {
    const api = transport(); const session = make(api, { readOnly: true })
    session.update('Blocked'); await session.saveNow(); session.destroy()
    expect(session.getMarkdown()).toBe(initial.markdown)
    expect(api.save).not.toHaveBeenCalled()
  })
  it('flushes small changes on exit and retains large drafts without a keepalive request', async () => {
    const api = transport(); const session = make(api)
    session.update('Small'); session.destroy(); await vi.advanceTimersByTimeAsync(0)
    expect(api.save).toHaveBeenCalledWith('Small', 0, true)
    const largeApi = transport(); const large = make(largeApi, { docId: 'large' })
    large.update('大'.repeat(30_000)); large.destroy()
    expect(largeApi.save).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(large.draftKey)!).markdown).toHaveLength(30_000)
  })
  it('keeps local work but stops writes after logout or permission loss', async () => {
    let authorized = true
    const api = transport(); const session = make(api, { isAuthorized: () => authorized })
    session.update('Mine'); authorized = false; session.destroy()
    expect(api.save).not.toHaveBeenCalled()
    expect(localStorage.getItem(session.draftKey)).toContain('Mine')
    const logout = vi.fn(); const deniedApi = transport(); deniedApi.save.mockRejectedValueOnce(new MarkdownApiError('Unauthorized', 401))
    const denied = make(deniedApi, { docId: 'denied', onUnauthorized: logout }); denied.update('Keep'); await denied.saveNow()
    expect(logout).toHaveBeenCalledOnce(); await denied.saveNow()
    expect(deniedApi.save).toHaveBeenCalledOnce()
  })
  it('flushes large content normally when moving to the background', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const api = transport(); const session = make(api)
    const markdown = '文'.repeat(30_000)
    session.update(markdown); document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(api.save).toHaveBeenCalledWith(markdown, 0, false)
    expect(session.getSnapshot().status).toBe('saved')
  })
  it('keeps heavily escaped JSON drafts local on unload even if the raw text is small', () => {
    const api = transport(); const session = make(api)
    session.update('\u0000'.repeat(12_000)); session.destroy()
    expect(api.save).not.toHaveBeenCalled()
    expect(localStorage.getItem(session.draftKey)).toBeTruthy()
  })
  it('removes subscriptions and browser listeners on repeated destruction', () => {
    const session = make(); const listener = vi.fn(); const unsubscribe = session.subscribe(listener)
    unsubscribe(); session.update('One'); expect(listener).not.toHaveBeenCalled()
    session.destroy(); session.destroy(); session.update('Two')
    expect(session.getMarkdown()).toBe('One')
  })
})
