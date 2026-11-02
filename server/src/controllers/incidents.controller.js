import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { User, Donation, Delivery, Notification, Incident, Distribution } from '../models/index.js'
import { asyncRoute } from '../utils/asyncRoute.js'
import { safeUser, safeDonation, isValidDate } from '../utils/serializers.js'
import { notify } from '../services/notifications.js'
import { allow, requireAuth, issueSession, setSession, clearSession } from '../middleware/auth.js'
import { canDistribute, canReserve, canViewDelivery, deliveryTransitions, validCoordinates } from '../domain.js'
import { isProduction } from '../config/env.js'

export const postIncidents = asyncRoute(async (req, res) => {
  if (!['food_safety', 'quantity', 'delay', 'route', 'other'].includes(req.body.type) || !req.body.description?.trim()) return res.status(400).json({ error: 'Choose a report type and add a short description.' })
  const incident = await Incident.create({ reporter: req.user._id, donation: req.body.donationId || undefined, delivery: req.body.deliveryId || undefined, type: req.body.type, description: req.body.description })
  const admins = await User.find({ role: 'admin', suspended: false }).select('_id')
  await Promise.all(admins.map(a => notify(a._id, 'Incident needs review', 'A new report was submitted.', '/admin/incidents')))
  res.status(201).json({ incident: { id: incident.id, status: incident.status } })
})
