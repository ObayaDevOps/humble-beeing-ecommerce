// src/server/utils/idempotency.js
// Lightweight in-memory idempotency helper with TTL per key.
// Note: Suitable for single-instance deployments and tests. For multi-instance
// environments, replace with a shared store (e.g., Redis) or DB table.

const store = new Map()

function now() {
  return Date.now()
}

export function isProcessed(key) {
  const entry = store.get(key)
  if (!entry) return false
  if (entry.expiresAt && entry.expiresAt < now()) {
    store.delete(key)
    return false
  }
  return true
}

export function markProcessed(key, ttlMs = 5 * 60 * 1000) {
  const expiresAt = ttlMs > 0 ? now() + ttlMs : undefined
  store.set(key, { expiresAt })
}

export async function withIdempotency(key, fn, ttlMs = 5 * 60 * 1000) {
  if (isProcessed(key)) return { skipped: true }
  const result = await fn()
  markProcessed(key, ttlMs)
  return { skipped: false, result }
}

// For tests: allow clearing state
export function __resetIdempotency() {
  store.clear()
}

