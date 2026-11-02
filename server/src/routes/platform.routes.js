import { Router } from 'express'
import { allow, requireAuth } from '../middleware/auth.js'
import { getHealth, getImpact } from '../controllers/platform.controller.js'

const router = Router()
router.get("/health", getHealth)
router.get("/impact", getImpact)

export default router
