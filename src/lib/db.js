// lib/db.js
import { getServerSupabaseClient } from './supabaseClient';

// --- Payment Creation ---
export async function createPendingPayment(paymentData) {
    const supabase = getServerSupabaseClient();
    const {
        merchant_reference,
        amount,
        currency,
        description,
        customer_email,
        customer_phone,
        ipn_id_used,
        callback_url_used,
        cart_items,
        deliveryDetails,
        user_id,
    } = paymentData;

    console.log(`Attempting to insert pending payment for merchant ref: ${merchant_reference}`);

    const { data, error } = await supabase
        .from('payments')
        .insert([
            {
                merchant_reference,
                amount,
                currency,
                description,
                status: 'PENDING',
                customer_email,
                customer_phone,
                ipn_id_used,
                callback_url_used,
                cart_items: cart_items,
                delivery_address: deliveryDetails,
            },
        ])
        .select()
        .single();

    if (error) {
        console.error(`Supabase error creating pending payment for ${merchant_reference}:`, error);
        if (error.message.includes('delivery_address')) {
            console.error("Potential issue with the 'delivery_address' column or data format.");
        }
        throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
        console.error(`Supabase returned no data after inserting payment for ${merchant_reference}`);
        throw new Error('Database error: Failed to create payment record.');
    }

    console.log(`Successfully inserted payment record ID: ${data.id}`);
    return data;
}

// --- Update with Pesapal Tracking ID ---
export async function updatePaymentTrackingId(paymentId, pesapalTrackingId) {
    const supabase = getServerSupabaseClient();
    const { error } = await supabase
        .from('payments')
        .update({
             pesapal_tracking_id: pesapalTrackingId,
             // updated_at will auto-update via trigger
         })
        .eq('id', paymentId); // Use the internal DB ID

    if (error) {
        console.error('Supabase error updating tracking ID:', error);
        // Decide if this should throw or just log, depending on criticality
    }
}


// --- Update Payment Status (from Verification or IPN) ---
export async function updatePaymentStatus(
    pesapalTrackingId,
    internalStatus,
    paymentMethod,
    confirmationCode,
    statusDescription
) {
    const supabase = getServerSupabaseClient();
    const updateData = {
        status: internalStatus,
        pesapal_confirmation_code: confirmationCode || null,
        pesapal_status_description: statusDescription || null,
        last_checked_at: new Date().toISOString(),
        // payment_method_used: paymentMethod || null, // Uncomment if you add the column
    };

    console.log(`Updating payment status for tracking ID ${pesapalTrackingId} to ${internalStatus}`);

    const { data, error } = await supabase
        .from('payments')
        .update(updateData)
        .eq('pesapal_tracking_id', pesapalTrackingId)
        .select() // Select the updated record
        .single(); // Expect only one record

    if (error) {
        console.error(`Supabase error updating status for ${pesapalTrackingId}:`, error);
        throw new Error(`Supabase update error: ${error.message}`);
    }
    if (!data) {
        console.warn(`No payment record found to update for tracking ID: ${pesapalTrackingId}`);
        // Return null or handle as appropriate for the caller
        return null;
    }
    console.log(`Successfully updated status for payment ID: ${data.id}`);
    return data; // Return updated record
}

// --- Get Payment Record (e.g., for checking before redundant updates) ---
export async function getPaymentByTrackingId(pesapalTrackingId) {
     const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('pesapal_tracking_id', pesapalTrackingId)
        .maybeSingle(); // Use maybeSingle as it might not exist yet

    if (error) {
        console.error(`Supabase error getting payment by tracking ID ${pesapalTrackingId}:`, error);
        // Decide how to handle read errors
    }
    return data; // Returns the record or null
}

//Used in inventory
// --- Get Payment Record (e.g., for checking before redundant updates) ---
export async function getAllFromInventory() {
    console.log('ENTERED GET ALL FROM INVENTORY')
    const supabase = getServerSupabaseClient();
   const { data, error } = await supabase
       .from('inventory')
       .select('*');
    //    .maybeSingle(); // Use maybeSingle as it might not exist yet
    console.log('SUAPBASE DATA:', data);
    console.log('ERROR', error)

   if (!data) {
       console.error(`Supabase error getting all from inventory:`, error);
       // Decide how to handle read errors
   }
   return  { data, error }; // Returns the record or null
}


export async function getAllInventoryItemById(sanity_id) {
    console.log('ENTERED GET ALL FROM INVENTORY BY ID')
    const supabase = getServerSupabaseClient();
   const { data, error } = await supabase
       .from('inventory')
       .select('*')
       .eq('product_id', sanity_id);
    //    .maybeSingle(); // Use maybeSingle as it might not exist yet

    console.log('SUAPBASE DATA getAllInventoryItemById:', data);
    console.log('ERROR getAllInventoryItemById', error)

   if (!data) {
       console.error(`Supabase error getting all from inventory:`, error);
       // Decide how to handle read errors
   }
   return  { data, error }; // Returns the record or null
}

// --- Idempotency (DB-backed via processed_events table) ---
export async function markEventProcessed(eventType, trackingId, ttlSeconds = 300) {
    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase.rpc('mark_event_processed', {
        p_type: eventType,
        p_tracking: trackingId,
        p_ttl_seconds: ttlSeconds,
    })
    if (error) {
        console.error('Supabase RPC error calling mark_event_processed:', error)
        // Consider throwing to let callers decide
        return { ok: false, error }
    }
    // data is boolean: true if marked now, false if duplicate
    return { ok: true, processed: !!data }
}


/**
 * Updates an inventory item in the database.
 * @param {string} sanityId - The Sanity ID of the product (maps to product_id).
 * @param {object} updates - An object containing the fields to update (e.g., { price, quantity, min_stock_level }).
 * @returns {Promise<{data: object|null, error: object|null}>} - The result of the update operation.
 */
export async function updateInventoryItem(sanityId, updates) {
    console.log(`Attempting to update inventory for product_id: ${sanityId} with data:`, updates);
    const supabase = getServerSupabaseClient();

    // Ensure numeric types are handled correctly, converting empty strings or invalid inputs to null
    const cleanUpdates = {
        price: updates.price === '' || isNaN(Number(updates.price)) ? null : Number(updates.price),
        quantity: updates.quantity === '' || isNaN(Number(updates.quantity)) ? null : Number(updates.quantity),
        min_stock_level: updates.minStockLevel === '' || isNaN(Number(updates.minStockLevel)) ? null : Number(updates.minStockLevel),
        // Add any other fields you might want to update here
    };

     // Remove null keys if Supabase should ignore them instead of setting to NULL
    // Object.keys(cleanUpdates).forEach(key => cleanUpdates[key] === null && delete cleanUpdates[key]);


    const { data, error } = await supabase
        .from('inventory')
        .update(cleanUpdates)
        .eq('product_id', sanityId) // Assuming 'product_id' column stores the sanity ID
        .select()
        .single();

    if (error) {
        console.error(`Supabase error updating inventory for product_id ${sanityId}:`, error);
    } else if (!data) {
         console.warn(`No inventory record found to update for product_id: ${sanityId}`);
    } else {
        console.log(`Successfully updated inventory for product_id: ${sanityId}`);
    }

    return { data, error };
}


// Add other functions as needed (e.g., getPaymentByMerchantReference)


/**
 * Fetches sales data aggregated by product ID for the sales report.
 * Optionally filters by date range in the future.
 * @param {object} options - Optional filtering options (e.g., { startDate, endDate }).
 * @returns {Promise<{data: Array<{product_id: string, quantity: number}>|null, error: object|null}>} - The raw sales data or an error.
 */
export async function getSalesDataForReport(options = {}) {
    const supabase = getServerSupabaseClient(); // Use the server client helper
    // const { startDate, endDate } = options; // For future date filtering

    console.log("Fetching sales data for report...");

    let query = supabase
        .from('order_items')
        .select(`
            product_id,
            quantity
        `);

    // Add date filtering if needed:
    // if (startDate) {
    //     query = query.gte('created_at', startDate); // Adjust column name if needed
    // }
    // if (endDate) {
    //     query = query.lte('created_at', endDate); // Adjust column name if needed
    // }

    const { data, error } = await query;

    if (error) {
        console.error('Supabase error fetching sales data for report:', error);
    } else {
        console.log(`Successfully fetched ${data?.length || 0} order items for sales report.`);
    }

    // Return the raw data and let the API route handle aggregation
    return { data, error };
}

/**
 * Fetches details (like price, name) for multiple products from inventory.
 * @param {string[]} productIds - An array of product IDs (Sanity IDs).
 * @returns {Promise<{data: object[]|null, error: object|null}>} - Product details or error.
 */
export async function getProductDetailsByIds(productIds) {
    if (!productIds || productIds.length === 0) {
        return { data: [], error: null }; // Return empty array if no IDs provided
    }
    console.log(`Fetching inventory details for product IDs: ${productIds.join(', ')}`);
    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
        .from('inventory')
        .select('product_id, price, quantity, name') // Select fields needed: added quantity
        .in('product_id', productIds);

    if (error) {
        console.error('Supabase error fetching product details by IDs:', error);
    } else if (!data || data.length !== productIds.length) {
        // Handle cases where some products might not be found in inventory
        console.warn(`Could not find inventory details for all requested product IDs. Found ${data?.length || 0} of ${productIds.length}`);
        // Decide if this is an error or just needs filtering later.
    }

    return { data, error };
}


// --- Order Management Functions ---

/**
 * Checks if an order record already exists for a given payment ID.
 * @param {string} paymentId - The UUID of the payment record.
 * @returns {Promise<object|null>} - The existing order record or null if not found.
 */
export async function findOrderExistsByPaymentId(paymentId) {
    console.log(`Checking for existing order with payment_id: ${paymentId}`);
    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
        .from('orders') // Assuming your orders table is named 'orders'
        .select('id') // Only need the ID to confirm existence
        .eq('payment_id', paymentId)
        .maybeSingle(); // Expect 0 or 1

    if (error) {
        console.error(`Supabase error checking for existing order by payment ID ${paymentId}:`, error);
        // Re-throw or handle as needed - this indicates a potential issue.
        throw new Error(`Database error checking for order: ${error.message}`);
    }

    if (data) {
        console.log(`Found existing order ID: ${data.id} for payment ID ${paymentId}`);
    } else {
        console.log(`No existing order found for payment ID ${paymentId}`);
    }
    return data; // Returns the record { id: '...' } or null
}

/**
 * Creates an order and its associated order items using an RPC function.
 * This function calls a PostgreSQL function 'create_order_and_items' defined in Supabase.
 * @param {object} orderData - Data for the 'orders' table (e.g., payment_id, user_id, total_amount, currency, addresses, status).
 * @param {object[]} itemsData - Array of items from the cart (e.g., [{ product_id, quantity }, ...]).
 * @returns {Promise<{data: object|null, error: object|null}>} - The newly created order record or an error.
 */
export async function createOrderAndItems(orderData, itemsData) {
    console.log('Attempting to create order and items via RPC:', { orderData, itemsData });
    const supabase = getServerSupabaseClient();

    // Prepare the items in the format expected by the PostgreSQL function
    // *** FIX: Map product_id to _id ***
    const itemsJson = itemsData.map(item => ({
        _id: item.product_id, // Use _id as the key
        quantity: item.quantity
    }));

    // *** Log the corrected JSON to verify ***
    console.log('RPC - itemsJson (mapped to _id):', itemsJson);

    // Call the PostgreSQL function
    const { data, error } = await supabase.rpc('create_order_and_items', {
        p_order_data: orderData,
        p_items_data: itemsJson // Pass the corrected items JSON array
    });

    if (error) {
        console.error('Supabase RPC error calling create_order_and_items:', error);
    } else {
        console.log('Successfully created order via RPC. Result:', data);
    }

    return { data, error };
}

/**
 * Creates an order and items AND decrements stock atomically in a single transaction via RPC.
 * PostgreSQL function: create_order_and_items_atomic(p_order_data JSONB, p_items_data JSONB)
 */
export async function createOrderAndItemsAtomic(orderData, itemsData) {
    console.log('Attempting atomic order+stock RPC:', { orderData, itemsData })
    const supabase = getServerSupabaseClient();

    // Prepare items as expected by the RPC: [{ product_id, quantity }]
    const itemsJson = (itemsData || []).map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
    }));

    const { data, error } = await supabase.rpc('create_order_and_items_atomic', {
        p_order_data: orderData,
        p_items_data: itemsJson,
    });

    if (error) {
        console.error('Supabase RPC error calling create_order_and_items_atomic:', error)
    } else {
        console.log('Atomic RPC success. Created order:', data)
    }
    return { data, error }
}

/**
 * Updates stock levels for multiple items using an RPC function.
 * Calls a PostgreSQL function 'decrement_stock' defined in Supabase.
 * @param {object[]} itemsData - Array of items sold (e.g., [{ product_id, quantity }, ...]).
 * @returns {Promise<{data: any|null, error: object|null}>} - Result from RPC or error.
 */
export async function updateInventoryStock(itemsData) {
    if (!itemsData || itemsData.length === 0) {
        console.log("No items provided to update inventory stock.");
        return { data: null, error: null };
    }
    console.log('Attempting to update inventory stock via RPC:', itemsData);
    const supabase = getServerSupabaseClient();

    // Prepare items data for the RPC call
    const stockUpdates = itemsData.map(item => ({
        p_product_id: item.product_id,
        p_quantity_sold: item.quantity
    }));

    // Call the PostgreSQL function 'decrement_stock'
    // This function likely takes an array of records or JSONB
    const { data, error } = await supabase.rpc('decrement_stock', {
        items_sold: stockUpdates // Adjust parameter name as needed
    });

    if (error) {
        console.error('Supabase RPC error calling decrement_stock:', error);
    } else {
        console.log('Successfully called decrement_stock RPC. Result:', data);
        // The RPC might return success status, number of rows affected, etc.
    }

    return { data, error };
}
