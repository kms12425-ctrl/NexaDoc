import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getDB } from './db'
import type { UserDoc } from './types'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const JWT_EXPIRES_IN = '7d'

export interface AuthRequest extends Request {
  user?: { id: string; username: string; displayName: string }
}

// ── 注册 ──
export async function register(req: Request, res: Response): Promise<void> {
  const { username, password, email } = req.body

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' })
    return
  }
  if (username.length < 2) {
    res.status(400).json({ error: 'Username must be at least 2 characters' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  const db = getDB()
  const existing = await db.collection<UserDoc>('users').findOne({ username })
  if (existing) {
    res.status(409).json({ error: 'Username already exists' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const colors = ['#4285f4', '#ea4335', '#34a853', '#fbbc04', '#ff6d00', '#aa00ff']
  const avatarColor = colors[Math.floor(Math.random() * colors.length)]
  const now = new Date()
  const result = await db.collection<UserDoc>('users').insertOne({
    username,
    ...(email ? { email } : {}),
    passwordHash,
    displayName: username,
    avatarColor,
    createdAt: now,
    updatedAt: now,
  })

  const token = jwt.sign(
    { id: result.insertedId.toString(), username, avatarColor },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )

  res.status(201).json({
    token,
    user: {
      id: result.insertedId.toString(),
      username,
      displayName: username,
      avatarColor,
    },
  })
}

// ── 登录 ──
export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' })
    return
  }

  const db = getDB()
  const user = await db.collection<UserDoc>('users').findOne({ username })
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const token = jwt.sign(
    { id: user._id!.toString(), username: user.username, avatarColor: user.avatarColor },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )

  res.json({
    token,
    user: {
      id: user._id!.toString(),
      username: user.username,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
    },
  })
}

// ── JWT 验证中间件 ──
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as {
      id: string
      username: string
    }
    req.user = {
      id: payload.id,
      username: payload.username,
      displayName: payload.username,
    }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
