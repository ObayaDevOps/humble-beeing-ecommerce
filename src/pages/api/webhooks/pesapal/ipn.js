// pages/api/webhooks/pesapal/ipn.js
import { getPesapalTransactionStatus } from '@/server/clients/pesapal';
import { getPaymentByTrackingId, updatePaymentStatus } from '@/lib/db';
import { mapPesapalStatus } from '@/server/services/statusMap';
import { ensureRequestId } from '@/server/utils/requestId';
import { createLogger } from '@/server/utils/logger';

// --- Main IPN Handler ---
export default async function handler(req, res) {
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
        log.info(`Starting async processing`, { OrderTrackingId });
        try {
            // Optional: Check if already processed to prevent redundant updates?
            const existingPayment = await getPaymentByTrackingId(OrderTrackingId);
            // Add robust check: Only skip if status is definitively terminal (COMPLETED, FAILED, REVERSED)
            if (existingPayment && ['COMPLETED', 'FAILED', 'REVERSED', 'INVALID'].includes(existingPayment.status)) {
               log.info(`IPN skipped: terminal state`, { OrderTrackingId, status: existingPayment.status });
               return; // Stop processing
            }

            // Query Pesapal for the definitive status
            log.info(`Querying Pesapal status`, { OrderTrackingId });
            const statusResponse = await getPesapalTransactionStatus(OrderTrackingId);

             // Handle Pesapal API Error during IPN processing
             if (statusResponse?.error?.code) {
                 log.error(`IPN Error (Status Check)`, { OrderTrackingId, error: statusResponse.error });
                 // Log error, potentially retry later? Do not proceed with DB update.
                 return;
             }

             // Map status and prepare data
             const pesapalStatusCode = statusResponse.status_code;
             const internalStatus = mapPesapalStatus(pesapalStatusCode);
             const confirmationCode = statusResponse.confirmation_code;
             const statusDescription = statusResponse.payment_status_description;
             const paymentMethod = statusResponse.payment_method;

             console.log(`IPN - Pesapal status for ${OrderTrackingId}: Code=${pesapalStatusCode}, Internal=${internalStatus}, ConfCode=${confirmationCode}`);

             // Update Supabase DB record - THIS IS THE CRITICAL STEP for IPN
             // Use the imported Supabase function
             const updatedPayment = await updatePaymentStatus(
                 OrderTrackingId, // Find record using Pesapal's tracking ID
                 internalStatus,
                 paymentMethod,
                 confirmationCode,
                 statusDescription
             );

             if (!updatedPayment) {
                 log.warn(`No DB record found for tracking ID`, { OrderTrackingId });
                 // Log this, might indicate a race condition or issue in initiate step
             } else {
                log.info(`DB status updated`, { OrderTrackingId, internalStatus });

                // --- Trigger Post-Payment Actions ONLY on Successful Update & COMPLETED Status ---
                if (internalStatus === 'COMPLETED') {
                    console.log(`IPN - Triggering post-completion actions for ${OrderTrackingId} (Merchant Ref: ${OrderMerchantReference})`);

                    // Add your business logic here:
                    // - Grant user access (fetch user ID from updatedPayment if needed)
                    // await grantUserAccess(updatedPayment.user_id);
                    // - Fulfill order / trigger shipping
                    // await fulfillOrder(OrderMerchantReference); // Use your reference ID
                    // - Send confirmation email
                    // await sendPaymentConfirmationEmail(updatedPayment.customer_email, OrderMerchantReference, updatedPayment.amount);

                    // Handle RECURRING specific logic if needed
                    if (OrderNotificationType === 'RECURRING') {
                        log.info(`Processing RECURRING logic`, { OrderTrackingId });
                        // Maybe update subscription status, log recurring payment specifically
                    }
                } else {
                     log.info(`Payment not completed; no completion actions`, { OrderTrackingId, internalStatus });
                     // Handle FAILED/REVERSED cases if needed (e.g., send notification)
                }
                // --- End Post-Payment Actions ---
             }

        } catch (error) {
            log.error(`IPN Async Processing Error`, { OrderTrackingId, error: error?.response?.data || error?.message });
            // Implement monitoring/alerting for failed IPN processing
            // Consider adding retry logic with exponential backoff for transient errors (network, Pesapal API down)
        }
    }); // End setImmediate

} // End handler
