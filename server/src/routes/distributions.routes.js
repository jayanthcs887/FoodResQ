import { Router } from 'express'
import { allow, requireAuth, requireSameOrigin } from '../middleware/auth.js'
import { getDistributions, postDistributions } from '../controllers/distributions.controller.js'

const router = Router()
router.get("/distributions", requireAuth, allow('recipient', 'admin'), getDistributions)
router.post("/distributions", requireAuth, allow('recipient'), requireSameOrigin, postDistributions)

export default router
