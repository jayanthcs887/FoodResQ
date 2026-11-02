import mongoose from 'mongoose'
import { SUPPORTED_ROLES } from '../domain.js'
import { VERIFICATION_STATUSES } from '../services/verification.js'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: SUPPORTED_ROLES, required: true },
  organization: { type: String, trim: true, maxlength: 120 },
  locality: { type: String, trim: true, maxlength: 100 },
  verified: { type: Boolean, default: false },
  suspended: { type: Boolean, default: false },
  // No schema default: legacy records derive status from verified/suspended.
  verificationStatus: { type: String, enum: VERIFICATION_STATUSES },
  verificationReason: { type: String, trim: true, maxlength: 500, default: '' },
  verificationSubmittedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  statusBeforeSuspension: { type: String, enum: ['pending', 'approved', 'rejected'] },
  reasonBeforeSuspension: { type: String, maxlength: 500 },
  verificationHistory: [{
    action: { type: String, enum: ['approved', 'rejected', 'suspended', 'reinstated', 'resubmitted'], required: true },
    fromStatus: { type: String, enum: VERIFICATION_STATUSES, required: true },
    toStatus: { type: String, enum: VERIFICATION_STATUSES, required: true },
    reason: { type: String, trim: true, maxlength: 500, default: '' },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true })

const User = mongoose.models.User || mongoose.model('User', userSchema)

export default User

