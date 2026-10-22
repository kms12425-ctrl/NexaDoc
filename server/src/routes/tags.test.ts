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
    expect((await request(app).get('/api/tags?q=ys').set('Authorization', `Bearer ${owner.token}`)).body).toEqual([{ tag: 'Yjs', count: 1 }])
  })

  it('suggests owned Markdown titles, preferring prefixes', async () => {
    const owner = await registerUser(app, 'suggest-owner')
    for (const name of ['Yjs guide', 'Learn Yjs', 'Yjs notes']) await request(app).post('/api/documents').set('Authorization', `Bearer ${owner.token}`).send({ name, editorType: 'markdown' })
    const res = await request(app).get('/api/documents/suggest?q=Yjs&limit=2').set('Authorization', `Bearer ${owner.token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body.every((item: { title: string; editorType: string }) => item.title.startsWith('Yjs') && item.editorType === 'markdown')).toBe(true)
  })
})
