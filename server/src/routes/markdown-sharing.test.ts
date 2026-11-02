import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { ObjectId } from 'mongodb'
import { createTestApp, registerUser, grantAccess } from './test-helpers'
import { getDB } from '../db'
import { resolveAccess, Role } from '../rbac'

const app = createTestApp()
let owner: Awaited<ReturnType<typeof registerUser>>
let guest: typeof owner
let outsider: typeof owner
let id: string
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })
const url = (suffix = '') => `/api/documents/${id}${suffix}`
const invite = (role = 'reader', token = owner.token, username = guest.username) => request(app).post(url('/share')).set(auth(token)).send({ username, role })
const visible = async (token: string) => {
  const headers = auth(token)
  return Promise.all([
    request(app).get('/api/documents?type=markdown').set(headers),
    request(app).get('/api/search?q=secret').set(headers),
    request(app).get('/api/tags').set(headers),
    request(app).get('/api/documents/suggest?q=secret').set(headers),
  ])
}
beforeEach(async () => {
  vi.stubEnv('MARKDOWN_SHARING_ENABLED', 'true')
  owner = await registerUser(app, 'owner')
  guest = await registerUser(app, 'guest')
  outsider = await registerUser(app, 'outsider')
  const created = await request(app).post('/api/documents').set(auth(owner.token)).send({ name: 'secret title', editorType: 'markdown', markdown: '# secret body', tags: ['secret-tag'] })
  expect(created.status).toBe(201)
  id = created.body.id
})
afterEach(() => vi.unstubAllEnvs())

describe('40 Markdown invitation-only permissions', () => {
  it.each(['reader', 'commenter', 'editor'])('enforces %s abilities at REST and indexes', async (role) => {
    expect((await invite(role)).status).toBe(200)
    const metadata = await request(app).get(url('/metadata')).set(auth(guest.token))
    expect(metadata.status).toBe(200)
    expect(metadata.body.abilities).toEqual({ canView: true, canEdit: role === 'editor', canDelete: false, canShare: false, canComment: false, canViewHistory: false })
    expect((await request(app).get(url('/markdown')).set(auth(guest.token))).body.markdown).toBe('# secret body')
    const write = await request(app).put(url('/markdown')).set(auth(guest.token)).send({ markdown: '# changed', baseRevision: 0 })
    expect(write.status).toBe(role === 'editor' ? 200 : 403)
    const patch = await request(app).patch(url('/metadata')).set(auth(guest.token)).send({ title: 'changed title', tags: ['changed'] })
    expect(patch.status).toBe(role === 'editor' ? 200 : 403)
    expect((await request(app).delete(url()).set(auth(guest.token))).status).toBe(403)
    expect((await invite('reader', guest.token, outsider.username)).status).toBe(403)
    expect((await request(app).get(url('/access')).set(auth(guest.token))).status).toBe(403)
    for (const suffix of ['/comments', '/snapshots', '/preview']) {
      expect((await request(app).get(url(suffix)).set(auth(guest.token))).status).toBe(403)
    }
    const list = await request(app).get('/api/documents?type=markdown').set(auth(guest.token))
    expect(list.body).toHaveLength(1)
    expect(list.body[0]).toMatchObject({ id, shared: true, abilities: { canEdit: role === 'editor', canDelete: false, canShare: false } })
    if (role === 'editor') {
      const doc = await getDB().collection('documents').findOne({ docId: id })
      expect(doc).toMatchObject({ markdown: '# changed', revision: 1, title: 'changed title', tags: ['changed'] })
      expect(doc?.ownerUserId.toString()).toBe(owner.userId)
    }
  })

  it('hides uninvited documents everywhere, including users who know the URL', async () => {
    for (const suffix of ['/metadata', '/markdown', '/links', '/access']) {
      expect((await request(app).get(url(suffix)).set(auth(outsider.token))).status).toBe(404)
    }
    for (const response of await visible(outsider.token)) { expect(response.status).toBe(200); expect(response.body).toEqual([]) }
    expect(await resolveAccess(id, null)).toBeNull()
    expect((await request(app).get(url('/markdown'))).status).toBe(401)
  })

  it('keeps editor saves revision-safe against a concurrent owner save', async () => {
    await invite('editor')
    expect((await request(app).put(url('/markdown')).set(auth(owner.token)).send({ markdown: '# owner', baseRevision: 0 })).status).toBe(200)
    const stale = await request(app).put(url('/markdown')).set(auth(guest.token)).send({ markdown: '# guest', baseRevision: 0 })
    expect(stale.status).toBe(409)
    expect(stale.body).toMatchObject({ markdown: '# owner', revision: 1 })
  })

  it.each(['false', '', 'TRUE'])('fails closed when sharing flag is %s and restores invitations when enabled again', async (flag) => {
    await invite('editor')
    vi.stubEnv('MARKDOWN_SHARING_ENABLED', flag)
    expect(await resolveAccess(id, guest.userId)).toBeNull()
    for (const response of await visible(guest.token)) expect(response.body).toEqual([])
    expect((await request(app).get(url('/markdown')).set(auth(guest.token))).status).toBe(404)
    expect((await invite()).status).toBe(403)
    expect((await request(app).get(url('/metadata')).set(auth(owner.token))).body.abilities.canShare).toBe(false)
    expect((await request(app).put(url('/markdown')).set(auth(owner.token)).send({ markdown: 'owner after rollback', baseRevision: 0 })).status).toBe(200)
    vi.stubEnv('MARKDOWN_SHARING_ENABLED', 'true')
    expect((await request(app).get(url('/markdown')).set(auth(guest.token))).body.markdown).toBe('owner after rollback')
  })
})

describe('41 owner-managed invitations', () => {
  it.each(['owner', 'administrator', 'bogus', '', null, {}, ['editor']])('rejects unsupported role %j', async (role) => {
    const response = await request(app).post(url('/share')).set(auth(owner.token)).send({ username: guest.username, role })
    expect(response.status).toBe(400)
    expect(await getDB().collection('document_access').countDocuments()).toBe(0)
  })
  it('rejects malformed usernames and owner changes, and reports unknown users', async () => {
    expect((await request(app).post(url('/share')).set(auth(owner.token)).send({ username: { $ne: null }, role: 'reader' })).status).toBe(400)
    expect((await invite('reader', owner.token, owner.username)).status).toBe(400)
    expect((await invite('reader', owner.token, 'nobody')).status).toBe(404)
    expect((await request(app).delete(url('/access/invalid')).set(auth(owner.token))).status).toBe(400)
    expect((await request(app).delete(url(`/access/${owner.userId}`)).set(auth(owner.token))).status).toBe(400)
  })
  it('updates an invitation without duplicates and immediately applies role downgrade', async () => {
    await invite('editor'); await invite('reader')
    expect(await getDB().collection('document_access').countDocuments()).toBe(1)
    const members = await request(app).get(url('/access')).set(auth(owner.token))
    expect(members.body.map((row: any) => row.role)).toEqual(['owner', 'reader'])
    expect((await request(app).put(url('/markdown')).set(auth(guest.token)).send({ markdown: 'forbidden', baseRevision: 0 })).status).toBe(403)
  })
  it('only owner can revoke, after which every visibility surface and write rejects the former editor', async () => {
    await invite('editor')
    expect((await request(app).delete(url(`/access/${guest.userId}`)).set(auth(guest.token))).status).toBe(403)
    expect((await request(app).delete(url(`/access/${guest.userId}`)).set(auth(owner.token))).status).toBe(200)
    for (const response of await visible(guest.token)) expect(response.body).toEqual([])
    for (const suffix of ['/markdown', '/metadata', '/links']) expect((await request(app).get(url(suffix)).set(auth(guest.token))).status).toBe(404)
    expect((await request(app).put(url('/markdown')).set(auth(guest.token)).send({ markdown: 'forbidden', baseRevision: 0 })).status).toBe(404)
    expect((await request(app).patch(url('/metadata')).set(auth(guest.token)).send({ tags: ['forbidden'] })).status).toBe(404)
  })
})

describe('42 shared discovery and link privacy', () => {
  it('includes invited documents in all/type=markdown lists, content search, tags and suggestions but never rich lists', async () => {
    await invite('reader')
    for (const response of await visible(guest.token)) { expect(response.status).toBe(200); expect(response.body).toHaveLength(1) }
    const search = await request(app).get('/api/search?q=body&tag=secret-tag').set(auth(guest.token))
    expect(search.body[0]).toMatchObject({ id, shared: true, snippet: 'secret body', abilities: { canEdit: false, canDelete: false } })
    expect((await request(app).get('/api/documents?type=all').set(auth(guest.token))).body[0].id).toBe(id)
    expect((await request(app).get('/api/documents?type=rich').set(auth(guest.token))).body).toEqual([])
    // Even a stale invitation to an owner's own document must not duplicate the result.
    await grantAccess(id, owner.userId, Role.READER)
    expect((await request(app).get('/api/documents?type=markdown').set(auth(owner.token))).body).toHaveLength(1)
  })
  it('filters inaccessible backlink sources and outgoing target IDs per viewer and after revocation', async () => {
    await invite('reader')
    const source = await request(app).post('/api/documents').set(auth(owner.token)).send({ name: 'private source', editorType: 'markdown', markdown: '' })
    await request(app).put(`/api/documents/${source.body.id}/markdown`).set(auth(owner.token)).send({ markdown: '[[secret title]]', baseRevision: 0 })
    const hidden = await request(app).get(url('/links')).set(auth(guest.token))
    expect(hidden.body.backlinks).toEqual([])
    await request(app).post(`/api/documents/${source.body.id}/share`).set(auth(owner.token)).send({ username: guest.username, role: 'reader' })
    expect((await request(app).get(url('/links')).set(auth(guest.token))).body.backlinks).toEqual([{ id: source.body.id, title: 'private source' }])
    await request(app).delete(url(`/access/${guest.userId}`)).set(auth(owner.token))
    expect((await request(app).get(`/api/documents/${source.body.id}/links`).set(auth(guest.token))).body.outgoing).toEqual([{ title: 'secret title', targetDocId: null }])
    // A newly saved reference can resolve a shared target even when the saver isn't its owner.
    await invite('reader')
    await request(app).post(`/api/documents/${source.body.id}/share`).set(auth(owner.token)).send({ username: guest.username, role: 'editor' })
    const saved = await request(app).put(`/api/documents/${source.body.id}/markdown`).set(auth(guest.token)).send({ markdown: '[[secret title]]', baseRevision: 1 })
    expect(saved.status).toBe(200)
    expect((await request(app).get(`/api/documents/${source.body.id}/links`).set(auth(guest.token))).body.outgoing[0].targetDocId).toBe(id)
  })
  it('preserves private target identities when a shared editor saves an unchanged reference without exposing the ID', async () => {
    const target = await request(app).post('/api/documents').set(auth(owner.token)).send({ name: 'private target', editorType: 'markdown', markdown: '' })
    await request(app).put(url('/markdown')).set(auth(owner.token)).send({ markdown: '[[private target]]', baseRevision: 0 })
    await invite('editor')
    expect((await request(app).get(url('/links')).set(auth(guest.token))).body.outgoing[0].targetDocId).toBeNull()
    expect((await request(app).put(url('/markdown')).set(auth(guest.token)).send({ markdown: '[[private target]] more text', baseRevision: 1 })).status).toBe(200)
    expect((await request(app).get(url('/links')).set(auth(owner.token))).body.outgoing[0].targetDocId).toBe(target.body.id)
    expect((await request(app).get(url('/links')).set(auth(guest.token))).body.outgoing[0].targetDocId).toBeNull()
  })
  it('omits deleted shared documents and does not resurrect them through sharing', async () => {
    await invite('editor')
    await request(app).delete(url()).set(auth(owner.token))
    for (const response of await visible(guest.token)) expect(response.body).toEqual([])
    expect((await invite()).status).toBe(404)
    expect((await request(app).get(url('/markdown')).set(auth(guest.token))).status).toBe(404)
  })
  it('does not activate unsupported legacy administrator/owner invitations', async () => {
    await grantAccess(id, guest.userId, Role.ADMIN)
    for (const response of await visible(guest.token)) expect(response.body).toEqual([])
    expect(await resolveAccess(id, guest.userId)).toBeNull()
  })
})
