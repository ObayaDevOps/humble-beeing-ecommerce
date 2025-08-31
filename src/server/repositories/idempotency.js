// src/server/repositories/idempotency.js
import { markEventProcessed as _markEventProcessed } from '@/lib/db'

export const markEventProcessed = (eventType, trackingId, ttlSeconds = 300) => _markEventProcessed(eventType, trackingId, ttlSeconds)

