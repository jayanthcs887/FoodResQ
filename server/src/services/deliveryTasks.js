import { Donation, Delivery } from '../models/index.js'
import { notify } from './notifications.js'

export async function expirePastUnassignedDeliveryTasks(now = new Date()) {
  const candidates = await Delivery.find({ status: 'assigned', partner: null }).populate('donation').limit(200)
  const expired = candidates.filter(delivery => {
    const deadline = delivery.donation?.deadline && new Date(delivery.donation.deadline)
    return !deadline || !Number.isFinite(deadline.getTime()) || deadline <= now
  })

  await Promise.all(expired.map(async delivery => {
    const reason = 'The donation collection deadline passed or its listing is no longer valid before a delivery partner accepted the task.'
    const cancelled = await Delivery.findOneAndUpdate(
      { _id: delivery._id, status: 'assigned', partner: null },
      { $set: { status: 'cancelled' }, $push: { statusHistory: { status: 'cancelled', role: 'system', reason, createdAt: now } } },
      { new: true, runValidators: true },
    )
    if (!cancelled) return
    if (delivery.donation?._id) await Donation.updateOne({ _id: delivery.donation._id, status: 'reserved' }, { $set: { status: 'expired' } })
    await Promise.allSettled([
      notify(delivery.donor, 'Delivery task expired', 'The collection deadline passed before a delivery partner accepted the task.', '/app/deliveries'),
      notify(delivery.recipient, 'Delivery task expired', 'The collection window passed before a delivery partner accepted the task.', '/app/deliveries'),
    ])
  }))
}
