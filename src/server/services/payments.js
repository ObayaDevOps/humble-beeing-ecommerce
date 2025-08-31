// src/server/services/payments.js
import axios from 'axios'
import { submitPesapalOrder, getPesapalTransactionStatus } from '@/server/clients/pesapal'
import { mapPesapalStatus } from '@/server/services/statusMap'
import { PESAPAL_API_BASE_URL as PESAPAL_BASE_URL, PESAPAL_IPN_IDS, APP_BASE_URL } from '@/server/config/env'
import { 
  createPendingPayment,
  updatePaymentTrackingId,
  updatePaymentStatus,
  getPaymentByTrackingId,
} from '@/server/repositories/payments'
import { ensureOrderForCompletedPayment } from '@/server/services/orders'
import { markEventProcessed } from '@/server/repositories/idempotency'
import { withRetry } from '@/server/utils/retry'

export async function initiatePayment(payload, log) {
  const DEFAULT_IPN_ID = (PESAPAL_IPN_IDS || '').split(',')[0]?.trim()
  if (!DEFAULT_IPN_ID || !APP_BASE_URL) {
    log?.error?.('Missing required environment variables for payment initiation.')
    return { status: 500, body: { message: 'Server configuration error.' } }
  }

  const { amount, currency, description, billing_address, items } = payload
  if (!amount || typeof amount !== 'number' || amount <= 0) return { status: 400, body: { message: 'Invalid or missing amount.' } }
  if (!currency || typeof currency !== 'string' || currency.length !== 3) return { status: 400, body: { message: 'Invalid or missing currency code.' } }
  if (!description || typeof description !== 'string') return { status: 400, body: { message: 'Invalid or missing description.' } }
  const deliveryInfo = billing_address
  if (!deliveryInfo || (!deliveryInfo.email_address && !deliveryInfo.phone_number)) return { status: 400, body: { message: 'Billing/delivery address with email or phone number is required.' } }
  if (!items || !Array.isArray(items) || items.length === 0) return { status: 400, body: { message: 'Cart items are missing or invalid.' } }

  const merchantReference = `ORDER-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  const callbackUrl = `${APP_BASE_URL}/payment/callback`
  try {
    const dbPayment = await createPendingPayment({
      merchant_reference: merchantReference,
      amount: parseFloat(amount),
      currency,
      description,
      customer_email: deliveryInfo?.email_address,
      customer_phone: deliveryInfo?.phone_number,
      ipn_id_used: DEFAULT_IPN_ID,
      callback_url_used: callbackUrl,
      cart_items: items,
      deliveryDetails: deliveryInfo,
    })
    log?.info?.('Created pending payment record', { paymentId: dbPayment.id, merchantReference })

    const pesapalPayload = {
      id: merchantReference,
      currency,
      amount: parseFloat(amount),
      description,
      callback_url: callbackUrl,
      notification_id: DEFAULT_IPN_ID,
      billing_address: {
        email_address: deliveryInfo?.email_address || '',
        phone_number: deliveryInfo?.phone_number || '',
        first_name: deliveryInfo?.first_name || '',
        middle_name: deliveryInfo?.middle_name || '',
        last_name: deliveryInfo?.last_name || '',
        line_1: deliveryInfo?.line_1 || '',
        line_2: deliveryInfo?.line_2 || '',
        city: deliveryInfo?.city || '',
        state: deliveryInfo?.state || '',
        postal_code: deliveryInfo?.postal_code || '',
        zip_code: deliveryInfo?.zip_code || '',
        country_code: deliveryInfo?.country_code || '',
      },
    }

    log?.info?.('Submitting order to Pesapal', { merchantReference })
    const pesaResponse = await submitPesapalOrder(pesapalPayload)
    if (pesaResponse?.order_tracking_id && pesaResponse?.redirect_url) {
      await updatePaymentTrackingId(dbPayment.id, pesaResponse.order_tracking_id)
      log?.info?.('Updated payment with Pesapal tracking ID', { paymentId: dbPayment.id, trackingId: pesaResponse.order_tracking_id })
      return { status: 200, body: { redirectUrl: pesaResponse.redirect_url } }
    }
    throw new Error('Invalid response received from Pesapal after order submission.')
  } catch (error) {
    log?.error?.('Error during payment initiation', { error: error?.response?.data || error?.message })
    return { status: 500, body: { message: error.message || 'Failed to initiate payment.' } }
  }
}

export async function verifyPayment(orderTrackingId, log) {
  try {
    log?.info?.('Verifying payment status', { orderTrackingId })
    const pesapalData = await withRetry(() => getPesapalTransactionStatus(orderTrackingId), { retries: 2, delayMs: 100, factor: 2 })
    log?.info?.('Pesapal status response', { orderTrackingId, status_code: pesapalData?.status_code })

    if (pesapalData?.error?.code) {
      log?.error?.('Pesapal returned error for status check', { orderTrackingId, error: pesapalData.error })
      return { status: 502, body: { message: pesapalData.error.message || 'Failed to get transaction status from Pesapal.', pesapal_error_code: pesapalData.error.code } }
    }

    const statusCode = pesapalData.status_code
    const internalStatus = mapPesapalStatus(statusCode)
    const paymentMethod = pesapalData.payment_method
    const confirmationCode = pesapalData.confirmation_code
    const statusDescription = pesapalData.description

    log?.info?.('Updating DB payment status', { orderTrackingId, internalStatus })
    const updatedPayment = await updatePaymentStatus(
      orderTrackingId,
      internalStatus,
      paymentMethod,
      { confirmationCode, statusDescription }
    )
    const dbPaymentRecord = updatedPayment
    if (!dbPaymentRecord) {
      log?.error?.('Failed to retrieve or update payment record in DB', { orderTrackingId })
      return { status: 404, body: { message: 'Payment record not found or failed to update in our system after verification.', status: internalStatus, confirmationCode, statusDescription } }
    }

    if (internalStatus === 'COMPLETED') {
      try {
        await ensureOrderForCompletedPayment(dbPaymentRecord, log)
      } catch (e) {
        log?.error?.('Error during order creation/check process', { paymentId: dbPaymentRecord.id, error: e?.message })
      }
    }

    const responsePayload = {
      status: dbPaymentRecord.status,
      statusDescription: dbPaymentRecord.pesapal_status_description || statusDescription,
      confirmationCode: dbPaymentRecord.pesapal_confirmation_code || confirmationCode,
      orderDetails: {
        merchantReference: dbPaymentRecord.merchant_reference,
        totalAmount: dbPaymentRecord.amount,
        currency: dbPaymentRecord.currency,
        items: dbPaymentRecord.cart_items,
        delivery_address: dbPaymentRecord.delivery_address,
        customer_email: dbPaymentRecord.customer_email,
        customer_phone: dbPaymentRecord.customer_phone,
      },
    }
    try { await markEventProcessed('verify', orderTrackingId, 300) } catch {}
    log?.info?.('Verification success response sent', { orderTrackingId })
    return { status: 200, body: responsePayload }
  } catch (error) {
    const isPesapalWrappedError = typeof error?.message === 'string' && error.message.startsWith('Pesapal API Error during')
    const original = error?.originalError
    const axiosFromPesapal = (axios.isAxiosError(error) && error.response?.config?.url?.includes(PESAPAL_BASE_URL))
      || (axios.isAxiosError(original) && original.response?.config?.url?.includes(PESAPAL_BASE_URL))
    if (isPesapalWrappedError || axiosFromPesapal) {
      const pesapalCode = error?.response?.data?.error?.code || error?.originalError?.response?.data?.error?.code || undefined
      return { status: 502, body: { message: 'Failed to communicate with payment provider for status check.', pesapal_error_code: pesapalCode } }
    }
    if (error.message?.startsWith('Supabase') || error.message?.startsWith('Database error')) return { status: 500, body: { message: 'Internal server error during verification process.' } }
    return { status: 500, body: { message: error.message || 'An unexpected error occurred during payment verification.' } }
  }
}

export async function processIPN({ OrderTrackingId, OrderMerchantReference, OrderNotificationType }, log) {
  const existingPayment = await getPaymentByTrackingId(OrderTrackingId)
  if (existingPayment && ['COMPLETED', 'FAILED', 'REVERSED', 'INVALID'].includes(existingPayment.status)) {
    log?.info?.('IPN skipped: terminal state', { OrderTrackingId, status: existingPayment.status })
    return
  }
  log?.info?.('Querying Pesapal status', { OrderTrackingId })
  const statusResponse = await withRetry(() => getPesapalTransactionStatus(OrderTrackingId), { retries: 2, delayMs: 100, factor: 2 })
  if (statusResponse?.error?.code) {
    log?.error?.('IPN Error (Status Check)', { OrderTrackingId, error: statusResponse.error })
    return
  }
  const internalStatus = mapPesapalStatus(statusResponse.status_code)
  const confirmationCode = statusResponse.confirmation_code
  const statusDescription = statusResponse.payment_status_description
  const paymentMethod = statusResponse.payment_method
  const updatedPayment = await updatePaymentStatus(
    OrderTrackingId,
    internalStatus,
    paymentMethod,
    { confirmationCode, statusDescription }
  )
  if (!updatedPayment) {
    log?.warn?.('No DB record found for tracking ID', { OrderTrackingId })
    return
  }
  log?.info?.('DB status updated', { OrderTrackingId, internalStatus })
  if (internalStatus === 'COMPLETED') {
    try {
      await ensureOrderForCompletedPayment(updatedPayment, log)
    } catch (e) {
      log?.error?.('IPN post-completion order ensure failed', { paymentId: updatedPayment.id, error: e?.message })
    }
  }
  if (internalStatus === 'COMPLETED') {
    log?.info?.('IPN - Triggering post-completion actions', { OrderTrackingId, OrderMerchantReference })
    // Hook for future actions
  } else {
    log?.info?.('Payment not completed; no completion actions', { OrderTrackingId, internalStatus })
  }
  try { await markEventProcessed('ipn', OrderTrackingId, 300) } catch {}
}
