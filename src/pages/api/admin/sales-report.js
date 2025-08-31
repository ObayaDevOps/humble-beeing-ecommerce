// import supabaseAdmin from '@/lib/supabaseAdmin'; // Can likely be removed if not used elsewhere
// import sanityClient from '@/lib/sanityClient'; // Needed to map product IDs back to names
import sanityClient from '../../../../sanity/lib/client';


import { getSalesDataForReport } from '@/server/repositories/orders';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    // Optional: Add date range filtering (e.g., ?startDate=...&endDate=...)
    // const { startDate, endDate } = req.query;

    try {
        // --- Use the new DB function ---
        const { data: salesData, error: salesError } = await getSalesDataForReport({
            // Pass date filters here if implemented:
            // startDate,
            // endDate,
        });

        // --- Assumptions about your schema remain the same ---
        // 1. 'orders' table: has 'id', 'created_at'
        // 2. 'order_items' table: has 'order_id', 'product_id', 'quantity', 'price'

        if (salesError) {
            // Log the detailed error from the DB function on the server
            console.error('Sales report DB fetch error:', salesError);
            // Return a generic error to the client
            return res.status(500).json({ message: 'Error fetching sales data.' });
        }

        if (!salesData) {
             // Handle case where data is null/undefined but no error (shouldn't happen with Supabase select)
             console.warn('Sales data was unexpectedly null/undefined.');
             return res.status(200).json([]); // Return empty array
        }

        // Aggregate sales data (stays in the API route)
        const aggregatedSales = salesData.reduce((acc, item) => {
            if (!item.product_id) return acc; // Skip items without product_id
            if (!acc[item.product_id]) {
                acc[item.product_id] = { productId: item.product_id, totalQuantity: 0 };
            }
            // Ensure quantity is treated as a number
            acc[item.product_id].totalQuantity += Number(item.quantity || 0);
            return acc;
        }, {});

        // Fetch product names from Sanity (stays in the API route)
        const productIds = Object.keys(aggregatedSales);
        if (productIds.length > 0) {
            const sanityQuery = `*[_id in $ids]{ _id, "name": name }`; // Adjust 'name' field
            const sanityParams = { ids: productIds };
             try {
                const productNames = await sanityClient.fetch(sanityQuery, sanityParams);
                const nameMap = new Map(productNames.map(p => [p._id, p.name]));

                // Add names to the aggregated data
                Object.values(aggregatedSales).forEach(item => {
                    item.productName = nameMap.get(item.productId) || 'Unknown Product';
                });
             } catch (sanityError) {
                 console.error('Sanity fetch error for product names:', sanityError);
                 // Decide how to handle: Proceed without names or return an error?
                 // For now, let's proceed but log the issue
                 Object.values(aggregatedSales).forEach(item => {
                    item.productName = 'Error Fetching Name';
                });
             }
        }


        // Format for charting (stays in the API route)
        const chartData = Object.values(aggregatedSales).map(item => ({
            label: item.productName, // Already assigned above
            value: item.totalQuantity,
            productId: item.productId,
        }));

        res.status(200).json(chartData);

    } catch (error) {
        // Catch errors from aggregation, Sanity fetch (if re-thrown), etc.
        console.error('Error generating sales report:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
} 
