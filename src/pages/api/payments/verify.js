// pages/api/payments/verify.js
import { ensureRequestId } from '@/server/utils/requestId'
import { createLogger } from '@/server/utils/logger'
import { verifyPayment } from '@/server/services/payments'
import { rateLimit, keyFromReq } from '@/server/utils/rateLimit'

export default async function handler(req, res) {
     const rl = rateLimit(keyFromReq(req, 'verify'))
     if (!rl.allowed) return res.status(429).json({ message: 'Too many requests. Please try again later.' })
     if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { orderTrackingId } = req.body;

    if (!orderTrackingId) {
        return res.status(400).json({ message: 'Order Tracking ID is required.' });
    }

    const requestId = ensureRequestId(req, res)
    const log = createLogger({ requestId, route: 'api/payments/verify' })
    const result = await verifyPayment(orderTrackingId, log)
    return res.status(result.status).json(result.body)
}
