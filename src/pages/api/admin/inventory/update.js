import { updateInventoryItem } from '@/server/repositories/inventory';
// import { verifyAdmin } from '@/lib/auth'; // TODO: Implement proper admin verification

export default async function handler(req, res) {
    // TODO: Add authentication/authorization check
    // const isAdmin = await verifyAdmin(req);
    // if (!isAdmin) {
    //     return res.status(403).json({ message: 'Forbidden' });
    // }

    if (req.method !== 'PUT') {
        res.setHeader('Allow', ['PUT']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const { sanityId, price, quantity, minStockLevel } = req.body;

    if (!sanityId) {
        return res.status(400).json({ message: 'Missing required field: sanityId' });
    }

    // Basic validation (more robust validation might be needed)
    if (price === undefined || quantity === undefined || minStockLevel === undefined) {
         return res.status(400).json({ message: 'Missing required fields: price, quantity, minStockLevel' });
    }

    try {
        const updates = {
            price: price,
            quantity: quantity,
            minStockLevel: minStockLevel, // Ensure frontend sends correct key
        };

        const { data, error } = await updateInventoryItem(sanityId, updates);

        if (error) {
            // Check for specific errors, e.g., item not found
             if (error.message.includes('No rows found')) { // Adjust based on actual Supabase error
                 return res.status(404).json({ message: `Inventory item with ID ${sanityId} not found.` });
            }
            console.error("API Error updating inventory:", error);
            return res.status(500).json({ message: 'Failed to update inventory item', error: error.message });
        }

        if (!data) {
             // This case might be handled by the DB function warning, but good to check
             return res.status(404).json({ message: `Inventory item with ID ${sanityId} not found or no change detected.` });
        }


        return res.status(200).json({ message: 'Inventory updated successfully', item: data });
    } catch (error) {
        console.error("Unexpected API Error:", error);
        return res.status(500).json({ message: 'An unexpected error occurred', error: error.message });
    }
} 
