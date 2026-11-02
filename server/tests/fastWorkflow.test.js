import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { Donation, Delivery, Notification, User } from '../src/models/index.js'
import { postDonationClaim, postDonationRequest } from '../src/controllers/donations.controller.js'
import { postDeliveryAccept, postDeliveryAssign, postDeliveryStatus } from '../src/controllers/deliveries.controller.js'

async function invoke(handler, req) {
  const result = { status: 200, body: undefined }
  let error
  const res = {
    status(code) { result.status = code; return this },
    json(body) { result.body = body; return this },
  }
  await handler(req, res, nextError => { error = nextError })
  if (error) throw error
  return result
}

function recipient(id = new mongoose.Types.ObjectId(), extras = {}) {
  return { _id: id, id, role: 'recipient', verificationStatus: 'approved', verified: true, organization: 'Harbor Table', locality: 'Brooklyn', ...extras }
}

function availableDonation(id = new mongoose.Types.ObjectId(), extras = {}) {
  return {
    _id: id,
    id: String(id),
    donor: new mongoose.Types.ObjectId(),
    title: 'Fresh meals',
    description: 'Sealed meal portions',
    category: 'Prepared meals',
    foodType: 'Vegetarian',
    status: 'available',
    quantity: 12,
    reservedQuantity: 0,
    portions: 12,
    deadline: new Date(Date.now() + 60_000),
    preparedAt: new Date(Date.now() - 60_000),
    storage: 'Chilled and sealed',
    pickup: { address: '1 Main Street', locality: 'Brooklyn' },
    safety: { donorConfirmed: true },
    safetyReview: { status: 'not_required' },
    requests: [],
    ...extras,
  }
}

test('pending and suspended recipients cannot claim food', async () => {
  const originalFindById = Donation.findById
  let readCount = 0
  Donation.findById = async () => { readCount += 1; return availableDonation() }
  try {
    for (const verificationStatus of ['pending', 'suspended']) {
      const response = await invoke(postDonationClaim, {
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: recipient(undefined, { verificationStatus, verified: false, suspended: verificationStatus === 'suspended' }),
      })
      assert.equal(response.status, 403)
      assert.equal(response.body.verificationStatus, verificationStatus)
    }
    assert.equal(readCount, 0)
  } finally { Donation.findById = originalFindById }
})

test('new listing requests are retired in favor of direct claims', async () => {
  const response = await invoke(postDonationRequest, { params: { id: new mongoose.Types.ObjectId().toString() }, body: { quantity: 1 }, user: recipient() })
  assert.equal(response.status, 410)
  assert.match(response.body.error, /direct claim/i)
})

test('expired and restricted listings cannot be claimed', async () => {
  const originalFindById = Donation.findById
  const originalUpdate = Donation.findOneAndUpdate
  let updateCount = 0
  const id = new mongoose.Types.ObjectId()
  let candidate = availableDonation(id, { deadline: new Date(Date.now() - 1) })
  Donation.findById = async () => candidate
  Donation.findOneAndUpdate = async () => { updateCount += 1; return null }
  try {
    const expired = await invoke(postDonationClaim, { params: { id: String(id) }, user: recipient() })
    candidate = availableDonation(id, { safetyReview: { status: 'rejected' } })
    const restricted = await invoke(postDonationClaim, { params: { id: String(id) }, user: recipient() })
    assert.equal(expired.status, 409)
    assert.equal(restricted.status, 409)
    assert.equal(updateCount, 0)
  } finally {
    Donation.findById = originalFindById
    Donation.findOneAndUpdate = originalUpdate
  }
})

test('two simultaneous partner claims cannot reserve the same listing', async () => {
  const originalDonationFindById = Donation.findById
  const originalDonationUpdate = Donation.findOneAndUpdate
  const originalDeliveryCreate = Delivery.create
  const originalUserFind = User.find
  const originalNotificationCreate = Notification.create
  const listing = availableDonation()
  let deliveryWrites = 0
  let createdDelivery
  Donation.findById = async () => listing
  Donation.findOneAndUpdate = async (filter, update) => {
    if (String(filter._id) !== String(listing._id) || listing.status !== 'available' || listing.deadline <= filter.deadline.$gt || listing.deadline <= new Date()) return null
    if (Number(listing.reservedQuantity || 0) !== Number(filter.reservedQuantity)) return null
    listing.status = update.$set.status
    listing.reservedQuantity = update.$set.reservedQuantity
    listing.claimedBy = update.$set.claimedBy
    listing.claimedAt = update.$set.claimedAt
    listing.requests.push(update.$push.requests)
    return listing
  }
  Delivery.create = async values => { deliveryWrites += 1; createdDelivery = values; return { _id: new mongoose.Types.ObjectId(), id: 'delivery-1', ...values } }
  User.find = () => ({ select: () => ({ lean: async () => [] }) })
  Notification.create = async () => ({})
  try {
    const first = recipient(new mongoose.Types.ObjectId(), { organization: 'Harbor Table' })
    const second = recipient(new mongoose.Types.ObjectId(), { organization: 'North Shelter' })
    const [one, two] = await Promise.all([
      invoke(postDonationClaim, { params: { id: String(listing._id) }, user: first }),
      invoke(postDonationClaim, { params: { id: String(listing._id) }, user: second }),
    ])
    assert.deepEqual([one.status, two.status].sort(), [201, 409], JSON.stringify([one, two]))
    assert.equal(deliveryWrites, 1)
    assert.equal(createdDelivery.status, 'assigned')
    assert.equal(createdDelivery.partner, null)
    assert.equal(listing.status, 'reserved')
    assert.equal(listing.requests.length, 1)
  } finally {
    Donation.findById = originalDonationFindById
    Donation.findOneAndUpdate = originalDonationUpdate
    Delivery.create = originalDeliveryCreate
    User.find = originalUserFind
    Notification.create = originalNotificationCreate
  }
})

test('two simultaneous delivery acceptances assign a task only once', async () => {
  const originalFind = Delivery.find
  const originalFindOne = Delivery.findOne
  const originalFindOneAndUpdate = Delivery.findOneAndUpdate
  const originalNotificationCreate = Notification.create
  const deliveryId = new mongoose.Types.ObjectId()
  const task = {
    _id: deliveryId,
    id: String(deliveryId),
    status: 'assigned',
    partner: null,
    donor: new mongoose.Types.ObjectId(),
    recipient: new mongoose.Types.ObjectId(),
    donation: { deadline: new Date(Date.now() + 60_000), pickup: { locality: 'Brooklyn' } },
  }
  Delivery.find = () => ({ populate: () => ({ limit: async () => [] }) })
  Delivery.findOne = () => ({ populate: async () => task.status === 'assigned' && !task.partner ? task : null })
  Delivery.findOneAndUpdate = async (filter, update) => {
    if (task.status !== filter.status || task.partner !== filter.partner) return null
    task.partner = update.$set.partner
    task.status = update.$set.status
    task.assignmentHistory = [update.$push.assignmentHistory]
    task.statusHistory = [update.$push.statusHistory]
    return task
  }
  Notification.create = async () => ({})
  try {
    const first = { _id: new mongoose.Types.ObjectId(), id: new mongoose.Types.ObjectId(), role: 'partner', verificationStatus: 'approved', locality: 'Brooklyn' }
    const second = { _id: new mongoose.Types.ObjectId(), id: new mongoose.Types.ObjectId(), role: 'partner', verificationStatus: 'approved', locality: 'Brooklyn' }
    const [one, two] = await Promise.all([
      invoke(postDeliveryAccept, { params: { id: String(deliveryId) }, user: first }),
      invoke(postDeliveryAccept, { params: { id: String(deliveryId) }, user: second }),
    ])
    assert.deepEqual([one.status, two.status].sort(), [200, 409])
    assert.equal(task.status, 'to_pickup')
    assert.equal(task.assignmentHistory.length, 1)
  } finally {
    Delivery.find = originalFind
    Delivery.findOne = originalFindOne
    Delivery.findOneAndUpdate = originalFindOneAndUpdate
    Notification.create = originalNotificationCreate
  }
})

test('Admin can reassign a not-yet-picked-up task with a recorded reason', async () => {
  const originalFind = Delivery.find
  const originalFindOne = Delivery.findOne
  const originalFindOneAndUpdate = Delivery.findOneAndUpdate
  const originalUserFindOne = User.findOne
  const originalNotificationCreate = Notification.create
  const deliveryId = new mongoose.Types.ObjectId()
  const oldPartner = new mongoose.Types.ObjectId()
  const nextPartner = { _id: new mongoose.Types.ObjectId(), role: 'partner', verificationStatus: 'approved', verified: true, suspended: false }
  const task = {
    _id: deliveryId,
    id: String(deliveryId),
    status: 'to_pickup',
    partner: oldPartner,
    donor: new mongoose.Types.ObjectId(),
    recipient: new mongoose.Types.ObjectId(),
    donation: { deadline: new Date(Date.now() + 60_000) },
  }
  Delivery.find = () => ({ populate: () => ({ limit: async () => [] }) })
  Delivery.findOne = () => ({ populate: async () => task })
  Delivery.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter.status, 'to_pickup')
    assert.equal(String(filter.partner), String(oldPartner))
    task.partner = update.$set.partner
    task.assignmentHistory = [update.$push.assignmentHistory]
    task.statusHistory = [update.$push.statusHistory]
    return task
  }
  User.findOne = async () => nextPartner
  Notification.create = async () => ({})
  try {
    const response = await invoke(postDeliveryAssign, {
      params: { id: String(deliveryId) },
      body: { partnerId: String(nextPartner._id), reason: 'Original partner account was suspended before pickup.' },
      user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
    })
    assert.equal(response.status, 200)
    assert.equal(String(task.partner), String(nextPartner._id))
    assert.equal(task.assignmentHistory[0].method, 'admin_override')
    assert.equal(task.assignmentHistory[0].reason, 'Original partner account was suspended before pickup.')
  } finally {
    Delivery.find = originalFind
    Delivery.findOne = originalFindOne
    Delivery.findOneAndUpdate = originalFindOneAndUpdate
    User.findOne = originalUserFindOne
    Notification.create = originalNotificationCreate
  }
})

test('a recipient cannot move another organization’s delivery to delivered', async () => {
  const originalFindById = Delivery.findById
  const originalUpdate = Delivery.findOneAndUpdate
  let writes = 0
  const delivery = {
    _id: new mongoose.Types.ObjectId(),
    id: 'private-delivery',
    status: 'at_destination',
    donor: new mongoose.Types.ObjectId(),
    recipient: new mongoose.Types.ObjectId(),
    partner: new mongoose.Types.ObjectId(),
    donation: { portions: 10 },
  }
  Delivery.findById = () => ({ populate: async () => delivery })
  Delivery.findOneAndUpdate = async () => { writes += 1; return null }
  try {
    const response = await invoke(postDeliveryStatus, {
      params: { id: String(delivery._id) },
      body: { status: 'delivered', confirmed: true, quantity: 10 },
      user: recipient(),
    })
    assert.equal(response.status, 404)
    assert.equal(writes, 0)
  } finally {
    Delivery.findById = originalFindById
    Delivery.findOneAndUpdate = originalUpdate
  }
})
