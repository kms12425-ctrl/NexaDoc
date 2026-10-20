// Isolated live-browser fixture. Never uses MONGO_URI/DB_NAME from the developer's environment.
const { MongoMemoryServer } = require('mongodb-memory-server')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const runtimeFile = path.join(root, 'test-results', 'markdown-live-runtime.json')
let mongo
let child
let stopping = false

async function stop(code = 0) {
  if (stopping) return
  stopping = true
  if (child && child.exitCode === null) {
    const closed = new Promise((resolve) => child.once('exit', resolve))
    child.kill()
    await closed
  }
  if (mongo) await mongo.stop()
  fs.rmSync(runtimeFile, { force: true })
  process.exit(code)
}

async function main() {
  mongo = await MongoMemoryServer.create()
  const uri = mongo.getUri()
  const dbName = 'e2e_markdown_isolated'
  fs.mkdirSync(path.dirname(runtimeFile), { recursive: true })
  fs.writeFileSync(runtimeFile, JSON.stringify({ uri, dbName }))
  child = spawn(process.execPath, ['dist/server.js'], {
    cwd: root,
    windowsHide: true,
    stdio: 'inherit',
    env: {
      ...process.env, MONGO_URI: uri, DB_NAME: dbName,
      PORT: '3018', JWT_SECRET: 'isolated-markdown-e2e-only',
      CLIENT_ORIGIN: 'http://127.0.0.1:3018',
      CLIENT_DIST: path.resolve(root, '../client/playwright-report/a123/dist'),
    },
  })
  child.once('error', (error) => { console.error(error); void stop(1) })
  child.once('exit', (code) => { if (!stopping) void stop(code ?? 1) })
}

process.once('SIGINT', () => { void stop() })
process.once('SIGTERM', () => { void stop() })
main().catch((error) => { console.error(error); void stop(1) })
