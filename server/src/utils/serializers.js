import { getVerificationStatus } from '../services/verification.js'

export const safeUser = user => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  organization: user.organization,
  locality: user.locality,
  verified: getVerificationStatus(user) === 'approved',
  suspended: Boolean(user.suspended || user.verificationStatus === 'suspended'),
  verificationStatus: getVerificationStatus(user),
  verificationReason: user.verificationReason || '',
})

export const isValidDate = value => value && !Number.isNaN(new Date(value).getTime())

export const safeDonation = donation => ({
  id: donation._id,
  title: donation.title,
  description: donation.description,
  organization: donation.organization,
  category: donation.category,
  foodType: donation.foodType,
  quantity: donation.quantity,
  unit: donation.unit,
  portions: donation.portions,
  remaining: Math.max(0, donation.quantity - donation.reservedQuantity),
  deadline: donation.deadline,
  preparedAt: donation.preparedAt,
  storage: donation.storage,
  handling: donation.handling,
  pickup: donation.pickup,
  status: donation.status,
  safety: donation.safety,
  safetyReview: donation.safetyReview && {
    status: donation.safetyReview.status,
    reviewedAt: donation.safetyReview.reviewedAt,
    reason: donation.safetyReview.reason,
  },
  donor: donation.donor,
})
