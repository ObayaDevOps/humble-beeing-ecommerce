// pages/api/checkout.js (or app/api/checkout/route.js)
// Refactored: pre-payment stock decrement removed.
// Stock is handled post-payment during order creation.

// --- Handler Logic (Example for Pages Router) ---
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Assume cart items are sent in the request body
    // Example format: [{ productId: 'sanity_doc_id_1', requestedQuantity: 2 }, ...]
    const cartItems = req.body.items;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        return res.status(400).json({ message: 'Bad Request: Invalid or empty cart items' });
    }

    // New behavior: do not mutate stock here. Defer stock update to post-payment
    // (verify/IPN flow) where order creation and stock decrement can be done atomically.
    return res.status(200).json({ success: true, message: 'Stock validation deferred to post-payment.' })
}

// --- App Router equivalent structure (app/api/checkout/route.js) ---
/*
import { NextResponse } from 'next/server';
// ... other imports

export async function POST(req) {
    const body = await req.json();
    const cartItems = body.items;

    // ... rest of the logic using NextResponse for responses ...
}
*/
