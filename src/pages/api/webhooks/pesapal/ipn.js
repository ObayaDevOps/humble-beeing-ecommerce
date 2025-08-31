// pages/api/webhooks/pesapal/ipn.js
import { ensureRequestId } from '@/server/utils/requestId'
import { createLogger } from '@/server/utils/logger'
import { processIPN } from '@/server/services/payments'
import { rateLimit, keyFromReq } from '@/server/utils/rateLimit'

// --- Main IPN Handler ---
export default async function handler(req, res) {
    const rl = rateLimit(keyFromReq(req, 'ipn'), { windowMs: 60_000, max: 60 })
    if (!rl.allowed) return res.status(429).json({ status: 429, message: 'Too many IPN requests' })
    const requestId = ensureRequestId(req, res);
    const log = createLogger({ requestId, route: 'api/webhooks/pesapal/ipn' });
    log.info(`IPN Received`, { method: req.method });

    // Pesapal IPN v3 seems to use GET with query parameters based on docs
    const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = req.query;

    log.info(`IPN Data`, { OrderTrackingId, OrderMerchantReference, OrderNotificationType });

    // --- Basic Validation ---
    if (!OrderTrackingId || !OrderMerchantReference || !OrderNotificationType) {
         log.error("IPN Error: Missing required parameters in query.", { query: req.query });
         // Still acknowledge receipt if possible, but indicate an issue
         return res.status(200).json({ // Use 200 OK for ACK, but signal error in payload if possible
             orderNotificationType: OrderNotificationType || 'UNKNOWN',
             orderTrackingId: OrderTrackingId || 'UNKNOWN',
             orderMerchantReference: OrderMerchantReference || 'UNKNOWN',
             status: 500, // Or a custom code indicating processing error
             message: "IPN received but missing required parameters."
         });
    }
    // --- End Basic Validation ---


    // 1. Acknowledge Pesapal IMMEDIATELY
    // IMPORTANT: Send this response before starting heavy processing.
    res.status(200).json({
        orderNotificationType: OrderNotificationType,
        orderTrackingId: OrderTrackingId,
        orderMerchantReference: OrderMerchantReference,
        status: 200 // Acknowledge successful receipt
    });

    // 2. Process Asynchronously (after sending response)
    // Use setImmediate for non-blocking execution in Node.js event loop
    // For production, consider a proper background job queue (e.g., BullMQ, Celery if using Python backend, etc.)
    setImmediate(async () => {
      log.info('Starting async processing', { OrderTrackingId })
      try {
        await processIPN({ OrderTrackingId, OrderMerchantReference, OrderNotificationType }, log)
      } catch (error) {
        log.error('IPN Async Processing Error', { OrderTrackingId, error: error?.response?.data || error?.message })
      }
    })

} // End handler
