import mongoose from 'mongoose'

const donationSchema = new mongoose.Schema({
  donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organization: { type: String, required: true, trim: true, maxlength: 120 },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  category: { type: String, enum: ['Prepared meals', 'Bakery', 'Produce', 'Dairy', 'Packaged'], required: true },
  foodType: { type: String, enum: ['Vegetarian', 'Non-vegetarian', 'Vegan', 'Other'], required: true },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, enum: ['portions', 'kg', 'boxes'], default: 'portions' },
  portions: { type: Number, required: true, min: 1 },
  reservedQuantity: { type: Number, default: 0, min: 0 },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  claimedAt: Date,
  deliveredQuantity: { type: Number, default: 0, min: 0 },
  distributedQuantity: { type: Number, default: 0, min: 0 },
  preparedAt: { type: Date, required: true },
  deadline: { type: Date, required: true, index: true },
  storage: { type: String, required: true, maxlength: 300 },
  handling: { type: String, maxlength: 500 },
  pickup: {
    address: { type: String, required: true, maxlength: 240 },
    locality: { type: String, required: true, maxlength: 100 },
    point: { type: mongoose.Schema.Types.Mixed },
  },
  safety: {
    sealed: { type: Boolean, default: false },
    temperatureKnown: { type: Boolean, default: false },
    allergens: { type: String, maxlength: 300 },
    donorConfirmed: { type: Boolean, required: true },
  },
  status: { type: String, enum: ['available', 'reserved', 'collected', 'delivered', 'distributed', 'expired', 'rejected', 'cancelled', 'needs_review'], default: 'needs_review', index: true },
  safetyReview: {
    status: { type: String, enum: ['not_required', 'pending', 'approved', 'rejected'], default: 'not_required' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reason: { type: String, maxlength: 500 },
  },
  requests: [{
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quantity: { type: Number, required: true, min: 1 },
    note: { type: String, maxlength: 400 },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true })

const Donation = mongoose.models.Donation || mongoose.model('Donation', donationSchema)

export default Donation

