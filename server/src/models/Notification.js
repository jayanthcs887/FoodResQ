import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 120 },
  body: { type: String, required: true, maxlength: 300 },
  href: { type: String, default: '/app' },
  readAt: Date,
}, { timestamps: true })

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema)

export default Notification

