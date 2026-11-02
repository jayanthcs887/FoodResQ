import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { User, Donation, Delivery, Notification, Incident, Distribution } from '../models/index.js'
import { asyncRoute } from '../utils/asyncRoute.js'
import { safeUser, safeDonation, isValidDate } from '../utils/serializers.js'
import { notify } from '../services/notifications.js'
import { allow, requireAuth, issueSession, setSession, clearSession } from '../middleware/auth.js'
import { canDistribute, canReserve, canViewDelivery, deliveryTransitions, isSupportedRole, PUBLIC_ROLES, validCoordinates } from '../domain.js'
import { isProduction } from '../config/env.js'
import { getVerificationStatus } from '../services/verification.js'

export const postAuthRegister = asyncRoute(async (req, res) => {
  const { name, email, password, role, organization, locality } = req.body
  if (!name || !email || typeof password !== 'string' || password.length < 10 || !PUBLIC_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Add your name, a valid email, a password with at least 10 characters, and an eligible account type.' })
  }
  const passwordHash = await bcrypt.hash(password, 12)
  try {
    const user = await User.create({ name, email, passwordHash, role, organization, locality, verificationStatus: 'pending', verificationSubmittedAt: new Date() })
    await notify(user._id, 'Application received', 'Your profile is awaiting verification before operational access.', '/settings')
    setSession(res, issueSession(safeUser(user)))
    res.status(201).json({ user: safeUser(user) })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account with this email already exists.' })
    throw error
  }
})

export const postAuthLogin = asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim()
  const user = await User.findOne({ email }).select('+passwordHash')
  if (!user || !await bcrypt.compare(String(req.body.password || ''), user.passwordHash) || !isSupportedRole(user.role)) return res.status(401).json({ error: 'Email or password is incorrect.' })
  if (user.suspended || user.verificationStatus === 'suspended') return res.status(403).json({ error: 'This account is suspended. Contact platform support if you believe this is an error.', verificationStatus: 'suspended' })
  setSession(res, issueSession(safeUser(user)))
  res.json({ user: safeUser(user) })
})

export const getAuthMe = (req, res) => res.json({ user: safeUser(req.user) })

export const postAuthResubmission = asyncRoute(async (req, res) => {
  if (!PUBLIC_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Only public account holders can resubmit verification details.' })
  const name = String(req.body.name || '').trim()
  const organization = String(req.body.organization || '').trim()
  const locality = String(req.body.locality || '').trim()
  if (!name || name.length > 100 || organization.length > 120 || locality.length > 100) {
    return res.status(400).json({ error: 'Enter a name and keep organization and service area within the stated limits.' })
  }
  if (getVerificationStatus(req.user) !== 'rejected') return res.status(409).json({ error: 'Only a rejected application can be resubmitted.' })

  const submittedAt = new Date()
  const updated = await User.findOneAndUpdate(
    { _id: req.user._id, role: { $in: PUBLIC_ROLES }, verificationStatus: 'rejected', suspended: { $ne: true } },
    {
      $set: { name, organization, locality, verificationStatus: 'pending', verificationSubmittedAt: submittedAt, verified: false, verificationReason: '', reviewedBy: null, reviewedAt: null },
      $push: { verificationHistory: { $each: [{ action: 'resubmitted', fromStatus: 'rejected', toStatus: 'pending', reason: 'Applicant updated and resubmitted account details.', actor: req.user._id, createdAt: submittedAt }], $slice: -100 } },
    },
    { new: true, runValidators: true },
  )
  if (!updated) return res.status(409).json({ error: 'This application has already changed status. Refresh your account and try again.' })
  await notify(updated._id, 'Application resubmitted', 'Your updated account details are awaiting administrator review.', '/settings')
  res.json({ user: safeUser(updated) })
})

export const postAuthLogout = (_req, res) => { clearSession(res); res.json({ ok: true }) }
