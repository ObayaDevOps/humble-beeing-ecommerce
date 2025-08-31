// src/server/services/orders.js
import { findOrderExistsByPaymentId, createOrderAndItemsAtomic } from '@/server/repositories/orders'

export async function ensureOrderForCompletedPayment(dbPaymentRecord, log) {
  const existing = await findOrderExistsByPaymentId(dbPaymentRecord.id)
  if (existing) {
    log?.info?.('Order already exists; skipping creation', { orderId: existing.id, paymentId: dbPaymentRecord.id })
    return { existed: true, order: existing }
  }

  log?.info?.('No existing order found, creating new order', { paymentId: dbPaymentRecord.id })
  const orderData = {
    payment_id: dbPaymentRecord.id,
    user_id: dbPaymentRecord.user_id,
    total_amount: dbPaymentRecord.amount,
    currency: dbPaymentRecord.currency,
    shipping_address: dbPaymentRecord.delivery_address,
    billing_address: dbPaymentRecord.billing_address || dbPaymentRecord.delivery_address,
    customer_email: dbPaymentRecord.customer_email,
    customer_phone: dbPaymentRecord.customer_phone,
    status: 'COMPLETED',
  }
  const itemsDataForRPC = (dbPaymentRecord.cart_items || []).map((it) => ({ product_id: it._id, quantity: it.quantity }))
  log?.debug?.('createOrderAndItems payload', { orderData, itemsDataForRPC })
  const { data, error } = await createOrderAndItemsAtomic(orderData, itemsDataForRPC)
  if (error) {
    log?.error?.('Failed to create order/items', { paymentId: dbPaymentRecord.id, error })
    return { existed: false, order: null, error }
  }
  log?.info?.('Successfully created order', { orderId: data.id, paymentId: dbPaymentRecord.id })
  return { existed: false, order: data }
}
