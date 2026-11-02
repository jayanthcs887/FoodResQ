import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { User, Donation, Notification } from '../src/models/index.js'
import { postAuthRegister, postAuthResubmission } from '../src/controllers/auth.controller.js'
import { decideVerificationRequest, getAdminVerificationRequests, reinstateAdminUser, suspendAdminUser } from '../src/controllers/admin.controller.js'
import { postDonations } from '../src/controllers/donations.controller.js'

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

const adminId = new mongoose.Types.ObjectId()
const applicantId = new mongoose.Types.ObjectId()

test('public registration refuses admin role before creating an account', async () => {
  const originalCreate = User.create
  let createCalled = false
  User.create = async () => { createCalled = true }
  try {
    const response = await invoke(postAuthRegister, { body: { name: 'Attempt', email: 'attempt@example.test', password: 'long-enough-password', role: 'admin' } })
    assert.equal(response.status, 400)
    assert.equal(createCalled, false)
  } finally { User.create = originalCreate }
})

test('verification requests can be filtered and admin decisions update only pending public accounts', async () => {
  const originalAggregate = User.aggregate
  const originalFindOneAndUpdate = User.findOneAndUpdate
  const originalNotificationCreate = Notification.create
  const calls = []
  User.aggregate = async pipeline => {
    assert.equal(pipeline[0].$match.role, 'donor')
    assert.equal(pipeline[1].$addFields.resolvedVerificationStatus !== undefined, true)
    return [{ _id: applicantId, name: 'Applicant', role: 'donor', verificationStatus: 'pending' }]
  }
  User.findOneAndUpdate = (filter, update) => {
    calls.push({ filter, update })
    return { select: async () => ({ _id: applicantId, name: 'Applicant', email: 'applicant@example.test', role: 'donor', verified: update.$set.verified, suspended: false, verificationStatus: update.$set.verificationStatus, verificationReason: update.$set.verificationReason }) }
  }
  Notification.create = async () => ({})
  try {
    const list = await invoke(getAdminVerificationRequests, { query: { role: 'donor', status: 'pending' } })
    assert.equal(list.status, 200)
    assert.equal(list.body.requests.length, 1)

    for (const [decision, reason] of [['approved', ''], ['rejected', 'Add your organization name.']]) {
      const response = await invoke(decideVerificationRequest, {
        params: { id: String(applicantId), decision }, body: { reason }, user: { _id: adminId, role: 'admin' },
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.user.verificationStatus, decision)
      assert.equal(calls.at(-1).filter.role.$in.includes('partner'), true)
      assert.equal(calls.at(-1).filter.$or[0].verificationStatus, 'pending')
      assert.equal(calls.at(-1).update.$set.verificationStatus, decision)
      assert.equal(calls.at(-1).update.$push.verificationHistory.$each[0].actor, adminId)
    }
    assert.equal(calls[1].update.$set.verificationReason, 'Add your organization name.')
  } finally {
    User.aggregate = originalAggregate
    User.findOneAndUpdate = originalFindOneAndUpdate
    Notification.create = originalNotificationCreate
  }
})

test('pending, rejected, and suspended donors cannot publish; approved donors pass the verification gate', async () => {
  const originalDonationCreate = Donation.create
  const originalNotificationCreate = Notification.create
  const originalUserFind = User.find
  let writes = 0
  Donation.create = async values => {
    writes += 1
    return { _id: new mongoose.Types.ObjectId(), id: 'listing-1', ...values, reservedQuantity: 0 }
  }
  Notification.create = async () => ({})
  User.find = () => ({ select: () => ({ lean: async () => [] }) })
  const validBody = {
    title: 'Fresh meals', description: 'Sealed meal portions', category: 'Prepared meals', foodType: 'Vegetarian',
    quantity: 6, portions: 6, preparedAt: new Date(Date.now() - 60_000), deadline: new Date(Date.now() + 3_600_000),
    storage: 'Chilled containers', pickup: { address: '1 Main Street', locality: 'Brooklyn' }, safety: { donorConfirmed: true },
  }
  try {
    for (const user of [
      { role: 'donor', verificationStatus: 'pending', verified: false },
      { role: 'donor', verificationStatus: 'rejected', verified: false, verificationReason: 'Correct your organization name.' },
      { role: 'donor', verificationStatus: 'suspended', suspended: true, verified: false },
    ]) {
      const response = await invoke(postDonations, { body: validBody, user: { _id: applicantId, ...user } })
      assert.equal(response.status, 403)
      assert.equal(response.body.verificationStatus, user.verificationStatus)
    }
    assert.equal(writes, 0)
    const approved = await invoke(postDonations, { body: validBody, user: { _id: applicantId, role: 'donor', verificationStatus: 'approved', verified: true, organization: 'Food Collective' } })
    assert.equal(approved.status, 201)
    assert.equal(approved.body.donation.status, 'available')
    assert.equal(approved.body.donation.safetyReview.status, 'not_required')
    assert.equal(approved.body.matchedRecipients, 0)
    assert.equal(writes, 1)
  } finally {
    Donation.create = originalDonationCreate
    Notification.create = originalNotificationCreate
    User.find = originalUserFind
  }
})

test('approved donors cannot publish listings with expired collection deadlines or future preparation times', async () => {
  const originalDonationCreate = Donation.create
  let writes = 0
  Donation.create = async () => { writes += 1 }
  const user = { _id: applicantId, role: 'donor', verificationStatus: 'approved', verified: true, organization: 'Food Collective' }
  const base = {
    title: 'Fresh meals', description: 'Sealed meal portions', category: 'Prepared meals', foodType: 'Vegetarian',
    quantity: 6, portions: 6, preparedAt: new Date(Date.now() - 60_000), deadline: new Date(Date.now() + 60_000),
    storage: 'Chilled containers', pickup: { address: '1 Main Street', locality: 'Brooklyn' }, safety: { donorConfirmed: true },
  }
  try {
    const expired = await invoke(postDonations, { body: { ...base, deadline: new Date(Date.now() - 60_000) }, user })
    const preparedInFuture = await invoke(postDonations, { body: { ...base, preparedAt: new Date(Date.now() + 60_000) }, user })
    assert.equal(expired.status, 400)
    assert.equal(preparedInFuture.status, 400)
    assert.equal(writes, 0)
  } finally { Donation.create = originalDonationCreate }
})

test('resubmission cannot change a pending account verification status', async () => {
  const originalFindOneAndUpdate = User.findOneAndUpdate
  let updateCalled = false
  User.findOneAndUpdate = async () => { updateCalled = true }
  try {
    const response = await invoke(postAuthResubmission, {
      body: { name: 'Applicant', organization: 'Food Collective', locality: 'Brooklyn' },
      user: { _id: applicantId, role: 'donor', verificationStatus: 'pending', verified: false },
    })
    assert.equal(response.status, 409)
    assert.equal(updateCalled, false)
  } finally { User.findOneAndUpdate = originalFindOneAndUpdate }
})

test('suspension records its reason and reinstatement restores the prior approved status', async () => {
  const originalFindOne = User.findOne
  const originalFindOneAndUpdate = User.findOneAndUpdate
  const originalNotificationCreate = Notification.create
  let account = {
    _id: applicantId, name: 'Applicant', email: 'applicant@example.test', role: 'donor',
    verificationStatus: 'approved', verified: true, suspended: false, verificationReason: '',
    statusBeforeSuspension: undefined, reasonBeforeSuspension: undefined, verificationHistory: [],
  }
  User.findOne = () => ({ select: async () => account })
  User.findOneAndUpdate = (_filter, update) => {
    account = { ...account, ...update.$set, verificationHistory: [...account.verificationHistory, ...update.$push.verificationHistory.$each] }
    for (const key of Object.keys(update.$unset || {})) delete account[key]
    return { select: async () => account }
  }
  Notification.create = async () => ({})
  try {
    const suspended = await invoke(suspendAdminUser, {
      params: { id: String(applicantId) }, body: { reason: 'Repeated unsafe conduct.' }, user: { _id: adminId, role: 'admin' },
    })
    assert.equal(suspended.status, 200)
    assert.equal(suspended.body.user.verificationStatus, 'suspended')
    assert.equal(account.verificationHistory.at(-1).reason, 'Repeated unsafe conduct.')

    const reinstated = await invoke(reinstateAdminUser, {
      params: { id: String(applicantId) }, body: {}, user: { _id: adminId, role: 'admin' },
    })
    assert.equal(reinstated.status, 200)
    assert.equal(reinstated.body.user.verificationStatus, 'approved')
    assert.equal(reinstated.body.user.verified, true)
    assert.equal(account.verificationHistory.at(-1).action, 'reinstated')
  } finally {
    User.findOne = originalFindOne
    User.findOneAndUpdate = originalFindOneAndUpdate
    Notification.create = originalNotificationCreate
  }
})
