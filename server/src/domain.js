export const PUBLIC_ROLES = Object.freeze(['donor', 'recipient', 'partner'])
export const SUPPORTED_ROLES = Object.freeze([...PUBLIC_ROLES, 'admin'])
export const isSupportedRole = role => SUPPORTED_ROLES.includes(role)

export const deliveryTransitions = Object.freeze({
  to_pickup: { from: ['assigned'], role: 'partner' },
  at_pickup: { from: ['to_pickup'], role: 'partner' },
  collected: { from: ['at_pickup'], role: 'donor' },
  in_transit: { from: ['collected'], role: 'partner' },
  at_destination: { from: ['in_transit'], role: 'partner' },
  delivered: { from: ['at_destination'], roles: ['recipient'] },
})

export function canViewDelivery(delivery, user) {
  if (user.role === 'admin') return true
  return [delivery.donor, delivery.recipient, delivery.partner]
    .some(id => id && String(id) === String(user.id || user._id))
}

export function canReserve({ status, deadline, quantity, reservedQuantity = 0, requested, now = new Date() }) {
  return status === 'available'
    && new Date(deadline) > now
    && Number.isFinite(requested)
    && requested > 0
    && Number(reservedQuantity) + requested <= Number(quantity)
}

export function canDistribute({ delivered, distributed = 0, requested }) {
  return Number.isInteger(requested)
    && requested > 0
    && Number.isFinite(Number(delivered))
    && Number.isFinite(Number(distributed))
    && Number(distributed) >= 0
    && Number(delivered) >= 0
    && Number(distributed) + requested <= Number(delivered)
}

export function validCoordinates(lat, lng, accuracy = 0) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 1000
}

