// pages/api/payments/verify.js
import { getPesapalTransactionStatus } from '@/server/clients/pesapal';
import { getPaymentByTrackingId, updatePaymentStatus } from '@/server/repositories/payments';
import { findOrderExistsByPaymentId, createOrderAndItems } from '@/server/repositories/orders';
import axios from 'axios';
import { mapPesapalStatus } from '@/server/services/statusMap';
import { PESAPAL_API_BASE_URL as PESAPAL_BASE_URL } from '@/server/config/env';
import { ensureRequestId } from '@/server/utils/requestId';
import { createLogger } from '@/server/utils/logger';

export default async function handler(req, res) {
     if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { orderTrackingId } = req.body;

    if (!orderTrackingId) {
        return res.status(400).json({ message: 'Order Tracking ID is required.' });
    }

    try {
        const requestId = ensureRequestId(req, res);
        const log = createLogger({ requestId, route: 'api/payments/verify' });
        log.info(`Verifying payment status`, { orderTrackingId });

        // 1. Get Pesapal Token
        // 2. Call Pesapal GetTransactionStatus via client
        const pesapalData = await getPesapalTransactionStatus(orderTrackingId);
        log.info(`Pesapal status response`, { orderTrackingId, status_code: pesapalData?.status_code });

        // 3. Process Pesapal Response
        if (pesapalData?.error && pesapalData?.error.code) {
            log.error(`Pesapal returned error for status check`, { orderTrackingId, error: pesapalData.error });
            // Consider fetching DB record here to return *some* info? Or just fail.
             return res.status(502).json({ // Bad Gateway - Pesapal error
                 message: pesapalData.error.message || 'Failed to get transaction status from Pesapal.',
                 pesapal_error_code: pesapalData.error.code
             });
        }

        // Extract relevant data from Pesapal response
        const paymentStatus = pesapalData.payment_status_description;
        const paymentMethod = pesapalData.payment_method;
        const confirmationCode = pesapalData.confirmation_code;
        const statusDescription = pesapalData.description;
        const pesapalAmount = pesapalData.amount;
        const statusCode = pesapalData.status_code; // Assuming this field exists

        // Map Pesapal status to our internal status convention if needed
        const internalStatus = mapPesapalStatus(statusCode); // Use the helper

        // 4. Update your Database record status
        log.info(`Updating DB payment status`, { orderTrackingId, internalStatus });
        const updatedPayment = await updatePaymentStatus(
            orderTrackingId,
            internalStatus,
            paymentMethod,
            statusDescription
        );

        // 5. Fetch the *complete* payment record if update didn't return it or if needed again
        // If updatePaymentStatus returns the updated record, we might not need this separate fetch
        // const dbPaymentRecord = updatedPayment || await getPaymentByTrackingId(orderTrackingId);
        // Let's assume updatePaymentStatus returns the updated record as implemented in the provided db.js
        const dbPaymentRecord = updatedPayment;

        if (!dbPaymentRecord) {
            log.error(`Failed to retrieve or update payment record in DB`, { orderTrackingId });
             return res.status(404).json({
                message: 'Payment record not found or failed to update in our system after verification.',
                status: internalStatus,
                confirmationCode: confirmationCode,
                statusDescription: statusDescription,
            });
        }

        // *** START: Order Creation Logic ***
        // Only proceed if the payment is marked as COMPLETED
        if (internalStatus === 'COMPLETED') {
            log.info(`Payment verified COMPLETED, checking/creating order`, { orderTrackingId, paymentId: dbPaymentRecord.id });

            try {
                // 2. Check if an Order already exists for this payment_id
                const existingOrder = await findOrderExistsByPaymentId(dbPaymentRecord.id);

                if (!existingOrder) {
                    log.info(`No existing order found, creating new order`, { paymentId: dbPaymentRecord.id });

                    // 3 & 4. Create Order and Order Items
                    // We need cart_items, user_id (if available), addresses etc. from dbPaymentRecord
                    const orderData = {
                        payment_id: dbPaymentRecord.id,
                        user_id: dbPaymentRecord.user_id, // Assuming user_id is stored on payments
                        total_amount: dbPaymentRecord.amount,
                        currency: dbPaymentRecord.currency,
                        shipping_address: dbPaymentRecord.delivery_address, // Map field names
                        billing_address: dbPaymentRecord.billing_address || dbPaymentRecord.delivery_address, // Use delivery if no specific billing
                        customer_email: dbPaymentRecord.customer_email,
                        customer_phone: dbPaymentRecord.customer_phone,
                        status: 'COMPLETED', // Initial status for a new order
                    };

                    const itemsDataForRPC = dbPaymentRecord.cart_items.map(item => ({
                        product_id: item._id, // Map _id to product_id
                        quantity: item.quantity,
                        // Include other fields like price/name ONLY if the RPC *needs* them
                        // and doesn't fetch them itself. Based on the PL/pgSQL, it fetches price/name.
                    }));

                    log.debug('createOrderAndItems payload', { orderData, itemsDataForRPC });
                    const { data: newOrder, error: orderError } = await createOrderAndItems(orderData, itemsDataForRPC); // Pass mapped data

                    if (orderError) {
                        log.error(`Failed to create order/items`, { paymentId: dbPaymentRecord.id, error: orderError });
                        // Decide how critical this is. Should we still return success to the callback?
                        // Maybe log the error but don't fail the verification response?
                        // Or potentially try and set the payment status back to PENDING or NEEDS_ATTENTION?
                        // For now, log and continue, but flag this might need review.
                    } else {
                        log.info(`Successfully created order`, { orderId: newOrder.id, paymentId: dbPaymentRecord.id });
                        // 5. (Optional Step) Update Inventory Stock Levels
                        // await updateInventoryStock(itemsData); // Pass items to decrement counts
                    }

                } else {
                    log.info(`Order already exists; skipping creation`, { orderId: existingOrder.id, paymentId: dbPaymentRecord.id });
                }

            } catch (orderCreationError) {
                log.error(`Error during order creation/check process`, { paymentId: dbPaymentRecord.id, error: orderCreationError?.message });
                // Log this critical failure. Depending on policy, might need manual intervention.
            }
        }
        // *** END: Order Creation Logic ***

        // 6. Construct the response for the frontend (callback.js)
        const responsePayload = {
            status: dbPaymentRecord.status, // Use status from your DB
            statusDescription: dbPaymentRecord.pesapal_status_description || statusDescription, // Prefer DB description
            confirmationCode: dbPaymentRecord.pesapal_confirmation_code || confirmationCode, // Prefer DB code
            orderDetails: {
                merchantReference: dbPaymentRecord.merchant_reference,
                totalAmount: dbPaymentRecord.amount,
                currency: dbPaymentRecord.currency,
                items: dbPaymentRecord.cart_items,
                delivery_address: dbPaymentRecord.delivery_address,
                customer_email: dbPaymentRecord.customer_email,
                customer_phone: dbPaymentRecord.customer_phone,
            }
        };

        log.info(`Verification success response sent`, { orderTrackingId });
        res.status(200).json(responsePayload);

    } catch (error) {
        const requestId2 = req.__requestId;
        const log2 = createLogger({ requestId: requestId2, route: 'api/payments/verify' });
        log2.error(`Error verifying payment`, { orderTrackingId, error: error?.response?.data || error?.message });

         // Differentiate between Pesapal API errors and internal errors
         const isPesapalWrappedError = typeof error?.message === 'string' && error.message.startsWith('Pesapal API Error during');
         const original = error?.originalError;
         const axiosFromPesapal = (axios.isAxiosError(error) && error.response?.config?.url?.includes(PESAPAL_BASE_URL))
           || (axios.isAxiosError(original) && original.response?.config?.url?.includes(PESAPAL_BASE_URL));

         if (isPesapalWrappedError || axiosFromPesapal) {
             // Errors originating from Pesapal (transport or provider error)
             const pesapalCode = error?.response?.data?.error?.code
               || error?.originalError?.response?.data?.error?.code
               || undefined;
             return res.status(502).json({ message: 'Failed to communicate with payment provider for status check.', pesapal_error_code: pesapalCode });
         } else if (error.message.startsWith('Supabase') || error.message.startsWith('Database error')) { // Catch DB errors explicitly
            // Error interacting with our DB during payment update or order creation
            console.error("Database interaction error during verification:", error);
            return res.status(500).json({ message: 'Internal server error during verification process.' });
        } else {
            // Other unexpected errors
            console.error("Unexpected error during verification:", error);
            return res.status(500).json({ message: error.message || 'An unexpected error occurred during payment verification.' });
        }
    }
}
