import { Router } from 'express'
import { allow, requireAuth, requireSameOrigin } from '../middleware/auth.js'
import { getDonations, postDonations, postDonationClaim, postDonationRequest, getRequests, postDonationRequestResponse } from '../controllers/donations.controller.js'

const router = Router()
router.get("/donations", requireAuth, getDonations)
router.post("/donations", requireAuth, allow('donor'), requireSameOrigin, postDonations)
router.post("/donations/:id/claim", requireAuth, allow('recipient'), requireSameOrigin, postDonationClaim)
router.post("/donations/:id/requests", requireAuth, allow('recipient'), requireSameOrigin, postDonationRequest)
router.get("/requests", requireAuth, getRequests)
router.post("/donations/:id/requests/:requestId/respond", requireAuth, allow('donor', 'admin'), requireSameOrigin, postDonationRequestResponse)

export default router
