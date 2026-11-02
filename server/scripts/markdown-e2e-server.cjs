// Isolated browser fixture: always creates its own temporary MongoDB.
const { MongoMemoryServer } = require('mongodb-memory-server')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const root = path.resolve(__dirname, '..')
const runtimeFile = path.join(root, 'test-results', 'markdown-live-runtime.json')
let mongo, child, control, uri
let stopping = false, restarting = false
let flags = { sharing: process.env.MARKDOWN_SHARING_ENABLED === 'true', collab: process.env.MARKDOWN_COLLAB_ENABLED === 'true' }
const controlToken = crypto.randomBytes(24).toString('hex')
async function stopChild() {
  if (!child || child.exitCode !== null) return
  const current = child
  const closed = new Promise((resolve) => current.once('exit', resolve))
  current.send('shutdown')
  const force = setTimeout(() => current.kill(), 9000)
  await closed; clearTimeout(force)
}
function startChild() {
  const current = spawn(process.execPath, ['dist/server.js'], {
    cwd: root, windowsHide: true, stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    env: { ...process.env, NODE_ENV: 'test', MONGO_URI: uri, DB_NAME: 'e2e_markdown_isolated',
      PORT: '3018', JWT_SECRET: 'isolated-markdown-e2e-only', CLIENT_ORIGIN: 'http://127.0.0.1:3018',
      CLIENT_DIST: path.resolve(root, '../client/playwright-report/a123/dist'),
      MARKDOWN_SHARING_ENABLED: String(flags.sharing), MARKDOWN_COLLAB_ENABLED: String(flags.collab),
    },
  })
  child = current
  current.once('error', (error) => { console.error(error); void stop(1) })
  current.once('exit', (code) => { if (!stopping && !restarting && child === current) void stop(code ?? 1) })
}
async function waitHealthy() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch('http://127.0.0.1:3018/health')).ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Fixture restart timed out')
}
async function stop(code = 0) {
  if (stopping) return
  stopping = true
  await stopChild()
  control?.close()
  if (mongo) await mongo.stop()
  fs.rmSync(runtimeFile, { force: true })
  process.exit(code)
}
async function main() {
  mongo = await MongoMemoryServer.create(); uri = mongo.getUri()
  fs.mkdirSync(path.dirname(runtimeFile), { recursive: true })
  fs.writeFileSync(runtimeFile, JSON.stringify({ uri, dbName: 'e2e_markdown_isolated', controlToken }))
  startChild()
  // Control exists only in the isolated test fixture, bound to loopback + random token.
  if (process.env.MARKDOWN_E2E_CONTROL === 'true') {
    control = http.createServer(async (req, res) => {
      if (req.method !== 'POST' || req.url !== '/restart' || req.headers['x-test-control'] !== controlToken) { res.writeHead(403).end(); return }
      if (restarting) { res.writeHead(409).end(); return }
      restarting = true
      try {
        let body = ''; for await (const chunk of req) body += chunk
        const next = JSON.parse(body)
        if (typeof next.sharing !== 'boolean' || typeof next.collab !== 'boolean') throw new Error('Invalid flags')
        await stopChild(); flags = next; startChild(); await waitHealthy()
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ status: 'ok' }))
      } catch (error) { res.writeHead(500).end(String(error)) }
      finally { restarting = false }
    }).listen(3019, '127.0.0.1')
  }
}
process.once('SIGINT', () => { void stop() })
process.once('SIGTERM', () => { void stop() })
main().catch((error) => { console.error(error); void stop(1) })
