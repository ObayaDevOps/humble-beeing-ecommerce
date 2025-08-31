import sanityClient from '../../../../../sanity/lib/client';
import supabaseAdmin from '../../../../lib/supabaseClient';

import { getAllFromInventory } from '../../../../lib/db';
import { requireAdmin } from '@/server/utils/auth'


export default async function handler(req, res) {
    const auth = requireAdmin(req)
    if (!auth.ok) return res.status(auth.status).json(auth.body)
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const { search } = req.query; // For handling search/filtering

    try {

        // console.log("ENTERED")
        // 1. Fetch basic product data from Sanity
        // Adjust schema names (_type, nameField, imageField) if yours differ
        const sanityQuery = `*[_type == "product"]{
            _id,
            "name": name,
            "imageUrl": images[0].asset->url

        }`;
        // Add filtering based on search term if provided
        // This is a basic example; you might want more sophisticated search logic
        // const sanityParams = search ? { search: `*${search}*` } : {};
        // if (search) sanityQuery = `*[(_type == "product") && (name match $search || description match $search)]{ ... }`

        const sanityProducts = await sanityClient.fetch(sanityQuery);
        // console.log('SANITY PRODUCT LIST:', sanityProducts);

        if (!sanityProducts) {
            return res.status(404).json({ message: 'No products found in CMS.' });
        }

        // 2. Fetch inventory data from Supabase
        // let supabaseQuery = supabaseAdmin.from('inventory').select('*');
        // const { data: inventoryData, error: supabaseError } = await supabaseQuery;

        const { data: inventoryData, error: supabaseError } = await getAllFromInventory();
        // console.log('FROM SUPABASE', inventoryData);

        if (supabaseError) {
            console.error('Supabase fetch error:', supabaseError);
            return res.status(500).json({ message: 'Error fetching inventory data.', error: supabaseError.message });
        }

        // 3. Merge Sanity data with Supabase data
        const inventoryMap = new Map(inventoryData.map(item => [item.product_id, item]));

        let mergedData = sanityProducts.map(product => {
            const inventoryItem = inventoryMap.get(product._id);
            return {
                sanityId: product._id,
                name: product.name,
                imageUrl: product.imageUrl,
                price: inventoryItem?.price ?? null, // Default to null if not in inventory
                quantity: inventoryItem?.quantity ?? null,
                minStockLevel: inventoryItem?.min_stock_level ?? null,
                inventoryUpdatedAt: inventoryItem?.updated_at ?? null,
                isInInventory: !!inventoryItem, // Flag if the product exists in Supabase inventory
            };
        });

        // 4. Apply server-side search/filtering (after merging)
        if (search) {
            const searchTerm = search.toLowerCase();
            mergedData = mergedData.filter(item =>
                item.name?.toLowerCase().includes(searchTerm) ||
                item.sanityId?.toLowerCase().includes(searchTerm)
            );
        }

        res.status(200).json(mergedData);

    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
} 
