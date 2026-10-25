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
const BACKUP_DIR = path.join(DATA_DIR, 'backups')
const MAX_BACKUPS = 50
const MIN_BACKUP_INTERVAL_MS = 60 * 1000
const MAX_BODY_BYTES = 10 * 1024 * 1024

const EMPTY_STATE = { meals: [], plans: [], activePlanId: null, hasSeededMeals: false, updatedAt: 0 }

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.mkdirSync(BACKUP_DIR, { recursive: true })

process.on('uncaughtException', (err) => console.error('Uncaught exception:', err))
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err))

/** Newest-first list of backup file paths. Names embed a zero-padded
 * timestamp, so lexical order is chronological. */
function listBackups() {
  try {
    return fs
      .readdirSync(BACKUP_DIR)
      .filter((name) => name.startsWith('state-') && name.endsWith('.json'))
      .sort()
      .reverse()
      .map((name) => path.join(BACKUP_DIR, name))
  } catch {
    return []
  }
}

function parseStateFile(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.meals) || !Array.isArray(parsed.plans)) {
    throw new Error(`${file} is not a valid state file`)
  }
  return parsed
}

/** Loads state from disk once at startup. A corrupt/truncated state.json is
 * moved aside (never deleted) and the newest readable backup is used instead,
 * so one bad write can never take the backend down or silently reset data. */
function loadInitialState() {
  if (!fs.existsSync(STATE_FILE)) return EMPTY_STATE
  try {
    return parseStateFile(STATE_FILE)
  } catch (err) {
    const quarantined = `${STATE_FILE}.corrupt-${Date.now()}`
    console.error(`state.json unreadable (${err.message}); moved to ${quarantined}`)
    try {
      fs.renameSync(STATE_FILE, quarantined)
    } catch (renameErr) {
      console.error('Could not move corrupt state.json aside:', renameErr)
    }
    for (const backup of listBackups()) {
      try {
        const restored = parseStateFile(backup)
        console.error(`Restored state from backup ${backup}`)
        return restored
      } catch {
        // try the next-oldest backup
      }
    }
    console.error('No readable backup found; starting from empty state')
    return EMPTY_STATE
  }
}

// Served from memory; disk is only written on PUT.
let currentState = loadInitialState()

let lastBackupAt = 0

/** Snapshots the just-written state into the rolling backup set, at most
 * once per MIN_BACKUP_INTERVAL_MS (every edit is pushed, so unthrottled
 * backups would only cover the last few minutes), keeping the newest
 * MAX_BACKUPS. Makes an accidental (or malicious — the direct port has no
 * login) wipe recoverable, and gives `loadInitialState` something recent to
 * fall back to if state.json is ever unreadable. */
function backupCurrentFile() {
  if (!fs.existsSync(STATE_FILE)) return
  if (Date.now() - lastBackupAt < MIN_BACKUP_INTERVAL_MS) return
  lastBackupAt = Date.now()
  const stamp = String(Date.now()).padStart(15, '0')
  fs.copyFileSync(STATE_FILE, path.join(BACKUP_DIR, `state-${stamp}.json`))
  for (const old of listBackups().slice(MAX_BACKUPS)) {
    try {
      fs.unlinkSync(old)
    } catch {
      // best effort
    }
  }
}

function writeStateFile(payload) {
  const fd = fs.openSync(TMP_FILE, 'w')
  try {
    fs.writeFileSync(fd, JSON.stringify(payload))
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
  fs.renameSync(TMP_FILE, STATE_FILE)
  try {
    backupCurrentFile()
  } catch (err) {
    // A failed backup must not fail a write that already succeeded.
    console.error('Backup failed:', err)
  }
}

// Serializes writes so two near-simultaneous PUTs (two devices editing at
// once) can't interleave/torn-write the file. The chain itself always
// resolves, so one failed write (disk full, EIO) only fails that one PUT
// instead of poisoning every later one.
let writeQueue = Promise.resolve()

function enqueue(task) {
  const result = writeQueue.then(task)
  writeQueue = result.catch(() => {})
  return result
}

// `currentState` serialized, rebuilt only after it changes rather than on
// every GET (each device polls every 30s).
let cachedStateJson = null
let cachedStateFor = null

function currentStateJson() {
  if (cachedStateFor !== currentState) {
    cachedStateJson = JSON.stringify(currentState)
    cachedStateFor = currentState
  }
  return cachedStateJson
}

function sendJson(res, statusCode, body) {
  sendRawJson(res, statusCode, JSON.stringify(body))
}

function sendRawJson(res, statusCode, json) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
  })
  res.end(json)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0
    req.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Structural check only — every element must be an object with a string id.
 * Field-level normalization happens client-side (normalizeAppData in
 * src/lib/migrations.ts). */
function validatePayload(parsed) {
  if (!isPlainObject(parsed)) return 'body must be a JSON object'
  if (!Array.isArray(parsed.meals) || !Array.isArray(parsed.plans)) return 'meals and plans must be arrays'
  for (const list of [parsed.meals, parsed.plans]) {
    if (!list.every((item) => isPlainObject(item) && typeof item.id === 'string')) {
      return 'every meal and plan must be an object with a string id'
    }
  }
  if (parsed.baseUpdatedAt !== undefined && typeof parsed.baseUpdatedAt !== 'number') {
    return 'baseUpdatedAt must be a number'
  }
  return null
}

async function handlePut(req, res) {
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

  const invalid = validatePayload(parsed)
  if (invalid) {
    sendJson(res, 400, { error: invalid })
    return
  }

  try {
    await enqueue(() => {
      // Optimistic concurrency: a client must say which server version its
      // edits are based on. If someone else has written since, reject so the
      // client re-pulls and merges instead of overwriting their changes.
      if (parsed.baseUpdatedAt !== undefined && parsed.baseUpdatedAt !== currentState.updatedAt) {
        throw Object.assign(new Error('conflict'), { statusCode: 409 })
      }
      // Strictly increasing even if two writes land in the same millisecond.
      const updatedAt = Math.max(Date.now(), currentState.updatedAt + 1)
      const payload = {
        schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : undefined,
        meals: parsed.meals,
        plans: parsed.plans,
        activePlanId: typeof parsed.activePlanId === 'string' ? parsed.activePlanId : null,
        hasSeededMeals: Boolean(parsed.hasSeededMeals),
        updatedAt,
      }
      writeStateFile(payload)
      currentState = payload
    })
  } catch (err) {
    if (err.statusCode === 409) {
      sendJson(res, 409, { error: 'conflict', state: currentState })
      return
    }
    console.error('Failed to persist state:', err)
    sendJson(res, 500, { error: 'failed to persist state' })
    return
  }

  sendJson(res, 200, { updatedAt: currentState.updatedAt })
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')

    if (url.pathname !== '/api/state') {
      sendJson(res, 404, { error: 'not found' })
      return
    }

    if (req.method === 'GET') {
      // `?since=<updatedAt>`: the client's polled version. When nothing has
      // changed, skip serializing and sending the whole (possibly MBs) state.
      const since = Number(url.searchParams.get('since'))
      if (since > 0 && since === currentState.updatedAt) {
        sendJson(res, 200, { updatedAt: currentState.updatedAt, unchanged: true })
        return
      }
      sendRawJson(res, 200, currentStateJson())
      return
    }

    if (req.method === 'PUT') {
      await handlePut(req, res)
      return
    }

    sendJson(res, 405, { error: 'method not allowed' })
  } catch (err) {
    console.error('Request failed:', err)
    if (!res.headersSent) sendJson(res, 500, { error: 'internal error' })
    else res.end()
  }
})

server.listen(PORT, HOST, () => {
  console.log(`DinnerDesigner sync API listening on ${HOST}:${PORT}, data dir ${DATA_DIR}`)
})

function shutdown() {
  // Let any in-flight write finish before exiting.
  server.close()
  writeQueue.finally(() => process.exit(0))
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
