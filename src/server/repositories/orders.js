// src/server/repositories/orders.js
import {
  findOrderExistsByPaymentId as _findOrderExistsByPaymentId,
  createOrderAndItems as _createOrderAndItems,
  getSalesDataForReport as _getSalesDataForReport,
} from '@/lib/db'

export const findOrderExistsByPaymentId = (paymentId) => _findOrderExistsByPaymentId(paymentId)
export const createOrderAndItems = (orderData, items) => _createOrderAndItems(orderData, items)
export const getSalesDataForReport = (opts = {}) => _getSalesDataForReport(opts)

