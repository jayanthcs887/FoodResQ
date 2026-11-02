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

export const getHealth = (_req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' })

export const getImpact = asyncRoute(async (_req, res) => {
  const [listed, delivered, deliveries, distributed, donors, recipients] = await Promise.all([
    Donation.countDocuments(), Donation.countDocuments({ status: { $in: ['delivered', 'distributed'] } }),
    Delivery.aggregate([{ $match: { status: 'delivered' } }, { $group: { _id: null, portions: { $sum: '$deliveredQuantity' } } }]),
    Distribution.aggregate([{ $group: { _id: null, portions: { $sum: '$portions' } } }]),
    User.countDocuments({ role: 'donor', verified: true, suspended: false }), User.countDocuments({ role: 'recipient', verified: true, suspended: false }),
  ])
  res.json({ listed, delivered, deliveredPortions: deliveries[0]?.portions || 0, distributedPortions: distributed[0]?.portions || 0, donors, recipients })
})
