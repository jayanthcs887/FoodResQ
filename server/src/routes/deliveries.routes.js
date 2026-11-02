import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { allow, requireAuth, requireSameOrigin } from '../middleware/auth.js'
import { getDeliveries, postDeliveryAccept, postDeliveryAssign, postDeliveryStatus, postDeliveryLocation, postDeliveryPickupCode, postDeliveryVerifyPickup } from '../controllers/deliveries.controller.js'

const router = Router()
router.get("/deliveries", requireAuth, getDeliveries)
router.post("/deliveries/:id/accept", requireAuth, allow('partner'), requireSameOrigin, postDeliveryAccept)
router.post("/deliveries/:id/assign", requireAuth, allow('admin'), requireSameOrigin, postDeliveryAssign)
router.post("/deliveries/:id/status", requireAuth, requireSameOrigin, postDeliveryStatus)
router.post("/deliveries/:id/location", requireAuth, allow('partner'), requireSameOrigin, postDeliveryLocation)
router.post("/deliveries/:id/pickup-code", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }), requireAuth, allow('partner'), requireSameOrigin, postDeliveryPickupCode)
router.post("/deliveries/:id/verify-pickup", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }), requireAuth, allow('donor'), requireSameOrigin, postDeliveryVerifyPickup)

export default router
