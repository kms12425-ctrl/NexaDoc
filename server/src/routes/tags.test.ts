import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createTestApp, registerUser } from './test-helpers'

const app = createTestApp()

describe('Markdown tags and wiki-link suggestions', () => {
  it('counts only the current user’s Markdown tags and filters them', async () => {
    const owner = await registerUser(app, 'tag-owner')
    const other = await registerUser(app, 'tag-other')
    for (const [name, tags] of [['One', ['阅读', 'Yjs']], ['Two', ['阅读']]] as const) {
      await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name, editorType: 'markdown', tags })
    }
    await request(app).post('/api/documents').set('Authorization', `Bearer ${other.token}`).send({ name: 'Hidden', editorType: 'markdown', tags: ['阅读'] })
    expect((await request(app).get('/api/tags').set('Authorization', `Bearer ${owner.token}`)).body).toEqual([{ tag: '阅读', count: 2 }, { tag: 'Yjs', count: 1 }])
    expect((await request(app).get('/api/tags?q=yjs').set('Authorization', `Bearer ${owner.token}`)).body).toEqual([{ tag: 'Yjs', count: 1 }])
  })

  it('suggests owned Markdown titles, preferring prefixes', async () => {
    const owner = await registerUser(app, 'suggest-owner')
    for (const name of ['Yjs guide', 'Learn Yjs', 'Yjs notes']) await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name, editorType: 'markdown' })
    const res = await request(app).get('/api/documents/suggest?q=Yjs&limit=2').set('Authorization', `Bearer ${owner.token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body.every((item: { title: string; editorType: string }) => item.title.startsWith('Yjs') && item.editorType === 'markdown')).toBe(true)
  })
  it('excludes rich documents and other users from tag counts', async () => {
    const owner = await registerUser(app, 'tag-owner-rich')
    const other = await registerUser(app, 'tag-other-rich')
    await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Rich', editorType: 'rich', tags: ['笔记'] })
    await request(app).post('/api/documents').set('Authorization', `Bearer ${other.token}`).send({ name: 'Hidden', editorType: 'markdown', tags: ['笔记'] })
    await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Mine', editorType: 'markdown', tags: ['笔记'] })
    expect((await request(app).get('/api/tags').set('Authorization', `Bearer ${owner.token}`)).body).toEqual([{ tag: '笔记', count: 1 }])
  })

  it('suggestions respect the limit and return only Markdown titles', async () => {
    const owner = await registerUser(app, 'suggest-limit')
    for (const name of ['Apple', 'Apricot', 'Avocado']) await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name, editorType: 'markdown' })
    const res = await request(app).get('/api/documents/suggest?q=A&limit=2').set('Authorization', `Bearer ${owner.token}`)
    expect(res.body).toHaveLength(2)
    expect(res.body.every((item: { title: string; editorType: string }) => item.title.startsWith('A') && item.editorType === 'markdown')).toBe(true)
  })

  it('suggestions exclude rich and other users’ documents', async () => {
    const owner = await registerUser(app, 'suggest-owner-only')
    const other = await registerUser(app, 'suggest-other-owner')
    await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Yjs guide', editorType: 'markdown' })
    await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Yjs rich', editorType: 'rich' })
    await request(app).post('/api/documents').set('Authorization', `Bearer ${other.token}`).send({ name: 'Yjs hidden', editorType: 'markdown' })
    const res = await request(app).get('/api/documents/suggest?q=Yjs').set('Authorization', `Bearer ${owner.token}`)
    expect(res.body.map((item: { title: string }) => item.title)).toEqual(['Yjs guide'])
  })

  it('returns a list for an empty suggest query', async () => {
    const owner = await registerUser(app, 'suggest-empty')
    await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Recent', editorType: 'markdown' })
    const res = await request(app).get('/api/documents/suggest').set('Authorization', `Bearer ${owner.token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('requires authentication for tags and suggestions', async () => {
    expect((await request(app).get('/api/tags')).status).toBe(401)
    expect((await request(app).get('/api/documents/suggest')).status).toBe(401)
  })
})
