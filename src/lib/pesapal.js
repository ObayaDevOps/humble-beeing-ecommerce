// lib/pesapal.js
import axios from 'axios';
import {
  PESAPAL_API_BASE_URL,
  PESAPAL_CONSUMER_KEY,
  PESAPAL_CONSUMER_SECRET,
} from '@/server/config/env';

// --- Helper Functions ---

/**
 * Checks if essential Pesapal environment variables are set.
 * Throws an error if any are missing.
 */
const checkPesapalConfig = () => {
  if (!PESAPAL_API_BASE_URL || !PESAPAL_CONSUMER_KEY || !PESAPAL_CONSUMER_SECRET) {
    console.error(
      'Pesapal Configuration Error: Missing one or more required environment variables (PESAPAL_API_BASE_URL, PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET)'
    );
    throw new Error('Server configuration error: Pesapal credentials or API URL missing.');
  }
};

/**
 * Creates a standardized error object from Axios or Pesapal errors.
 * @param {Error} error - The original error object.
 * @param {string} context - Description of the operation being performed.
 * @returns {Error} A new Error object with context and potentially Pesapal error details.
 */
const formatPesapalError = (error, context) => {
    let message = `Pesapal API Error during ${context}: `;
    let statusCode = 500; // Default internal server error

    if (axios.isAxiosError(error)) {
        statusCode = error.response?.status || 500;
        const pesapalError = error.response?.data?.error;
        const pesapalMessage = error.response?.data?.message; // Some endpoints use 'message' at top level on error

        if (pesapalError && pesapalError.code && pesapalError.message) {
            message += `Code [${pesapalError.code}] - ${pesapalError.message}`;
        } else if (pesapalMessage) {
             message += `${pesapalMessage}`;
        }
         else if (error.response?.data) {
            // Include generic data if specific error format not found
            try {
                message += `Status ${statusCode}. Response: ${JSON.stringify(error.response.data)}`;
            } catch (_) {
                message += `Status ${statusCode}. Unparseable response.`;
            }
        } else if (error.request) {
            message += 'No response received from Pesapal.';
            statusCode = 504; // Gateway Timeout might be appropriate
        } else {
            message += error.message;
        }
    } else {
        // Non-Axios error
        message += error.message;
    }

    console.error(message, { originalError: error }); // Log the detailed error server-side
    const customError = new Error(message);
    customError.statusCode = statusCode; // Add statusCode for potential use in API responses
    customError.originalError = error; // Keep reference if needed
    return customError;
};


// --- Core API Functions ---

/**
 * Fetches a short-lived authentication token from Pesapal.
 * @returns {Promise<string>} The bearer token.
 * @throws {Error} If token retrieval fails.
 */
export async function getPesapalToken() {
    checkPesapalConfig();
    const context = 'Authentication (RequestToken)';
    console.log(`[Pesapal Lib] ${context} - Initiating...`);

    try {
        const response = await axios.post(
            `${PESAPAL_API_BASE_URL}/Auth/RequestToken`,
            {
                consumer_key: PESAPAL_CONSUMER_KEY,
                consumer_secret: PESAPAL_CONSUMER_SECRET,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                timeout: 10000, // 10 second timeout for auth
            }
        );

        if (response.data && response.data.token) {
            console.log(`[Pesapal Lib] ${context} - Success.`);
            return response.data.token;
        } else {
             const errorMsg = response.data?.error?.message || 'Unknown error structure';
             throw new Error(`Token retrieval failed: ${errorMsg}`);
        }
    } catch (error) {
        throw formatPesapalError(error, context);
    }
}

/**
 * Submits an order request to Pesapal to initiate payment.
 * @param {object} orderPayload - The order details.
 * @param {string} orderPayload.id - Your unique merchant reference ID.
 * @param {string} orderPayload.currency - ISO currency code (e.g., 'KES').
 * @param {number} orderPayload.amount - The amount to charge.
 * @param {string} orderPayload.description - Brief description of the order.
 * @param {string} orderPayload.callback_url - URL Pesapal redirects user to after payment attempt.
 * @param {string} orderPayload.notification_id - Your registered IPN ID.
 * @param {object} orderPayload.billing_address - Customer billing details.
 * @param {string} [orderPayload.cancellation_url] - Optional URL for user cancellation.
 * @param {string} [orderPayload.account_number] - Optional for recurring payments setup.
 * @param {object} [orderPayload.subscription_details] - Optional recurring details.
 * @returns {Promise<{order_tracking_id: string, merchant_reference: string, redirect_url: string}>} Object containing Pesapal tracking ID, your reference, and the redirect URL.
 * @throws {Error} If order submission fails.
 */
export async function submitPesapalOrder(orderPayload) {
    checkPesapalConfig();
    const context = 'Submit Order Request';
    console.log(`[Pesapal Lib] ${context} - Initiating for merchant ref: ${orderPayload?.id}...`);

    if (!orderPayload || !orderPayload.id || !orderPayload.currency || orderPayload.amount == null || !orderPayload.description || !orderPayload.callback_url || !orderPayload.notification_id || !orderPayload.billing_address) {
        throw new Error(`[Pesapal Lib] ${context} - Invalid order payload. Missing required fields.`);
    }

    try {
        const token = await getPesapalToken();
        console.log(`[Pesapal Lib] ${context} - Got token, submitting order...`);

        const response = await axios.post(
            `${PESAPAL_API_BASE_URL}/Transactions/SubmitOrderRequest`,
            orderPayload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                 timeout: 15000, // 15 second timeout
            }
        );

        if (response.data && response.data.error) {
             console.error(`[Pesapal Lib] ${context} - Pesapal returned error object:`, response.data.error);
             throw new Error(`Pesapal rejected order: ${response.data.error.code} - ${response.data.error.message}`);
        }

        if (response.data && response.data.order_tracking_id && response.data.redirect_url) {
            console.log(`[Pesapal Lib] ${context} - Success for merchant ref: ${orderPayload.id}. Tracking ID: ${response.data.order_tracking_id}`);
            return {
                order_tracking_id: response.data.order_tracking_id,
                merchant_reference: response.data.merchant_reference,
                redirect_url: response.data.redirect_url,
            };
        } else {
             console.error(`[Pesapal Lib] ${context} - Unexpected response structure:`, response.data);
             throw new Error('Order submission failed: Invalid response structure from Pesapal.');
        }
    } catch (error) {
        if (error.message.startsWith('Pesapal API Error')) throw error;
        throw formatPesapalError(error, context);
    }
}

/**
 * Gets the transaction status from Pesapal using the Order Tracking ID.
 * @param {string} orderTrackingId - The unique order ID generated by Pesapal.
 * @returns {Promise<object>} The full transaction status object from Pesapal.
 * @throws {Error} If fetching status fails.
 */
export async function getPesapalTransactionStatus(orderTrackingId) {
    checkPesapalConfig();
    const context = 'Get Transaction Status';
     console.log(`[Pesapal Lib] ${context} - Initiating for Tracking ID: ${orderTrackingId}...`);


    if (!orderTrackingId) {
        throw new Error(`[Pesapal Lib] ${context} - Missing required parameter: orderTrackingId.`);
    }

    try {
        const token = await getPesapalToken();
        console.log(`[Pesapal Lib] ${context} - Got token, fetching status...`);

        const response = await axios.get(
            `${PESAPAL_API_BASE_URL}/Transactions/GetTransactionStatus`,
            {
                params: { orderTrackingId },
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json', // Required by docs
                },
                 timeout: 15000, // 15 second timeout
            }
        );

        if (response.data && response.data.error && response.data.error.code) {
             console.error(`[Pesapal Lib] ${context} - Pesapal returned error object:`, response.data.error);
             throw new Error(`Pesapal status check failed: ${response.data.error.code} - ${response.data.error.message}`);
        }

        if (response.data && response.data.status === '200') {
             console.log(`[Pesapal Lib] ${context} - Success for Tracking ID: ${orderTrackingId}. Status Code: ${response.data.status_code} (${response.data.payment_status_description})`);
             return response.data;
        } else {
             console.error(`[Pesapal Lib] ${context} - Unexpected response status or structure:`, response.data);
             const message = response.data?.message || 'Unknown error getting transaction status.';
             throw new Error(`Failed to get transaction status: ${message}`);
        }
    } catch (error) {
        if (error.message.startsWith('Pesapal API Error')) throw error;
        throw formatPesapalError(error, context);
    }
}

/**
 * Requests a refund for a previously completed transaction.
 * @param {object} refundPayload - Details for the refund request.
 * @param {string} refundPayload.confirmation_code - The unique confirmation code from the successful transaction.
 * @param {number} refundPayload.amount - The amount to refund.
 * @param {string} refundPayload.username - Identifier of the user/system initiating the refund.
 * @param {string} refundPayload.remarks - Reason for the refund.
 * @returns {Promise<{status: string, message: string}>} Pesapal's response indicating request submission success/failure.
 * @throws {Error} If the refund request submission fails.
 */
export async function requestPesapalRefund(refundPayload) {
     checkPesapalConfig();
     const context = 'Request Refund';
     console.log(`[Pesapal Lib] ${context} - Initiating for confirmation code: ${refundPayload?.confirmation_code}...`);

     if (!refundPayload || !refundPayload.confirmation_code || refundPayload.amount == null || !refundPayload.username || !refundPayload.remarks) {
        throw new Error(`[Pesapal Lib] ${context} - Invalid refund payload. Missing required fields.`);
    }
     if (isNaN(parseFloat(refundPayload.amount)) || parseFloat(refundPayload.amount) <= 0) {
         throw new Error(`[Pesapal Lib] ${context} - Invalid refund amount.`);
     }


     try {
        const token = await getPesapalToken();
        console.log(`[Pesapal Lib] ${context} - Got token, submitting refund request...`);


        const response = await axios.post(
            `${PESAPAL_API_BASE_URL}/Transactions/RefundRequest`,
            { // Ensure payload matches API spec exactly
                confirmation_code: refundPayload.confirmation_code,
                amount: parseFloat(refundPayload.amount), // Ensure it's a number
                username: refundPayload.username,
                remarks: refundPayload.remarks,
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                 timeout: 20000, // Allow slightly longer for refund processing
            }
        );
         console.log("Pesapal refund response:", response.data);


        if (response.data && response.data.status === '200') {
            console.log(`[Pesapal Lib] ${context} - Refund request submitted successfully for confirmation code: ${refundPayload.confirmation_code}. Message: ${response.data.message}`);
            return response.data;
        } else {
             const errorMessage = response.data?.message || 'Pesapal rejected the refund request or returned an unexpected status.';
             console.error(`[Pesapal Lib] ${context} - Refund request failed. Pesapal response:`, response.data);
             throw new Error(`Refund request failed: ${errorMessage}`);
        }
    } catch (error) {
         if (error.message.startsWith('Pesapal API Error')) throw error;
         if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
             console.error(`[Pesapal Lib] ${context} - Request timed out.`);
             throw new Error(`Pesapal API Error during ${context}: Request timed out.`);
         }
        throw formatPesapalError(error, context);
    }
}


/**
 * Cancels a pending or failed Pesapal order.
 * @param {object} cancellationPayload - Contains the order tracking ID.
 * @param {string} cancellationPayload.order_tracking_id - The Pesapal Order Tracking ID to cancel.
 * @returns {Promise<{status: string, message: string}>} Pesapal's response indicating cancellation success/failure.
 * @throws {Error} If the order cancellation fails.
 */
export async function cancelPesapalOrder(cancellationPayload) {
    checkPesapalConfig();
    const context = 'Cancel Order';
     console.log(`[Pesapal Lib] ${context} - Initiating for Tracking ID: ${cancellationPayload?.order_tracking_id}...`);


    if (!cancellationPayload || !cancellationPayload.order_tracking_id) {
        throw new Error(`[Pesapal Lib] ${context} - Invalid cancellation payload. Missing order_tracking_id.`);
    }

    try {
        const token = await getPesapalToken();
         console.log(`[Pesapal Lib] ${context} - Got token, submitting cancellation request...`);


        const response = await axios.post(
            `${PESAPAL_API_BASE_URL}/Transactions/CancelOrder`,
            cancellationPayload,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                 timeout: 15000, // 15 second timeout
            }
        );
        console.log("Pesapal cancel order response:", response.data);


         if (response.data && response.data.status === '200') {
            console.log(`[Pesapal Lib] ${context} - Order cancellation successful for Tracking ID: ${cancellationPayload.order_tracking_id}. Message: ${response.data.message}`);
            return response.data;
        } else {
             const errorMessage = response.data?.message || 'Pesapal failed to cancel the order or returned an unexpected status.';
             console.error(`[Pesapal Lib] ${context} - Order cancellation failed. Pesapal response:`, response.data);
             throw new Error(`Order cancellation failed: ${errorMessage}`);
        }
    } catch (error) {
        if (error.message.startsWith('Pesapal API Error')) throw error;
         if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
             console.error(`[Pesapal Lib] ${context} - Request timed out.`);
             throw new Error(`Pesapal API Error during ${context}: Request timed out.`);
         }
        throw formatPesapalError(error, context);
    }
}

// --- IPN URL Management Functions ---

/**
 * Registers an IPN URL with Pesapal.
 * @param {object} ipnPayload - Details for the IPN registration.
 * @param {string} ipnPayload.url - The publicly accessible URL for Pesapal to send notifications to.
 * @param {'GET' | 'POST'} ipnPayload.ipn_notification_type - The HTTP method Pesapal should use (GET or POST).
 * @returns {Promise<object>} The registration details including the new `ipn_id`.
 * @throws {Error} If IPN registration fails.
 */
export async function registerPesapalIPN(ipnPayload) {
    checkPesapalConfig();
    const context = 'Register IPN URL';
    console.log(`[Pesapal Lib] ${context} - Initiating for URL: ${ipnPayload?.url}...`);

    if (!ipnPayload || !ipnPayload.url || !ipnPayload.ipn_notification_type) {
        throw new Error(`[Pesapal Lib] ${context} - Invalid IPN payload. Missing required fields: url, ipn_notification_type.`);
    }

    const notificationType = ipnPayload.ipn_notification_type.toUpperCase();
    if (notificationType !== 'GET' && notificationType !== 'POST') {
         throw new Error(`[Pesapal Lib] ${context} - Invalid ipn_notification_type. Must be 'GET' or 'POST'.`);
    }

    // Validate URL format (basic check)
    try {
        new URL(ipnPayload.url);
    } catch (_) {
         throw new Error(`[Pesapal Lib] ${context} - Invalid URL format provided.`);
    }


    try {
        const token = await getPesapalToken();
        console.log(`[Pesapal Lib] ${context} - Got token, submitting IPN registration...`);

        const response = await axios.post(
            `${PESAPAL_API_BASE_URL}/URLSetup/RegisterIPN`,
            { // Ensure payload matches API spec exactly
                url: ipnPayload.url,
                ipn_notification_type: notificationType, // Use validated uppercase version
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                 timeout: 15000, // 15 second timeout
            }
        );

        // Check for Pesapal-specific errors even on 2xx responses
        if (response.data && response.data.error) {
             console.error(`[Pesapal Lib] ${context} - Pesapal returned error object:`, response.data.error);
             throw new Error(`Pesapal IPN registration failed: ${response.data.error.code} - ${response.data.error.message}`);
        }

        // Success response structure includes ipn_id and status '200'
        if (response.data && response.data.ipn_id && response.data.status === '200') {
            console.log(`[Pesapal Lib] ${context} - IPN URL registered successfully. URL: ${response.data.url}, IPN ID: ${response.data.ipn_id}`);
            return response.data; // Return the full response object
        } else {
             console.error(`[Pesapal Lib] ${context} - Unexpected response structure:`, response.data);
             throw new Error('IPN registration failed: Invalid response structure from Pesapal.');
        }
    } catch (error) {
         if (error.message.startsWith('Pesapal API Error')) throw error;
        throw formatPesapalError(error, context);
    }
}

/**
 * Retrieves the list of registered IPN URLs for the merchant account.
 * @returns {Promise<Array<object>>} An array of registered IPN objects.
 * @throws {Error} If fetching the IPN list fails.
 */
export async function getPesapalIPNList() {
    checkPesapalConfig();
    const context = 'Get IPN List';
    console.log(`[Pesapal Lib] ${context} - Initiating...`);

    try {
        const token = await getPesapalToken();
        console.log(`[Pesapal Lib] ${context} - Got token, fetching IPN list...`);

        const response = await axios.get(
            `${PESAPAL_API_BASE_URL}/URLSetup/GetIpnList`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    // Content-Type not typically needed for GET but include if API requires
                     'Content-Type': 'application/json',
                },
                 timeout: 15000, // 15 second timeout
            }
        );

        // The success response is directly an array. Check if it's an array.
        // Error responses might still have the standard error object structure.
         if (response.data && response.data.error && response.data.error.code) {
             console.error(`[Pesapal Lib] ${context} - Pesapal returned error object:`, response.data.error);
             throw new Error(`Pesapal IPN list fetch failed: ${response.data.error.code} - ${response.data.error.message}`);
        }

        if (Array.isArray(response.data)) {
            console.log(`[Pesapal Lib] ${context} - Successfully retrieved ${response.data.length} IPN URLs.`);
            // Optional: Validate structure of items within the array if needed
            // response.data.forEach(item => { if(!item.ipn_id || !item.url) console.warn(...) });
            return response.data;
        } else {
             console.error(`[Pesapal Lib] ${context} - Unexpected response structure. Expected an array, received:`, response.data);
             throw new Error('Failed to get IPN list: Invalid response structure from Pesapal.');
        }
    } catch (error) {
        if (error.message.startsWith('Pesapal API Error')) throw error;
        throw formatPesapalError(error, context);
    }
}
