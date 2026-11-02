import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { allow, requireAuth, requireSameOrigin } from '../middleware/auth.js'
import { postAuthRegister, postAuthLogin, getAuthMe, postAuthResubmission, postAuthLogout } from '../controllers/auth.controller.js'

const router = Router()
router.use('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }))

router.post("/auth/register", requireSameOrigin, postAuthRegister)
router.post("/auth/login", requireSameOrigin, postAuthLogin)
router.get("/auth/me", requireAuth, getAuthMe)
router.patch("/auth/resubmission", requireAuth, requireSameOrigin, postAuthResubmission)
router.post("/auth/logout", requireSameOrigin, postAuthLogout)

export default router
