// src/server/repositories/inventory.js
import { updateInventoryItem as _updateInventoryItem, updateInventoryStock as _updateInventoryStock } from '@/lib/db'

export const updateInventoryItem = (sanityId, updates) => _updateInventoryItem(sanityId, updates)
export const updateInventoryStock = (items) => _updateInventoryStock(items)
