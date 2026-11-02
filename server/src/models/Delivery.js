import mongoose from 'mongoose'

const deliverySchema = new mongoose.Schema({
  donation: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true, unique: true },
  donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['assigned', 'to_pickup', 'at_pickup', 'collected', 'in_transit', 'at_destination', 'delivered', 'cancelled'], default: 'assigned', index: true },
  currentLocation: { lat: Number, lng: Number, accuracy: Number, updatedAt: Date },
  pickupCodeHash: String,
  pickupCodeExpiry: Date,
  pickupVerifiedAt: Date,
  deliveryCodeHash: String,
  deliveryCodeExpiry: Date,
  deliveredQuantity: Number,
  deliveredAt: Date,
  statusHistory: [{
    status: { type: String, enum: ['assigned', 'to_pickup', 'at_pickup', 'collected', 'in_transit', 'at_destination', 'delivered', 'cancelled'], required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['donor', 'recipient', 'partner', 'admin', 'system'] },
    reason: { type: String, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  }],
  assignmentHistory: [{
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    method: { type: String, enum: ['partner_accept', 'admin_override'], required: true },
    reason: { type: String, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true })

const Delivery = mongoose.models.Delivery || mongoose.model('Delivery', deliverySchema)

export default Delivery

