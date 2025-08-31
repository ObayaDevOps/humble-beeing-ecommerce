// src/server/utils/retry.js

export async function withRetry(fn, { retries = 2, delayMs = 100, factor = 2 } = {}) {
  let attempt = 0
  let lastError
  while (attempt <= retries) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (attempt === retries) break
      await new Promise(r => setTimeout(r, delayMs))
      delayMs *= factor
      attempt += 1
    }
  }
  throw lastError
}

