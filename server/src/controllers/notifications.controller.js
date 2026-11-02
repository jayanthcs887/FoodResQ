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

export const getNotifications = asyncRoute(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100).lean()
  res.json({ notifications })
})

export const patchNotificationsReadAll = asyncRoute(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } })
  res.json({ ok: true })
})

export const patchNotificationRead = asyncRoute(async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: { readAt: new Date() } }, { new: true })
  if (!notification) return res.status(404).json({ error: 'Notification not found.' })
  res.json({ ok: true })
})
