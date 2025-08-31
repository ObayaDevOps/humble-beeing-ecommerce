// pages/api/payments/initiate.js
import { createPendingPayment, updatePaymentTrackingId } from '@/lib/db';
import { submitPesapalOrder } from '@/server/clients/pesapal';
import { PESAPAL_IPN_IDS, APP_BASE_URL } from '@/server/config/env';
import { ensureRequestId } from '@/server/utils/requestId';
import { createLogger } from '@/server/utils/logger';
// Optional: Import Supabase Auth helper if getting user ID server-side
// import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

const DEFAULT_IPN_ID = (PESAPAL_IPN_IDS || '').split(',')[0]?.trim();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // --- Configuration Checks ---
    const requestId = ensureRequestId(req, res);
    const log = createLogger({ requestId, route: 'api/payments/initiate' });
    if (!DEFAULT_IPN_ID || !APP_BASE_URL) {
        log.error("Missing required environment variables for payment initiation.");
        return res.status(500).json({ message: 'Server configuration error.' });
    }
    // --- End Configuration Checks ---

    let dbPayment; // To hold the created payment record

    try {
        const { amount, currency, description, billing_address, items } = req.body;

        // --- Input Validation (Basic Example) ---
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ message: 'Invalid or missing amount.' });
        }
        if (!currency || typeof currency !== 'string' || currency.length !== 3) {
            return res.status(400).json({ message: 'Invalid or missing currency code.' });
        }
        if (!description || typeof description !== 'string') {
            return res.status(400).json({ message: 'Invalid or missing description.' });
        }
        // Rename billing_address locally to deliveryInfo for clarity if desired, but keep receiving billing_address
        const deliveryInfo = billing_address;
        if (!deliveryInfo || (!deliveryInfo.email_address && !deliveryInfo.phone_number)) {
            return res.status(400).json({ message: 'Billing/delivery address with email or phone number is required.' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Cart items are missing or invalid.' });
        }
        // --- End Input Validation ---

        // --- Optional: Get User ID if using Supabase Auth ---
        // const supabaseAuthClient = createPagesServerClient({ req, res });
        // const { data: { session } } = await supabaseAuthClient.auth.getSession();
        // const userId = session?.user?.id;
        // --- End Optional User ID ---

        // 1. Generate your unique merchant reference
        const merchantReference = `ORDER-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        // 2. Construct callback URL
        const callbackUrl = `${APP_BASE_URL}/payment/callback`; // User returns here

        // 3. Create initial payment record in Supabase DB (Status: PENDING)
        // Use the imported Supabase function
        dbPayment = await createPendingPayment({
            // user_id: userId, // Pass if using auth
            merchant_reference: merchantReference,
            amount: parseFloat(amount), // Ensure it's a number
            currency,
            description,
            // Status default is handled in the function/DB
            customer_email: deliveryInfo?.email_address,
            customer_phone: deliveryInfo?.phone_number,
            ipn_id_used: DEFAULT_IPN_ID,
            callback_url_used: callbackUrl,
            cart_items: items,
            deliveryDetails: deliveryInfo,
        });
        log.info(`Created pending payment record`, { paymentId: dbPayment.id, merchantReference });

        // 4. Prepare payload for Pesapal
        const pesapalPayload = {
            id: merchantReference, // Use your unique reference
            currency,
            amount: parseFloat(amount),
            description,
            callback_url: callbackUrl,
            notification_id: DEFAULT_IPN_ID,
            billing_address: { // Pass along relevant details, ensure empty strings if null/undefined
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
                country_code: deliveryInfo?.country_code || ''
            },
        };

        // 5. Call Pesapal via client
        log.info(`Submitting order to Pesapal`, { merchantReference });
        const pesaResponse = await submitPesapalOrder(pesapalPayload);

        // 7. Handle Pesapal Response
        if (pesaResponse && pesaResponse.order_tracking_id && pesaResponse.redirect_url) {
            // 8. Update Supabase record with the pesapal_tracking_id
            // Use the imported Supabase function, pass the internal DB ID
            await updatePaymentTrackingId(dbPayment.id, pesaResponse.order_tracking_id);
            log.info(`Updated payment with Pesapal tracking ID`, { paymentId: dbPayment.id, trackingId: pesaResponse.order_tracking_id });

            // 9. Send redirect URL back to frontend
            res.status(200).json({ redirectUrl: pesaResponse.redirect_url });
        } else {
             log.error(`Invalid Pesapal SubmitOrder response`, { merchantReference, response: pesaResponse });
             throw new Error('Invalid response received from Pesapal after order submission.');
        }

    } catch (error) {
        const requestId = req.__requestId;
        const log = createLogger({ requestId, route: 'api/payments/initiate' });
        log.error("Error during payment initiation", { error: error?.response?.data || error?.message });
        // Optional: Update DB status to FAILED here if an error occurred after creation?
        // if (dbPayment?.id) {
        //     try { /* await updateStatusToFailed(dbPayment.id, error.message); */ } catch (dbErr) { /* log */ }
        // }
        res.status(500).json({ message: error.message || 'Failed to initiate payment.' });
    }
}
