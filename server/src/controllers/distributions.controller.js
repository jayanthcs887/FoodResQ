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
import { isApprovedAccount } from '../services/verification.js'

export const getDistributions = asyncRoute(async (req, res) => {
  const query = req.user.role === 'admin' ? {} : { recipient: req.user._id }
  const records = await Distribution.find(query).populate('donation', 'title organization').sort({ createdAt: -1 }).limit(200).lean()
  res.json({ distributions: records })
})

export const postDistributions = asyncRoute(async (req, res) => {
  if (!isApprovedAccount(req.user)) return res.status(403).json({ error: 'Your organization needs Admin approval before recording distribution.' })
  const portions = Number(req.body.portions)
  if (!Number.isInteger(portions) || portions < 1) return res.status(400).json({ error: 'Enter a whole number of portions distributed.' })
  const delivery = await Delivery.findOne({ _id: req.body.deliveryId, recipient: req.user._id, status: 'delivered' })
  if (!delivery) return res.status(404).json({ error: 'A completed delivery for your organization was not found.' })
  const currentDonation = await Donation.findById(delivery.donation).select('status deliveredQuantity distributedQuantity')
  if (!currentDonation || !['delivered', 'distributed'].includes(currentDonation.status) || !canDistribute({ delivered: currentDonation.deliveredQuantity, distributed: currentDonation.distributedQuantity, requested: portions })) return res.status(409).json({ error: 'The reported amount exceeds the remaining delivered portions.' })
  const donation = await Donation.findOneAndUpdate(
    { _id: delivery.donation, status: { $in: ['delivered', 'distributed'] }, $expr: { $lte: [{ $add: [{ $ifNull: ['$distributedQuantity', 0] }, portions] }, '$deliveredQuantity'] } },
    { $inc: { distributedQuantity: portions } }, { new: true },
  )
  if (!donation) return res.status(409).json({ error: 'The reported amount exceeds the remaining delivered portions.' })
  let record
  try {
    record = await Distribution.create({ delivery: delivery._id, donation: donation._id, recipient: req.user._id, portions, locality: req.user.locality })
  } catch (error) {
    await Donation.updateOne({ _id: donation._id }, { $inc: { distributedQuantity: -portions } })
    throw error
  }
  if (donation.distributedQuantity >= donation.deliveredQuantity) {
    await Donation.updateOne({ _id: donation._id, distributedQuantity: { $gte: donation.deliveredQuantity } }, { $set: { status: 'distributed' } })
  }
  await notify(delivery.donor, 'Distribution recorded', `${req.user.organization || req.user.name} recorded ${portions} distributed portions.`, '/app/impact')
  res.status(201).json({ distribution: { id: record.id, portions, locality: record.locality, createdAt: record.createdAt }, remaining: Math.max(0, donation.deliveredQuantity - donation.distributedQuantity) })
})
