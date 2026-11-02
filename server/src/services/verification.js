export const VERIFICATION_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'suspended'])
export const DECIDABLE_STATUSES = Object.freeze(['pending', 'approved', 'rejected'])

export function getVerificationStatus(user) {
  if (user?.suspended || user?.verificationStatus === 'suspended') return 'suspended'
  if (DECIDABLE_STATUSES.includes(user?.verificationStatus)) return user.verificationStatus
  return user?.verified ? 'approved' : 'pending'
}

export function isApprovedAccount(user) {
  return getVerificationStatus(user) === 'approved' && !user?.suspended
}

export const verificationStatusExpression = {
  $switch: {
    branches: [
      { case: { $or: [{ $eq: ['$suspended', true] }, { $eq: ['$verificationStatus', 'suspended'] }] }, then: 'suspended' },
      { case: { $in: ['$verificationStatus', DECIDABLE_STATUSES] }, then: '$verificationStatus' },
      { case: { $eq: ['$verified', true] }, then: 'approved' },
    ],
    default: 'pending',
  },
}
