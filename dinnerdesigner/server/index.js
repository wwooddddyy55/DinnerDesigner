// Minimal dependency-free HTTP API backing cross-device sync. Persists a
// single JSON state blob to disk so every browser pointed at this add-on
// shares the same meal library and plans. Deliberately built on Node's
// built-in http/fs/path only — no npm install needed in the add-on's final
// (nginx) Docker stage, no added dependency surface.
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 8100
const HOST = '127.0.0.1'
const DATA_DIR = process.env.DINNERDESIGNER_DATA_DIR || '/data'
const STATE_FILE = path.join(DATA_DIR, 'state.json')
const TMP_FILE = `${STATE_FILE}.tmp`
const MAX_BODY_BYTES = 10 * 1024 * 1024

const EMPTY_STATE = { meals: [], plans: [], activePlanId: null, hasSeededMeals: false, updatedAt: 0 }

fs.mkdirSync(DATA_DIR, { recursive: true })

function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    if (err.code === 'ENOENT') return EMPTY_STATE
    throw err
  }
}

// Serializes writes so two near-simultaneous PUTs (two devices editing at
// once) can't interleave/torn-write the file. Last write still fully wins.
let writeQueue = Promise.resolve()

function writeState(payload) {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve, reject) => {
        try {
          fs.writeFileSync(TMP_FILE, JSON.stringify(payload))
          fs.renameSync(TMP_FILE, STATE_FILE)
          resolve()
        } catch (err) {
          reject(err)
        }
      }),
  )
  return writeQueue
}

function sendJson(res, statusCode, body) {
  const json = JSON.stringify(body)
  res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) })
  res.end(json)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0
    req.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 400 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (url.pathname !== '/api/state') {
    sendJson(res, 404, { error: 'not found' })
    return
  }

  if (req.method === 'GET') {
    sendJson(res, 200, readState())
    return
  }

  if (req.method === 'PUT') {
    let body
    try {
      body = await readBody(req)
    } catch (err) {
      sendJson(res, err.statusCode || 400, { error: err.message })
      return
    }

    let parsed
    try {
      parsed = JSON.parse(body)
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' })
      return
    }

    if (!Array.isArray(parsed.meals) || !Array.isArray(parsed.plans)) {
      sendJson(res, 400, { error: 'meals and plans must be arrays' })
      return
    }

    const updatedAt = Date.now()
    const payload = {
      meals: parsed.meals,
      plans: parsed.plans,
      activePlanId: parsed.activePlanId ?? null,
      hasSeededMeals: Boolean(parsed.hasSeededMeals),
      updatedAt,
    }

    try {
      await writeState(payload)
    } catch {
      sendJson(res, 500, { error: 'failed to persist state' })
      return
    }

    sendJson(res, 200, { updatedAt })
    return
  }

  sendJson(res, 405, { error: 'method not allowed' })
})

server.listen(PORT, HOST, () => {
  console.log(`DinnerDesigner sync API listening on ${HOST}:${PORT}, data dir ${DATA_DIR}`)
})
