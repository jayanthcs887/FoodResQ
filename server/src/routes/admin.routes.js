import { Router } from 'express'
import { allow, requireAuth, requireSameOrigin } from '../middleware/auth.js'
import {
  decideVerificationRequest,
  getAdminDashboard,
  getAdminIncidents,
  getAdminUsers,
  getAdminVerificationRequest,
  getAdminVerificationRequests,
  patchAdminDonationReview,
  patchAdminIncident,
  patchAdminUser,
  reinstateAdminUser,
  suspendAdminUser,
} from '../controllers/admin.controller.js'

const router = Router()
const admin = [requireAuth, allow('admin')]
const adminMutation = [...admin, requireSameOrigin]

router.get('/admin/dashboard', ...admin, getAdminDashboard)
router.get('/admin/verification-requests', ...admin, getAdminVerificationRequests)
router.get('/admin/verification-requests/:id', ...admin, getAdminVerificationRequest)
router.patch('/admin/verification-requests/:id/:decision', ...adminMutation, decideVerificationRequest)
router.get('/admin/users', ...admin, getAdminUsers)
router.patch('/admin/users/:id/suspend', ...adminMutation, suspendAdminUser)
router.patch('/admin/users/:id/reinstate', ...adminMutation, reinstateAdminUser)
router.patch('/admin/users/:id', ...adminMutation, patchAdminUser)
router.patch('/admin/donations/:id/review', ...adminMutation, patchAdminDonationReview)
router.get('/admin/incidents', ...admin, getAdminIncidents)
router.patch('/admin/incidents/:id', ...adminMutation, patchAdminIncident)

export default router
