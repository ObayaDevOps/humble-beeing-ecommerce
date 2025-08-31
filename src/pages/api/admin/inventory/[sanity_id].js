// import supabaseAdmin from '@/lib/supabaseAdmin';
import supabaseAdmin from '../../../../lib/supabaseClient';

import { getAllInventoryItemById, updateInventoryItem } from '../../../../lib/db';
import { requireAdmin } from '@/server/utils/auth'


export default async function handler(req, res) {
    const auth = requireAdmin(req)
    if (!auth.ok) return res.status(auth.status).json(auth.body)
    const { sanity_id } = req.query; // Get the Sanity product ID from the URL

    if (!sanity_id) {
        return res.status(400).json({ message: 'Missing Sanity product ID.' });
    }




    // --- Handle GET Request (Fetch single item) ---
    if (req.method === 'GET') {
        try {
            // Fetch the item using your helper function
            const { data: inventoryData, error: supabaseError } = await getAllInventoryItemById(sanity_id);
            // console.log('FROM SUPABASE - Data:', inventoryData, 'Error:', supabaseError); // Log both

            // 1. Check the CORRECT error variable returned from the function call
            if (supabaseError) {
                console.error('Supabase fetch error reported:', supabaseError);
                return res.status(500).json({ message: 'Database error fetching inventory data.', error: supabaseError.message || 'Unknown database error' });
            }

            // 2. Check if data was actually found (assuming getAllInventoryItemById returns null/empty array if not found)
            // Adjust this check based on what getAllInventoryItemById returns when not found
             if (!inventoryData || (Array.isArray(inventoryData) && inventoryData.length === 0)) {
                 console.log(`Inventory item with Sanity ID ${sanity_id} not found in database.`);
                 return res.status(404).json({ message: `Inventory item with Sanity ID ${sanity_id} not found.` });
            }

            // 3. Data exists and no error. Format it.
            // Assuming inventoryData is an array with one item, access it at index 0
            // If getAllInventoryItemById returns a single object, remove [0]
            const item = Array.isArray(inventoryData) ? inventoryData[0] : inventoryData;

            if (!item) { // Double-check after potential array access
                 console.log(`Inventory item data is unexpectedly empty after array check.`);
                 return res.status(404).json({ message: `Inventory item with Sanity ID ${sanity_id} not found.` });
            }

            const formattedData = {
                id: item.id, // Use item.id if it exists in the returned data
                sanityId: item.product_id, // Use item.product_id
                // Add other fields from 'item' - make sure these exist in the data from getAllInventoryItemById
                name: item.name ?? null, // Add nullish coalescing for safety
                price: item.price,
                quantity: item.quantity,
                minStockLevel: item.min_stock_level,
                imageUrl: item.image_url ?? null,
            };
            console.log('formattedData:', formattedData);

            return res.status(200).json(formattedData); // Send the formatted item data

        } catch (error) {
            console.error('GET /api/admin/inventory/[sanity_id] caught exception:', error);
            return res.status(500).json({ message: 'Failed to process fetch inventory request', error: error.message });
        }
    }

    // --- Handle PUT/PATCH Request (Update/Upsert item) ---
    else if (req.method === 'PUT' || req.method === 'PATCH') {
        // Get data to update - use standard names expected by updateInventoryItem
        const { price, quantity, minStockLevel } = req.body;

        // Basic validation: Ensure at least one field is being updated
        // Use the standard names here too
        if (price === undefined && quantity === undefined && minStockLevel === undefined) {
            return res.status(400).json({ message: 'No update data provided (price, quantity, or minStockLevel).' });
        }

        try {
            // Construct the updates object for the db function
            // Use the names expected by updateInventoryItem
            const updates = {};
            if (price !== undefined) updates.price = price;
            if (quantity !== undefined) updates.quantity = quantity;
            // Map the incoming min_stock_level (if exists) or minStockLevel to the expected field
            if (req.body.min_stock_level !== undefined) {
                 updates.minStockLevel = req.body.min_stock_level;
             } else if (minStockLevel !== undefined) {
                updates.minStockLevel = minStockLevel;
            }


            // Call the db helper function instead of direct Supabase access
            const { data, error } = await updateInventoryItem(sanity_id, updates);

            if (error) {
                console.error('Update inventory item error:', error);
                // Check if the error indicates the item wasn't found, which might be a 404
                if (error.message.includes('No inventory record found')) { // Or check error code if available
                     return res.status(404).json({ message: `Inventory item with Sanity ID ${sanity_id} not found for update.`, error: error.message });
                }
                // Otherwise, it's likely a server error
                return res.status(500).json({ message: 'Failed to update inventory.', error: error.message });
            }

            // Handle the case where updateInventoryItem might return null data even without an error
            // if the record didn't exist (though the error check above might cover this)
            if (!data) {
                 console.warn(`Inventory item with Sanity ID ${sanity_id} might not have been found or updated, but no explicit error was thrown.`);
                 // You might still return 404 here depending on desired behavior
                 return res.status(404).json({ message: `Inventory item with Sanity ID ${sanity_id} not found or no changes made.` });
            }


            // Send back the updated data returned by the db function
            res.status(200).json({ message: 'Inventory updated successfully.', data });

        } catch (error) {
            // Catch any unexpected errors during the process
            console.error('PUT/PATCH /api/admin/inventory/[sanity_id] caught exception:', error);
            res.status(500).json({ message: 'Internal Server Error', error: error.message });
        }
    }

    // --- Handle other methods ---
    else {
        // Update the Allow header to include GET
        res.setHeader('Allow', ['GET', 'PUT', 'PATCH']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
} 
