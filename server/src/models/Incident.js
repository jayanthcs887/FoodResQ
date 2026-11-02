import mongoose from 'mongoose'

const incidentSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  donation: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation' },
  delivery: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery' },
  type: { type: String, enum: ['food_safety', 'quantity', 'delay', 'route', 'other'], required: true },
  description: { type: String, required: true, maxlength: 1200 },
  status: { type: String, enum: ['open', 'reviewing', 'resolved'], default: 'open' },
}, { timestamps: true })

const Incident = mongoose.models.Incident || mongoose.model('Incident', incidentSchema)

export default Incident

