// src/server/utils/auth.js

function extractBearer(req) {
  const h = req.headers?.authorization || ''
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7)
  return null
}

export function requireAdmin(req) {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) return { ok: true }
  const headerToken = req.headers?.['x-admin-token']
  const bearer = extractBearer(req)
  const provided = headerToken || bearer
  if (!provided || provided !== expected) {
    return { ok: false, status: 401, body: { message: 'Unauthorized' } }
  }
  return { ok: true }
}

