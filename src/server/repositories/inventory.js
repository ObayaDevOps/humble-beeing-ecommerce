// src/server/repositories/inventory.js
import { updateInventoryItem as _updateInventoryItem } from '@/lib/db'

export const updateInventoryItem = (sanityId, updates) => _updateInventoryItem(sanityId, updates)

