import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import express from 'express'
import request from 'supertest'
import { register, login, requireAuth, type AuthRequest } from './auth'
import { getDB } from './db'

// auth.ts 在模块加载时读取 JWT_SECRET，此时 process.env 可能尚未被 setup.ts 设置
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

// 构建 Express app 用于 supertest
function createApp(): express.Express {
  const app = express()
  app.use(express.json())
  app.post('/api/auth/register', register)
  app.post('/api/auth/login', login)
  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.user })
  })
  return app
}

const app = createApp()
const COLORS = ['#4285f4', '#ea4335', '#34a853', '#fbbc04', '#ff6d00', '#aa00ff']

// ── register ────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('registers a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'pass123' })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('token')
    expect(res.body).toHaveProperty('user.id')
    expect(res.body.user.username).toBe('alice')
    expect(res.body.user.displayName).toBe('alice')
    expect(COLORS).toContain(res.body.user.avatarColor)

    // token 可解码
    const payload = jwt.verify(res.body.token, JWT_SECRET) as jwt.JwtPayload
    expect(payload.username).toBe('alice')
    expect(payload).toHaveProperty('id')
    expect(payload).toHaveProperty('avatarColor')
  })

  it('registers with email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', password: 'pass123', email: 'bob@test.com' })

    expect(res.status).toBe(201)

    // DB 中有 email
    const db = getDB()
    const user = await db.collection('users').findOne({ username: 'bob' })
    expect(user?.email).toBe('bob@test.com')
  })

  it('rejects missing username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'pass123' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Username and password/i)
  })

  it('rejects missing password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice' })

    expect(res.status).toBe(400)
  })

  it('rejects short username (< 2 chars)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a', password: 'pass123' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/at least 2 characters/i)
  })

  it('rejects short password (< 6 chars)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice2', password: '12345' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/at least 6 characters/i)
  })

  it('rejects duplicate username', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'dup', password: 'pass123' })

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'dup', password: 'pass123' })

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/already exists/i)
  })

  it('stores hashed password (not plaintext)', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'hashcheck', password: 'pass123' })

    const db = getDB()
    const user = await db.collection('users').findOne({ username: 'hashcheck' })
    expect(user?.passwordHash).not.toBe('pass123')
    expect(user?.passwordHash).toBeTruthy()
  })
})

// ── login ───────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'loginuser', password: 'pass123' })
  })

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loginuser', password: 'pass123' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user.username).toBe('loginuser')
  })

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loginuser', password: 'wrongpass' })

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/Invalid credentials/i)
  })

  it('rejects non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'pass123' })

    expect(res.status).toBe(401)
  })

  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({})

    expect(res.status).toBe(400)
  })
})

// ── requireAuth middleware ──────────────────────────────────────
describe('requireAuth middleware', () => {
  it('rejects request without authorization header', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/Authentication required/i)
  })

  it('rejects non-Bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Basic abc123')

    expect(res.status).toBe(401)
  })

  it('accepts valid token', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: 'authtest', password: 'pass123' })

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`)

    expect(res.status).toBe(200)
    expect(res.body.user.username).toBe('authtest')
    expect(res.body.user).toHaveProperty('id')
  })

  it('rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.jwt.token')

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/Invalid or expired/i)
  })

  it('rejects empty bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ')

    expect(res.status).toBe(401)
  })
})
