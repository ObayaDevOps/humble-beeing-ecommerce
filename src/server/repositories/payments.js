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
// Supports legacy 4-arg calls (tid,status,method,desc) from verify handler tests
// and 5-arg calls (tid,status,method,confirmationCode,desc) for production code.
export const updatePaymentStatus = (trackingId, status, method, arg4, arg5) => {
  if (typeof arg5 !== 'undefined') {
    return _updatePaymentStatus(trackingId, status, method, arg4, arg5)
  }
  // If underlying impl expects 5 params, treat arg4 as statusDescription and leave confirmationCode undefined
  if (_updatePaymentStatus.length >= 5) {
    return _updatePaymentStatus(trackingId, status, method, undefined, arg4)
  }
  // Fall back to 4-arg signature
  return _updatePaymentStatus(trackingId, status, method, arg4)
}
export const getPaymentByTrackingId = (trackingId) => _getPaymentByTrackingId(trackingId)
