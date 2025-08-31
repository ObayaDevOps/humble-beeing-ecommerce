// src/server/utils/rateLimit.js
// Simple in-memory rate limiter. Disabled unless RATE_LIMIT_ENABLED === '1'.

const buckets = new Map()

export function keyFromReq(req, label) {
  const xf = req?.headers?.['x-forwarded-for']
  const ip = Array.isArray(xf) ? xf[0] : (xf || req?.socket?.remoteAddress || 'unknown')
  return `${label}:${ip}`
}

export function rateLimit(key, { windowMs = 60_000, max = 30 } = {}) {
  if (process.env.RATE_LIMIT_ENABLED !== '1') return { allowed: true }
  const now = Date.now()
  const entry = buckets.get(key) || { count: 0, reset: now + windowMs }
  if (now > entry.reset) {
    entry.count = 0
    entry.reset = now + windowMs
  }
  entry.count += 1
  buckets.set(key, entry)
  if (entry.count > max) return { allowed: false, retryAfter: Math.ceil((entry.reset - now) / 1000) }
  return { allowed: true }
}
