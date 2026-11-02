import { Router } from 'express'
import { allow, requireAuth } from '../middleware/auth.js'
import { getNotifications, patchNotificationsReadAll, patchNotificationRead } from '../controllers/notifications.controller.js'

const router = Router()
router.get("/notifications", requireAuth, getNotifications)
router.patch("/notifications/read-all", requireAuth, patchNotificationsReadAll)
router.patch("/notifications/:id/read", requireAuth, patchNotificationRead)

export default router
