import { Router } from 'express'
import { allow, requireAuth } from '../middleware/auth.js'
import { postIncidents } from '../controllers/incidents.controller.js'

const router = Router()
router.post("/incidents", requireAuth, postIncidents)

export default router
