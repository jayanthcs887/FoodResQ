import { User } from '../models/index.js'

const approvedAccountFilter = {
  suspended: { $ne: true },
  $or: [
    { verificationStatus: 'approved' },
    { verificationStatus: { $exists: false }, verified: true },
  ],
}

export const sameLocality = (left, right) => Boolean(
  String(left || '').trim()
  && String(right || '').trim()
  && String(left).trim().toLocaleLowerCase() === String(right).trim().toLocaleLowerCase(),
)

export async function findApprovedUsersByLocality(role, locality) {
  const area = String(locality || '').trim()
  if (!area) return []
  const escaped = area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return User.find({
    role,
    locality: new RegExp(`^${escaped}$`, 'i'),
    ...approvedAccountFilter,
  }).select('_id locality').lean()
}
