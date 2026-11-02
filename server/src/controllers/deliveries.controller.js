import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { User, Donation, Delivery } from '../models/index.js'
import { asyncRoute } from '../utils/asyncRoute.js'
import { safeDonation, isValidDate } from '../utils/serializers.js'
import { notify } from '../services/notifications.js'
import { canViewDelivery, deliveryTransitions, validCoordinates } from '../domain.js'
import { isProduction } from '../config/env.js'
import { isApprovedAccount } from '../services/verification.js'
import { sameLocality } from '../services/matching.js'
import { expirePastUnassignedDeliveryTasks } from '../services/deliveryTasks.js'

const deliveryView = delivery => ({
  id: delivery.id,
  status: delivery.status,
  donation: delivery.donation && safeDonation(delivery.donation),
  donor: delivery.donor,
  recipient: delivery.recipient,
  partner: delivery.partner,
  currentLocation: delivery.currentLocation,
  deliveredQuantity: delivery.deliveredQuantity,
})

export const getDeliveries = asyncRoute(async (req, res) => {
  await expirePastUnassignedDeliveryTasks()
  let query
  if (req.user.role === 'admin') query = {}
  else if (req.user.role === 'partner') {
    query = isApprovedAccount(req.user)
      ? { $or: [{ partner: req.user._id }, { partner: null, status: 'assigned' }] }
      : { partner: req.user._id }
  } else query = { $or: [{ donor: req.user._id }, { recipient: req.user._id }] }

  let deliveries = await Delivery.find(query)
    .populate('donation')
    .populate('donor', 'name organization')
    .populate('recipient', 'name organization locality')
    .populate('partner', 'name organization')
    .sort({ createdAt: -1 }).limit(100)

  if (req.user.role === 'partner') deliveries = deliveries.filter(delivery => {
    const assignedToUser = String(delivery.partner?._id || delivery.partner || '') === String(req.user._id)
    if (assignedToUser) return true
    if (!isApprovedAccount(req.user) || delivery.status !== 'assigned' || delivery.partner) return false
    const pickupArea = delivery.donation?.pickup?.locality
    return !req.user.locality?.trim() || !pickupArea?.trim() || sameLocality(req.user.locality, pickupArea)
  })

  res.json({ deliveries: deliveries.map(delivery => ({
    ...deliveryView(delivery),
    ...(req.user.role === 'admin' ? { statusHistory: delivery.statusHistory, assignmentHistory: delivery.assignmentHistory } : {}),
  })) })
})

export const postDeliveryAccept = asyncRoute(async (req, res) => {
  if (!isApprovedAccount(req.user)) return res.status(403).json({ error: 'Your Delivery Partner account must be approved before accepting tasks.' })
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Delivery ID is invalid.' })
  await expirePastUnassignedDeliveryTasks()

  const candidate = await Delivery.findOne({ _id: req.params.id, status: 'assigned', partner: null }).populate('donation')
  if (!candidate) return res.status(409).json({ error: 'Another partner accepted this task, or it is no longer available.' })
  if (!candidate.donation || !isValidDate(candidate.donation.deadline) || candidate.donation.deadline <= new Date()) return res.status(409).json({ error: 'The collection deadline has passed; this task cannot be accepted.' })
  const pickupArea = candidate.donation.pickup?.locality
  if (req.user.locality?.trim() && pickupArea?.trim() && !sameLocality(req.user.locality, pickupArea)) {
    return res.status(403).json({ error: 'This task is outside your delivery service area.' })
  }

  const now = new Date()
  const delivery = await Delivery.findOneAndUpdate(
    { _id: candidate._id, status: 'assigned', partner: null },
    {
      $set: { partner: req.user._id, status: 'to_pickup' },
      $push: {
        assignmentHistory: { partner: req.user._id, actor: req.user._id, method: 'partner_accept', createdAt: now },
        statusHistory: { status: 'to_pickup', actor: req.user._id, role: 'partner', createdAt: now },
      },
    },
    { new: true, runValidators: true },
  )
  if (!delivery) return res.status(409).json({ error: 'Another partner accepted this task first. Refresh the delivery list.' })

  await Promise.allSettled([
    notify(delivery.donor, 'Delivery partner accepted', 'A verified delivery partner accepted the pickup task.', '/app/deliveries'),
    notify(delivery.recipient, 'Delivery partner assigned', 'A verified delivery partner is heading to the pickup.', '/app/deliveries'),
  ])
  res.json({ delivery: { id: delivery.id, status: delivery.status, partner: String(delivery.partner) } })
})

export const postDeliveryAssign = asyncRoute(async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(body.partnerId)) return res.status(400).json({ error: 'Delivery or partner ID is invalid.' })
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (reason.length < 3 || reason.length > 500) return res.status(400).json({ error: 'Add a 3 to 500 character reason for this exceptional assignment.' })
  await expirePastUnassignedDeliveryTasks()

  const partner = await User.findOne({ _id: body.partnerId, role: 'partner' })
  if (!partner || !isApprovedAccount(partner)) return res.status(400).json({ error: 'Choose an approved, active delivery partner.' })
  const candidate = await Delivery.findOne({ _id: req.params.id, status: { $in: ['assigned', 'to_pickup'] } }).populate('donation')
  if (!candidate) return res.status(409).json({ error: 'This delivery is already in handoff or no longer available for reassignment.' })
  if (!candidate.donation || !isValidDate(candidate.donation.deadline) || candidate.donation.deadline <= new Date()) return res.status(409).json({ error: 'The collection deadline has passed; this task cannot be assigned.' })
  if (String(candidate.partner || '') === String(partner._id)) return res.status(409).json({ error: 'Choose a different Delivery Partner for this emergency reassignment.' })

  const now = new Date()
  const delivery = await Delivery.findOneAndUpdate(
    { _id: candidate._id, partner: candidate.partner || null, status: candidate.status },
    {
      $set: { partner: partner._id, status: 'to_pickup' },
      $push: {
        assignmentHistory: { partner: partner._id, actor: req.user._id, method: 'admin_override', reason, createdAt: now },
        statusHistory: { status: 'to_pickup', actor: req.user._id, role: 'admin', reason, createdAt: now },
      },
    },
    { new: true, runValidators: true },
  )
  if (!delivery) return res.status(409).json({ error: 'This delivery was accepted or assigned before the override completed.' })

  await Promise.allSettled([
    notify(partner._id, 'Delivery task assigned', 'An administrator assigned this task to you as an exception.', '/app/deliveries'),
    ...(candidate.partner ? [notify(candidate.partner, 'Delivery assignment changed', 'An administrator reassigned this delivery task.', '/app/deliveries')] : []),
    notify(delivery.donor, 'Delivery partner assigned', 'A delivery partner is heading to the pickup.', '/app/deliveries'),
    notify(delivery.recipient, 'Delivery partner assigned', 'A delivery partner is heading to the pickup.', '/app/deliveries'),
  ])
  res.json({ delivery: { id: delivery.id, status: delivery.status, partner: String(delivery.partner) } })
})

export const postDeliveryStatus = asyncRoute(async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
  const { status } = body
  const rule = deliveryTransitions[status]
  if (req.user.role !== 'admin' && !isApprovedAccount(req.user)) return res.status(403).json({ error: 'Account approval is required to update an operational delivery.' })
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Delivery ID is invalid.' })

  const delivery = await Delivery.findById(req.params.id).populate('donation')
  if (!delivery || !canViewDelivery(delivery, req.user)) return res.status(404).json({ error: 'Delivery not found.' })
  if (!rule || !(rule.role === req.user.role || rule.roles?.includes(req.user.role)) || !rule.from.includes(delivery.status)) return res.status(409).json({ error: 'This status change is not allowed for your role or the current trip state.' })
  if (req.user.role === 'partner' && String(delivery.partner) !== String(req.user._id)) return res.status(403).json({ error: 'Only the assigned partner can update this trip.' })
  if (status === 'collected' && (!delivery.pickupVerifiedAt || String(delivery.donor) !== String(req.user._id))) return res.status(403).json({ error: 'The donor must verify pickup before collection is recorded.' })
  if (status === 'delivered' && body.confirmed !== true) return res.status(400).json({ error: 'Recipient confirmation is required.' })

  const update = { $set: { status }, $push: { statusHistory: { status, actor: req.user._id, role: req.user.role, createdAt: new Date() } } }
  if (status === 'delivered') {
    const quantity = Number(body.quantity)
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > delivery.donation.portions) return res.status(400).json({ error: 'Enter a valid whole number for the quantity received.' })
    update.$set.deliveredQuantity = quantity
    update.$set.deliveredAt = new Date()
  }
  const ownerFilter = req.user.role === 'partner' ? { partner: req.user._id }
    : req.user.role === 'donor' ? { donor: req.user._id }
      : { recipient: req.user._id }
  const updated = await Delivery.findOneAndUpdate(
    { _id: delivery._id, status: { $in: rule.from }, ...ownerFilter },
    update,
    { new: true, runValidators: true },
  )
  if (!updated) return res.status(409).json({ error: 'This delivery changed before the update completed. Refresh and try again.' })

  if (status === 'delivered') {
    await Donation.updateOne(
      { _id: delivery.donation._id, status: { $in: ['reserved', 'collected', 'delivered'] } },
      { $set: { status: 'delivered', deliveredQuantity: updated.deliveredQuantity } },
    )
  }
  const other = [updated.donor, updated.recipient, updated.partner].filter(user => user && String(user) !== String(req.user._id))
  await Promise.allSettled(other.map(user => notify(user, 'Delivery update', `Trip status: ${status.replaceAll('_', ' ')}.`, '/app/deliveries')))
  res.json({ delivery: { id: updated.id, status: updated.status, deliveredQuantity: updated.deliveredQuantity } })
})

export const postDeliveryLocation = asyncRoute(async (req, res) => {
  if (!isApprovedAccount(req.user)) return res.status(403).json({ error: 'Account approval is required to share delivery location.' })
  const lat = Number(req.body.lat), lng = Number(req.body.lng), accuracy = Number(req.body.accuracy || 0)
  if (!validCoordinates(lat, lng, accuracy)) return res.status(400).json({ error: 'That location update is not valid.' })
  const delivery = await Delivery.findOne({ _id: req.params.id, partner: req.user._id, status: { $in: ['to_pickup', 'at_pickup', 'collected', 'in_transit', 'at_destination'] } })
  if (!delivery) return res.status(403).json({ error: 'Location sharing is only available during your assigned active trip.' })
  if (delivery.currentLocation?.updatedAt && Date.now() - new Date(delivery.currentLocation.updatedAt).getTime() < 4000) return res.status(429).json({ error: 'Please wait before sending another location update.' })
  delivery.currentLocation = { lat, lng, accuracy, updatedAt: new Date() }
  await delivery.save()
  res.json({ ok: true, updatedAt: delivery.currentLocation.updatedAt })
})

export const postDeliveryPickupCode = asyncRoute(async (req, res) => {
  if (!isApprovedAccount(req.user)) return res.status(403).json({ error: 'Account approval is required to create a pickup code.' })
  const delivery = await Delivery.findOne({ _id: req.params.id, partner: req.user._id, status: 'at_pickup' })
  if (!delivery) return res.status(403).json({ error: 'Only the assigned partner at pickup can request verification.' })
  const code = String(crypto.randomInt(100000, 999999))
  delivery.pickupCodeHash = await bcrypt.hash(code, 10)
  delivery.pickupCodeExpiry = new Date(Date.now() + 10 * 60 * 1000)
  await delivery.save()
  if (process.env.DEMO_MODE === 'true' && !isProduction) return res.json({ message: 'Development only: share this code with the donor for pickup confirmation.', demoCode: code, expiresAt: delivery.pickupCodeExpiry })
  res.status(503).json({ error: 'A secure delivery channel is not configured to share the verification code.' })
})

export const postDeliveryVerifyPickup = asyncRoute(async (req, res) => {
  if (!isApprovedAccount(req.user)) return res.status(403).json({ error: 'Account approval is required to verify pickup.' })
  const delivery = await Delivery.findOne({ _id: req.params.id, donor: req.user._id, status: 'at_pickup' })
  if (!delivery || !delivery.pickupCodeHash || delivery.pickupCodeExpiry < new Date() || !await bcrypt.compare(String(req.body.code || ''), delivery.pickupCodeHash)) return res.status(400).json({ error: 'Code is invalid or expired.' })
  const verified = await Delivery.findOneAndUpdate(
    { _id: delivery._id, donor: req.user._id, status: 'at_pickup', pickupCodeHash: delivery.pickupCodeHash, pickupCodeExpiry: { $gt: new Date() }, pickupVerifiedAt: { $exists: false } },
    { $set: { pickupVerifiedAt: new Date() }, $unset: { pickupCodeHash: 1, pickupCodeExpiry: 1 } },
    { new: true },
  )
  if (!verified) return res.status(409).json({ error: 'Pickup was already verified or the code expired. Request a new code if needed.' })
  await notify(delivery.partner, 'Pickup verified', 'The donor confirmed the food handover.', '/app/deliveries')
  res.json({ ok: true })
})
