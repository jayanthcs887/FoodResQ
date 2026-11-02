import mongoose from 'mongoose'
import { User, Donation, Delivery, Incident } from '../models/index.js'
import { asyncRoute } from '../utils/asyncRoute.js'
import { safeUser, safeDonation } from '../utils/serializers.js'
import { notify } from '../services/notifications.js'
import { PUBLIC_ROLES } from '../domain.js'
import { DECIDABLE_STATUSES, VERIFICATION_STATUSES, getVerificationStatus, verificationStatusExpression } from '../services/verification.js'
import { expirePastUnassignedDeliveryTasks } from '../services/deliveryTasks.js'

const publicUserFilter = { role: { $in: PUBLIC_ROLES } }
const activeDeliveryStatuses = ['assigned', 'to_pickup', 'at_pickup', 'collected', 'in_transit', 'at_destination']
const auditLimit = 100

function userIdFromRequest(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Account ID is invalid.' })
    return null
  }
  return new mongoose.Types.ObjectId(req.params.id)
}

function verificationRequestPipeline(role, status) {
  const pipeline = [
    { $match: { ...publicUserFilter, ...(role ? { role } : {}) } },
    { $addFields: { resolvedVerificationStatus: verificationStatusExpression, resolvedSubmittedAt: { $ifNull: ['$verificationSubmittedAt', '$createdAt'] } } },
    ...(status && status !== 'all' ? [{ $match: { resolvedVerificationStatus: status } }] : []),
    { $sort: { resolvedSubmittedAt: -1 } },
    { $limit: 300 },
    { $project: {
      _id: 1, name: 1, email: 1, organization: 1, locality: 1, role: 1, verified: 1, suspended: 1,
      verificationStatus: '$resolvedVerificationStatus', verificationReason: 1, reviewedBy: 1, reviewedAt: 1,
      submittedAt: '$resolvedSubmittedAt', createdAt: 1, updatedAt: 1,
    } },
  ]
  return pipeline
}

function decisionStatusFilter(id) {
  return {
    _id: id,
    ...publicUserFilter,
    suspended: { $ne: true },
    $or: [
      { verificationStatus: 'pending' },
      { verificationStatus: { $exists: false }, verified: { $ne: true } },
    ],
  }
}

function auditEntry(action, fromStatus, toStatus, reason, actor) {
  return { action, fromStatus, toStatus, reason, actor, createdAt: new Date() }
}

async function sendAccountNotice(userId, title, message) {
  try { await notify(userId, title, message, '/settings') }
  catch (error) { console.warn('Could not create verification notification:', error.message) }
}

export const getAdminDashboard = asyncRoute(async (_req, res) => {
  await Donation.updateMany({ status: 'available', deadline: { $lte: new Date() } }, { $set: { status: 'expired' } })
  await expirePastUnassignedDeliveryTasks()
  const [users, totalRegisteredUsers, listingStatuses, totalFoodListings, activeDeliveries, availableListings, claimedDonations, pendingDeliveryTasks, completedDeliveries, recentRaw] = await Promise.all([
    User.aggregate([
      { $match: publicUserFilter },
      { $addFields: { resolvedVerificationStatus: verificationStatusExpression } },
      { $group: { _id: '$resolvedVerificationStatus', count: { $sum: 1 }, total: { $sum: 1 } } },
    ]),
    User.countDocuments(),
    Donation.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Donation.countDocuments(),
    Delivery.countDocuments({ status: { $in: activeDeliveryStatuses } }),
    Donation.countDocuments({ status: 'available', deadline: { $gt: new Date() } }),
    Donation.countDocuments({ status: 'reserved' }),
    Delivery.countDocuments({ status: 'assigned', partner: null }),
    Delivery.countDocuments({ status: 'delivered' }),
    User.aggregate([
      { $match: { ...publicUserFilter, 'verificationHistory.0': { $exists: true } } },
      { $unwind: '$verificationHistory' },
      { $sort: { 'verificationHistory.createdAt': -1 } },
      { $limit: 8 },
      { $project: {
        _id: 0, userId: '$_id', name: 1, organization: 1, role: 1,
        action: '$verificationHistory.action', fromStatus: '$verificationHistory.fromStatus',
        toStatus: '$verificationHistory.toStatus', reason: '$verificationHistory.reason',
        actorId: '$verificationHistory.actor', createdAt: '$verificationHistory.createdAt',
      } },
    ]),
  ])
  const reviewerIds = recentRaw.map(event => event.actorId).filter(Boolean)
  const reviewers = await User.find({ _id: { $in: reviewerIds } }).select('name').lean()
  const reviewerNames = new Map(reviewers.map(reviewer => [String(reviewer._id), reviewer.name]))
  const activity = recentRaw.map(event => ({
    ...event,
    actor: event.actorId ? { id: event.actorId, name: reviewerNames.get(String(event.actorId)) || 'Administrator' } : null,
    actorId: undefined,
  }))
  const verificationCounts = Object.fromEntries(VERIFICATION_STATUSES.map(status => [status, 0]))
  for (const row of users) verificationCounts[row._id] = row.count
  const listingsByStatus = Object.fromEntries(listingStatuses.map(row => [row._id, row.count]))
  res.json({
    summary: {
      totalUsers: totalRegisteredUsers,
      ...verificationCounts,
      totalFoodListings,
      activeDeliveries,
      availableListings,
      claimedDonations,
      pendingDeliveryTasks,
      completedDeliveries,
    },
    listingStatuses: listingsByStatus,
    recentActivity: activity,
  })
})

export const getAdminVerificationRequests = asyncRoute(async (req, res) => {
  const role = String(req.query.role || '')
  const status = String(req.query.status || 'pending')
  if (role && !PUBLIC_ROLES.includes(role)) return res.status(400).json({ error: 'Choose a supported public account role.' })
  if (!['all', ...VERIFICATION_STATUSES].includes(status)) return res.status(400).json({ error: 'Choose a valid verification status.' })
  const requests = await User.aggregate(verificationRequestPipeline(role, status))
  res.json({ requests })
})

export const getAdminVerificationRequest = asyncRoute(async (req, res) => {
  const id = userIdFromRequest(req, res)
  if (!id) return
  const user = await User.findOne({ _id: id, ...publicUserFilter })
    .select('-passwordHash')
    .populate('reviewedBy', 'name')
    .populate('verificationHistory.actor', 'name')
    .lean()
  if (!user) return res.status(404).json({ error: 'Verification request not found.' })
  res.json({ request: {
    id: user._id,
    name: user.name,
    email: user.email,
    organization: user.organization || '',
    locality: user.locality || '',
    role: user.role,
    verificationStatus: getVerificationStatus(user),
    verificationReason: user.verificationReason || '',
    reviewer: user.reviewedBy ? { id: user.reviewedBy._id, name: user.reviewedBy.name } : null,
    reviewedAt: user.reviewedAt || null,
    submittedAt: user.verificationSubmittedAt || user.createdAt,
    updatedAt: user.updatedAt,
    verificationHistory: (user.verificationHistory || []).map(event => ({
      action: event.action,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      reason: event.reason,
      actor: event.actor ? { id: event.actor._id, name: event.actor.name } : null,
      createdAt: event.createdAt,
    })).reverse(),
  } })
})

export const decideVerificationRequest = asyncRoute(async (req, res) => {
  const id = userIdFromRequest(req, res)
  if (!id) return
  const decision = req.params.decision
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Choose approve or reject.' })
  const reason = String(req.body?.reason || '').trim()
  if ((decision === 'rejected' && (reason.length < 3 || reason.length > 500)) || reason.length > 500) {
    return res.status(400).json({ error: decision === 'rejected' ? 'A rejection reason of 3 to 500 characters is required.' : 'The note must be 500 characters or fewer.' })
  }
  const event = auditEntry(decision, 'pending', decision, reason, req.user._id)
  const user = await User.findOneAndUpdate(
    decisionStatusFilter(id),
    { $set: { verificationStatus: decision, verified: decision === 'approved', verificationReason: decision === 'rejected' ? reason : '', reviewedBy: req.user._id, reviewedAt: event.createdAt }, $push: { verificationHistory: { $each: [event], $slice: -auditLimit } } },
    { new: true, runValidators: true },
  ).select('-passwordHash')
  if (!user) return res.status(409).json({ error: 'This request is no longer pending. Refresh the list to see its current status.' })
  await sendAccountNotice(user._id, decision === 'approved' ? 'Account approved' : 'Application needs changes', decision === 'approved' ? 'Your account is approved for its role-specific workflows.' : `Your application was not approved: ${reason}`)
  res.json({ user: safeUser(user) })
})

async function setAccountSuspension(req, res, suspend) {
  const id = userIdFromRequest(req, res)
  if (!id) return
  const user = await User.findOne({ _id: id, ...publicUserFilter }).select('-passwordHash')
  if (!user) return res.status(404).json({ error: 'Account not found.' })
  const fromStatus = getVerificationStatus(user)
  const reason = String(req.body?.reason || '').trim()

  if (suspend) {
    if (reason.length < 3 || reason.length > 500) return res.status(400).json({ error: 'A suspension reason of 3 to 500 characters is required.' })
    if (fromStatus === 'suspended') return res.status(409).json({ error: 'This account is already suspended.' })
    const event = auditEntry('suspended', fromStatus, 'suspended', reason, req.user._id)
    const updated = await User.findOneAndUpdate(
      { _id: id, ...publicUserFilter, suspended: { $ne: true }, ...(user.verificationStatus ? { verificationStatus: user.verificationStatus } : { verificationStatus: { $exists: false }, verified: Boolean(user.verified) }) },
      { $set: { verificationStatus: 'suspended', statusBeforeSuspension: fromStatus, reasonBeforeSuspension: user.verificationReason || '', suspended: true, verified: false, verificationReason: reason, reviewedBy: req.user._id, reviewedAt: event.createdAt }, $push: { verificationHistory: { $each: [event], $slice: -auditLimit } } },
      { new: true, runValidators: true },
    ).select('-passwordHash')
    if (!updated) return res.status(409).json({ error: 'This account changed while you were reviewing it. Refresh and try again.' })
    await sendAccountNotice(updated._id, 'Account suspended', 'Your account is suspended. Contact platform support if you believe this is an error.')
    return res.json({ user: safeUser(updated) })
  }

  if (fromStatus !== 'suspended') return res.status(409).json({ error: 'This account is not suspended.' })
  const restoreStatus = DECIDABLE_STATUSES.includes(user.statusBeforeSuspension)
    ? user.statusBeforeSuspension
    : (user.verified ? 'approved' : 'pending')
  const restoreReason = user.reasonBeforeSuspension || ''
  const event = auditEntry('reinstated', 'suspended', restoreStatus, reason, req.user._id)
  const updated = await User.findOneAndUpdate(
    { _id: id, ...publicUserFilter, $or: [{ suspended: true }, { verificationStatus: 'suspended' }] },
    { $set: { verificationStatus: restoreStatus, verified: restoreStatus === 'approved', suspended: false, verificationReason: restoreReason, reviewedBy: req.user._id, reviewedAt: event.createdAt }, $unset: { statusBeforeSuspension: 1, reasonBeforeSuspension: 1 }, $push: { verificationHistory: { $each: [event], $slice: -auditLimit } } },
    { new: true, runValidators: true },
  ).select('-passwordHash')
  if (!updated) return res.status(409).json({ error: 'This account changed while you were reviewing it. Refresh and try again.' })
  await sendAccountNotice(updated._id, 'Account restored', 'Your account is no longer suspended. Its previous verification status has been restored.')
  return res.json({ user: safeUser(updated) })
}

export const suspendAdminUser = asyncRoute((req, res) => setAccountSuspension(req, res, true))
export const reinstateAdminUser = asyncRoute((req, res) => setAccountSuspension(req, res, false))

export const getAdminUsers = asyncRoute(async (_req, res) => {
  const users = await User.find(publicUserFilter).select('-passwordHash').sort({ createdAt: -1 }).limit(300).lean()
  res.json({ users: users.map(user => ({ ...safeUser(user), createdAt: user.createdAt, submittedAt: user.verificationSubmittedAt || user.createdAt, updatedAt: user.updatedAt, reviewedAt: user.reviewedAt || null, reviewedBy: user.reviewedBy || null })) })
})

export const patchAdminUser = asyncRoute(async (req, res) => {
  if (Object.hasOwn(req.body || {}, 'verified') || Object.hasOwn(req.body || {}, 'verificationStatus')) {
    return res.status(400).json({ error: 'Use the verification decision actions to change verification status.' })
  }
  if (typeof req.body?.suspended !== 'boolean') return res.status(400).json({ error: 'A valid suspend action is required.' })
  return setAccountSuspension(req, res, req.body.suspended)
})

export const patchAdminDonationReview = asyncRoute(async (req, res) => {
  const { decision, reason = '' } = req.body
  if (!['approve', 'reject', 'restrict'].includes(decision) || (['reject', 'restrict'].includes(decision) && String(reason).trim().length < 3) || String(reason).length > 500) return res.status(400).json({ error: 'Choose a valid moderation action and include a reason of 3 to 500 characters.' })
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Listing ID is invalid.' })
  if (decision === 'restrict') {
    const reviewedAt = new Date()
    const restricted = await Donation.findOneAndUpdate(
      { _id: req.params.id, status: 'available' },
      { $set: { status: 'rejected', 'safetyReview.status': 'rejected', 'safetyReview.reviewedBy': req.user._id, 'safetyReview.reviewedAt': reviewedAt, 'safetyReview.reason': String(reason).trim() } },
      { new: true, runValidators: true },
    )
    if (!restricted) return res.status(409).json({ error: 'Only an available listing can be restricted. Refresh to see its current status.' })
    await sendAccountNotice(restricted.donor, 'Listing restricted', `An administrator restricted your listing: ${String(reason).trim().slice(0, 280)}`)
    return res.json({ donation: safeDonation(restricted) })
  }
  const donation = await Donation.findOne({ _id: req.params.id, status: 'needs_review' })
  if (!donation) return res.status(404).json({ error: 'There is no pending safety review for this listing.' })
  if (decision === 'approve' && donation.deadline <= new Date()) return res.status(409).json({ error: 'The collection deadline has passed; this listing cannot be approved.' })
  donation.status = decision === 'approve' ? 'available' : 'rejected'
  donation.safetyReview = { status: decision === 'approve' ? 'approved' : 'rejected', reviewedBy: req.user._id, reviewedAt: new Date(), reason: String(reason).slice(0, 500) }
  await donation.save()
  await sendAccountNotice(donation.donor, decision === 'approve' ? 'Listing approved' : 'Listing needs attention', decision === 'approve' ? 'Your listing is visible to eligible organizations.' : `Your listing was not approved: ${String(reason).slice(0, 280)}`)
  res.json({ donation: safeDonation(donation) })
})

export const getAdminIncidents = asyncRoute(async (_req, res) => {
  const incidents = await Incident.find().populate('reporter', 'name organization').sort({ createdAt: -1 }).limit(300)
  res.json({ incidents })
})

export const patchAdminIncident = asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Incident ID is invalid.' })
  if (!['open', 'reviewing', 'resolved'].includes(req.body.status)) return res.status(400).json({ error: 'Choose a valid incident state.' })
  const incident = await Incident.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true })
  if (!incident) return res.status(404).json({ error: 'Incident not found.' })
  res.json({ incident })
})
