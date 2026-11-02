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
import { getVerificationStatus, isApprovedAccount } from '../services/verification.js'
import { findApprovedUsersByLocality } from '../services/matching.js'

export const getDonations = asyncRoute(async (req, res) => {
  await Donation.updateMany({ status: 'available', deadline: { $lte: new Date() } }, { $set: { status: 'expired' } })
  const query = {}
  if (req.query.status) query.status = req.query.status
  if (req.user.role === 'donor') query.donor = req.user._id
  if (req.user.role === 'recipient') {
    if (!isApprovedAccount(req.user)) query._id = { $exists: false }
    else {
      query.status = 'available'
      query.deadline = { $gt: new Date() }
      if (req.user.locality?.trim()) query['pickup.locality'] = new RegExp(`^${req.user.locality.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }
  }
  if (req.user.role === 'partner') {
    const assigned = await Delivery.find({ partner: req.user._id }).distinct('donation')
    const availableTasks = isApprovedAccount(req.user) ? await Delivery.find({ status: 'assigned', partner: null }).distinct('donation') : []
    query._id = { $in: [...new Set([...assigned, ...availableTasks].map(String))] }
  }
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 100))
  const [rows, total] = await Promise.all([
    Donation.find(query).sort({ deadline: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Donation.countDocuments(query),
  ])
  res.json({ donations: rows.map(safeDonation), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
})

export const postDonations = asyncRoute(async (req, res) => {
  if (req.user.role !== 'donor' || !isApprovedAccount(req.user)) {
    const status = getVerificationStatus(req.user)
    const message = status === 'rejected'
      ? `Your donor application was rejected: ${req.user.verificationReason || 'review the account details and resubmit for verification.'}`
      : status === 'suspended'
        ? 'Your donor account is suspended and cannot publish listings.'
        : 'Your donor account is awaiting Admin review and cannot publish listings yet.'
    return res.status(403).json({ error: message, verificationStatus: status })
  }
  const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
  const title = typeof b.title === 'string' ? b.title.trim() : ''
  const description = typeof b.description === 'string' ? b.description.trim() : ''
  const storage = typeof b.storage === 'string' ? b.storage.trim() : ''
  const pickupAddress = typeof b.pickup?.address === 'string' ? b.pickup.address.trim() : ''
  const pickupLocality = typeof b.pickup?.locality === 'string' ? b.pickup.locality.trim() : ''
  const quantity = Number(b.quantity), portions = Number(b.portions)
  const unit = b.unit || 'portions'
  if (!title || title.length > 120 || !description || description.length > 1000 || !['Prepared meals', 'Bakery', 'Produce', 'Dairy', 'Packaged'].includes(b.category) || !['Vegetarian', 'Non-vegetarian', 'Vegan', 'Other'].includes(b.foodType) || !['portions', 'kg', 'boxes'].includes(unit) || !Number.isFinite(quantity) || quantity < 1 || (unit === 'portions' && !Number.isInteger(quantity)) || !Number.isInteger(portions) || portions < 1 || !isValidDate(b.preparedAt) || !isValidDate(b.deadline) || new Date(b.deadline) <= new Date() || !storage || storage.length > 300 || !pickupAddress || pickupAddress.length > 240 || !pickupLocality || pickupLocality.length > 100 || b.safety?.donorConfirmed !== true) {
    return res.status(400).json({ error: 'Complete every required field, confirm the listing is accurate, and set a future collection deadline.' })
  }
  if (new Date(b.preparedAt) > new Date()) return res.status(400).json({ error: 'Preparation time cannot be in the future.' })
  const point = b.pickup?.point
  if (point && (point.type !== 'Point' || !Array.isArray(point.coordinates) || point.coordinates.length !== 2 || !Number.isFinite(Number(point.coordinates[0])) || !Number.isFinite(Number(point.coordinates[1])) || Math.abs(Number(point.coordinates[0])) > 180 || Math.abs(Number(point.coordinates[1])) > 90)) return res.status(400).json({ error: 'Pickup coordinates must be a valid GeoJSON point.' })
  const donation = await Donation.create({
    donor: req.user._id, organization: req.user.organization || req.user.name,
    title, description, category: b.category, foodType: b.foodType,
    quantity, unit, portions, preparedAt: b.preparedAt, deadline: b.deadline,
    storage, handling: b.handling || '',
    pickup: { address: pickupAddress, locality: pickupLocality, point },
    safety: b.safety, status: 'available', safetyReview: { status: 'not_required' },
  })
  let matches = []
  try { matches = await findApprovedUsersByLocality('recipient', donation.pickup.locality) } catch { /* Keep the published listing available if notice lookup is temporarily unavailable. */ }
  const matchNotices = await Promise.allSettled(matches.map(user => notify(user._id, 'Food available in your area', `${donation.title} is available for a direct claim. Collect by ${new Date(donation.deadline).toLocaleString()}.`, '/app/donations')))
  const notifiedRecipients = matchNotices.filter(result => result.status === 'fulfilled').length
  await Promise.allSettled([notify(req.user._id, 'Listing published', notifiedRecipients
    ? `Your listing is available. ${notifiedRecipients} verified receiving partner${notifiedRecipients === 1 ? '' : 's'} in ${donation.pickup.locality} were notified.`
    : 'Your listing is available, but no verified receiving partner was notified for its pickup area. It will remain available.', `/donor/donations/${donation.id}`)])
  res.status(201).json({ donation: safeDonation(donation), matchedRecipients: notifiedRecipients })
})

export const postDonationClaim = asyncRoute(async (req, res) => {
  if (!isApprovedAccount(req.user)) return res.status(403).json({ error: 'Your Receiving Partner account must be approved before claiming food.', verificationStatus: getVerificationStatus(req.user) })
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Listing ID is invalid.' })

  const now = new Date()
  const candidate = await Donation.findById(req.params.id)
  if (!candidate || candidate.status !== 'available' || !isValidDate(candidate.deadline) || candidate.deadline <= now) return res.status(409).json({ error: 'This listing is no longer available to claim.' })
  if (candidate.safetyReview?.status && !['not_required', 'approved'].includes(candidate.safetyReview.status)) return res.status(409).json({ error: 'This listing is restricted from claims pending an authorized safety review.' })
  const categories = ['Prepared meals', 'Bakery', 'Produce', 'Dairy', 'Packaged']
  const foodTypes = ['Vegetarian', 'Non-vegetarian', 'Vegan', 'Other']
  const units = ['portions', 'kg', 'boxes']
  if (!candidate.safety?.donorConfirmed || !candidate.title?.trim() || !candidate.description?.trim() || !categories.includes(candidate.category) || !foodTypes.includes(candidate.foodType) || !units.includes(candidate.unit || 'portions') || !candidate.storage?.trim() || !candidate.pickup?.address?.trim() || !candidate.pickup?.locality?.trim() || !isValidDate(candidate.preparedAt) || candidate.preparedAt > now || !Number.isFinite(candidate.quantity) || candidate.quantity <= 0 || ((candidate.unit || 'portions') === 'portions' && !Number.isInteger(candidate.quantity)) || !Number.isInteger(candidate.portions) || candidate.portions <= 0) {
    return res.status(409).json({ error: 'This listing is missing current safety or pickup details and cannot be claimed.' })
  }
  if (req.user.locality?.trim() && candidate.pickup?.locality?.trim() && candidate.pickup.locality.trim().toLocaleLowerCase() !== req.user.locality.trim().toLocaleLowerCase()) {
    return res.status(403).json({ error: 'This listing is outside your organization’s service area.' })
  }
  const reservedQuantity = Number(candidate.reservedQuantity || 0)
  if (!Number.isFinite(reservedQuantity) || reservedQuantity !== 0 || reservedQuantity >= Number(candidate.quantity)) return res.status(409).json({ error: 'This listing has a reservation and cannot be claimed by another organization.' })
  const remaining = Number(candidate.quantity) - reservedQuantity
  if (!Number.isFinite(remaining) || remaining <= 0) return res.status(409).json({ error: 'No claimable quantity remains on this listing.' })

  const request = { recipient: req.user._id, quantity: remaining, note: 'Direct claim', status: 'accepted', createdAt: now }
  const claimed = await Donation.findOneAndUpdate(
    { _id: candidate._id, status: 'available', deadline: { $gt: now }, reservedQuantity },
    {
      $set: { status: 'reserved', reservedQuantity: candidate.quantity, claimedBy: req.user._id, claimedAt: now },
      $push: { requests: request },
    },
    { new: true, runValidators: true },
  )
  if (!claimed) return res.status(409).json({ error: 'Another organization claimed this listing, or its collection deadline passed. Refresh to see current availability.' })

  let delivery
  try {
    delivery = await Delivery.create({
      donation: claimed._id,
      donor: claimed.donor,
      recipient: req.user._id,
      partner: null,
      status: 'assigned',
      statusHistory: [{ status: 'assigned', actor: req.user._id, role: 'recipient', createdAt: now }],
    })
  } catch {
    await Donation.updateOne(
      { _id: claimed._id, status: 'reserved', claimedBy: req.user._id },
      {
        $set: { status: 'available', reservedQuantity: candidate.reservedQuantity || 0 },
        $unset: { claimedBy: 1, claimedAt: 1 },
        $pull: { requests: { recipient: req.user._id, status: 'accepted', note: 'Direct claim' } },
      },
    )
    return res.status(503).json({ error: 'The claim could not be connected to a delivery task. The listing has been released; please try again.' })
  }

  let partners = []
  try { partners = await findApprovedUsersByLocality('partner', claimed.pickup.locality) } catch { /* The unassigned task remains visible in the eligible task pool. */ }
  const partnerNotices = await Promise.allSettled(partners.map(partner => notify(partner._id, 'Delivery task available', `${claimed.title} needs collection in ${claimed.pickup.locality}. Accept the task if you can meet the pickup deadline.`, '/app/deliveries')))
  await Promise.allSettled([
    notify(claimed.donor, 'Donation claimed', `${req.user.organization || req.user.name} claimed ${claimed.title}. A delivery task is available to verified partners.`, `/app/deliveries`),
    notify(req.user._id, 'Claim confirmed', `${claimed.title} is reserved for your organization. Delivery partners in the pickup area have been notified.`, `/app/deliveries`),
  ])

  res.status(201).json({ donation: safeDonation(claimed), deliveryId: delivery.id, deliveryStatus: delivery.status, notifiedDeliveryPartners: partnerNotices.filter(result => result.status === 'fulfilled').length })
})

export const postDonationRequest = asyncRoute(async (_req, res) => res.status(410).json({ error: 'New donation requests are no longer accepted. Use the direct claim action to reserve an available listing.' }))

export const getRequests = asyncRoute(async (req, res) => {
  const q = req.user.role === 'admin' ? {} : req.user.role === 'donor'
    ? { donor: req.user._id }
    : { 'requests.recipient': req.user._id }
  const donations = await Donation.find(q).populate('donor', 'name organization').populate('requests.recipient', 'name organization locality').sort({ updatedAt: -1 }).limit(100)
  const requests = donations.flatMap(d => d.requests
    .filter(r => req.user.role === 'admin' || (req.user.role === 'donor' ? String(d.donor?._id || d.donor) === String(req.user._id) : String(r.recipient?._id || r.recipient) === String(req.user._id)))
    .map(r => ({ id: r.id, donationId: d.id, donationTitle: d.title, donorOrganization: d.organization, organization: r.recipient?.organization || r.recipient?.name || 'Receiving organization', recipient: r.recipient?._id || r.recipient, quantity: r.quantity, unit: d.unit, status: r.status, note: r.note, createdAt: r.createdAt })))
  res.json({ requests })
})

export const postDonationRequestResponse = asyncRoute(async (req, res) => {
  if (req.user.role !== 'admin' && !isApprovedAccount(req.user)) return res.status(403).json({ error: 'Your donor account needs Admin approval before responding to requests.' })
  const decision = req.body.decision
  if (!['accept', 'decline'].includes(decision)) return res.status(400).json({ error: 'Choose accept or decline.' })
  const donation = await Donation.findById(req.params.id)
  if (!donation || (req.user.role !== 'admin' && String(donation.donor) !== String(req.user._id))) return res.status(404).json({ error: 'Donation not found.' })
  const request = donation.requests.id(req.params.requestId)
  if (!request || request.status !== 'pending') return res.status(409).json({ error: 'This request has already been handled.' })
  if (decision === 'decline') {
    request.status = 'declined'; await donation.save()
    await notify(request.recipient, 'Request update', 'The donor could not accept this request.', '/recipient/requests')
    return res.json({ donation: safeDonation(donation) })
  }
  if (!canReserve({ status: donation.status, deadline: donation.deadline, quantity: donation.quantity, reservedQuantity: donation.reservedQuantity, requested: request.quantity })) return res.status(409).json({ error: 'The listing no longer has enough available quantity or has passed its collection deadline.' })
  const reserved = await Donation.findOneAndUpdate(
    { _id: donation._id, status: 'available', deadline: { $gt: new Date() }, $expr: { $lte: [{ $add: ['$reservedQuantity', request.quantity] }, '$quantity'] } },
    { $inc: { reservedQuantity: request.quantity }, $set: { status: 'reserved' } }, { new: true },
  )
  if (!reserved) return res.status(409).json({ error: 'The remaining quantity has changed. Review the request before trying again.' })
  const freshRequest = reserved.requests.id(req.params.requestId)
  if (!freshRequest || freshRequest.status !== 'pending') return res.status(409).json({ error: 'This request is no longer pending.' })
  freshRequest.status = 'accepted'
  await reserved.save()
  const delivery = await Delivery.create({ donation: reserved._id, donor: reserved.donor, recipient: freshRequest.recipient })
  await notify(freshRequest.recipient, 'Donation request accepted', 'The donor accepted your request. Delivery coordination can now begin.', `/recipient/tracking/${delivery.id}`)
  await notify(reserved.donor, 'Donation reserved', 'The request was accepted and a delivery record was created.', `/donor/tracking/${delivery.id}`)
  res.json({ donation: safeDonation(reserved), deliveryId: delivery.id })
})
