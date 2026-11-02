import mongoose from 'mongoose'

const distributionSchema = new mongoose.Schema({
  delivery: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', required: true, index: true },
  donation: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  portions: { type: Number, required: true, min: 1 },
  locality: { type: String, maxlength: 100 },
}, { timestamps: true })

const Distribution = mongoose.models.Distribution || mongoose.model('Distribution', distributionSchema)

export default Distribution

