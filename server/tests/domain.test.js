import test from 'node:test'
import assert from 'node:assert/strict'
import { canDistribute, canReserve, canViewDelivery, deliveryTransitions, isSupportedRole, PUBLIC_ROLES, SUPPORTED_ROLES, validCoordinates } from '../src/domain.js'
import { allow, issueSession, requireSameOrigin } from '../src/middleware/auth.js'
import User from '../src/models/User.js'
import { getVerificationStatus, isApprovedAccount } from '../src/services/verification.js'
import { safeUser } from '../src/utils/serializers.js'
import { CLIENT_ORIGIN } from '../src/config/env.js'

test('only the three public roles and separately provisioned admin are supported', () => {
  assert.deepEqual(PUBLIC_ROLES, ['donor', 'recipient', 'partner'])
  assert.deepEqual(SUPPORTED_ROLES, ['donor', 'recipient', 'partner', 'admin'])
  assert.deepEqual(User.schema.path('role').enumValues, [...SUPPORTED_ROLES])
  assert.equal(isSupportedRole('community'), false)
  assert.equal(isSupportedRole('admin'), true)
})

test('API role guards reject removed roles and keep admin-only access separate', () => {
  const check = (role, ...allowedRoles) => {
    const result = { calledNext: false, status: null }
    const response = {
      status(code) { result.status = code; return this },
      json() { return this },
    }
    allow(...allowedRoles)({ user: { role } }, response, () => { result.calledNext = true })
    return result
  }

  assert.equal(check('recipient', 'recipient').calledNext, true)
  assert.equal(check('community', 'recipient').status, 403)
  assert.equal(check('donor', 'admin').status, 403)
  assert.equal(check('admin', 'admin').calledNext, true)
  assert.throws(() => issueSession({ id: 'legacy-user', role: 'community' }), /unsupported role/)
})

test('verification status resolves new and legacy account flags without approving unverified users', () => {
  assert.equal(getVerificationStatus({ verificationStatus: 'pending', verified: false }), 'pending')
  assert.equal(getVerificationStatus({ verificationStatus: 'approved', verified: true }), 'approved')
  assert.equal(getVerificationStatus({ verificationStatus: 'rejected', verified: false }), 'rejected')
  assert.equal(getVerificationStatus({ verificationStatus: 'suspended', suspended: true }), 'suspended')
  assert.equal(getVerificationStatus({ verified: true }), 'approved')
  assert.equal(getVerificationStatus({ verified: false }), 'pending')
  assert.equal(isApprovedAccount({ verificationStatus: 'approved', verified: true }), true)
  assert.equal(isApprovedAccount({ verificationStatus: 'pending', verified: true }), false)
  assert.equal(isApprovedAccount({ verificationStatus: 'rejected', verified: false }), false)
  assert.equal(isApprovedAccount({ suspended: true, verified: true }), false)
})

test('safe account responses expose verification state without private credential fields', () => {
  const user = safeUser({ _id: 'user-1', name: 'Applicant', email: 'person@example.test', role: 'donor', passwordHash: 'secret', verified: false, suspended: false, verificationStatus: 'rejected', verificationReason: 'Add an organization name.' })
  assert.equal(user.verificationStatus, 'rejected')
  assert.equal(user.verificationReason, 'Add an organization name.')
  assert.equal(user.passwordHash, undefined)
})

test('cookie-backed state changes reject cross-origin browser requests', () => {
  const check = (origin, fetchSite) => {
    const result = { next: false, status: null }
    const response = {
      status(code) { result.status = code; return this },
      json() { return this },
    }
    const request = { get: name => name === 'origin' ? origin : fetchSite }
    requireSameOrigin(request, response, () => { result.next = true })
    return result
  }
  assert.equal(check(CLIENT_ORIGIN, 'same-origin').next, true)
  assert.equal(check('https://attacker.example', 'cross-site').status, 403)
  assert.equal(check(undefined, 'cross-site').status, 403)
})

test('reservation eligibility rejects expired, unavailable and over-capacity requests', () => {
  const now = new Date('2026-10-13T10:00:00Z')
  const common = { deadline: '2026-10-13T11:00:00Z', quantity: 24, reservedQuantity: 8, requested: 16, now }
  assert.equal(canReserve({ ...common, status: 'available' }), true)
  assert.equal(canReserve({ ...common, status: 'reserved' }), false)
  assert.equal(canReserve({ ...common, status: 'available', requested: 17 }), false)
  assert.equal(canReserve({ ...common, status: 'available', deadline: '2026-10-13T09:59:00Z' }), false)
})

test('distribution reports are whole portions and cannot exceed delivered food', () => {
  assert.equal(canDistribute({ delivered: 20, distributed: 5, requested: 15 }), true)
  assert.equal(canDistribute({ delivered: 20, distributed: 5, requested: 16 }), false)
  assert.equal(canDistribute({ delivered: 20, distributed: 0, requested: 1.5 }), false)
  assert.equal(canDistribute({ delivered: 20, distributed: -1, requested: 1 }), false)
})

test('delivery access is limited to the donor, recipient, assigned partner or admin', () => {
  const delivery = { donor: 'donor-1', recipient: 'recipient-1', partner: 'partner-1' }
  assert.equal(canViewDelivery(delivery, { id: 'donor-1', role: 'donor' }), true)
  assert.equal(canViewDelivery(delivery, { id: 'recipient-1', role: 'recipient' }), true)
  assert.equal(canViewDelivery(delivery, { id: 'partner-1', role: 'partner' }), true)
  assert.equal(canViewDelivery(delivery, { id: 'stranger', role: 'recipient' }), false)
  assert.equal(canViewDelivery(delivery, { id: 'ops-1', role: 'admin' }), true)
})

test('trip transitions are explicit and role-specific', () => {
  assert.deepEqual(deliveryTransitions.collected.from, ['at_pickup'])
  assert.equal(deliveryTransitions.collected.role, 'donor')
  assert.deepEqual(deliveryTransitions.delivered.roles, ['recipient'])
  assert.equal(deliveryTransitions.cancelled, undefined)
})

test('location updates must be valid geographic coordinates with bounded accuracy', () => {
  assert.equal(validCoordinates(40.7, -73.9, 25), true)
  assert.equal(validCoordinates(91, -73.9, 25), false)
  assert.equal(validCoordinates(40.7, 181, 25), false)
  assert.equal(validCoordinates(40.7, -73.9, 1200), false)
})

