// src/server/repositories/payments.js
// Thin repository layer wrapping legacy db helpers while we migrate.
import {
  createPendingPayment as _createPendingPayment,
  updatePaymentTrackingId as _updatePaymentTrackingId,
  updatePaymentStatus as _updatePaymentStatus,
  getPaymentByTrackingId as _getPaymentByTrackingId,
} from '@/lib/db'

export const createPendingPayment = (data) => _createPendingPayment(data)
export const updatePaymentTrackingId = (id, tracking) => _updatePaymentTrackingId(id, tracking)
// New options-object signature for clarity and type-safety in callers.
// updatePaymentStatus(trackingId, status, method, { confirmationCode, statusDescription })
export const updatePaymentStatus = (
  trackingId,
  status,
  method,
  { confirmationCode, statusDescription } = {}
) => {
  return _updatePaymentStatus(
    trackingId,
    status,
    method,
    confirmationCode,
    statusDescription
  )
}
export const getPaymentByTrackingId = (trackingId) => _getPaymentByTrackingId(trackingId)
