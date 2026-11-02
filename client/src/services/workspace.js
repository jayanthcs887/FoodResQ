import api from './api.js'
import { demoDonations } from '../constants/demoData.js'
import { imageForCategory, prettyDeadline } from '../utils/formatters.js'

export async function loadApiWorkspace() {
  const [donationResult, deliveryResult, requestResult, noticeResult, impactResult, distributionResult] = await Promise.allSettled([api.get('/donations'), api.get('/deliveries'), api.get('/requests'), api.get('/notifications'), api.get('/impact'), api.get('/distributions')])
  const read = result => result.status === 'fulfilled' ? result.value.data : {}
  const rawDonations = read(donationResult).donations || []
  const donations = rawDonations.map(d => ({ ...d, donor: String(d.donor?._id || d.donor || ''), locality: d.pickup?.locality || '', address: d.pickup?.address || '', deadline: prettyDeadline(d.deadline), time: new Date(d.deadline).getTime(), distance: d.pickup?.locality || 'Nearby', image: imageForCategory(d.category, demoDonations) }))
  const deliveries = (read(deliveryResult).deliveries || []).map(d => ({ id: String(d.id || d._id), donationId: String(d.donation?.id || d.donation?._id || ''), status: d.status, title: d.donation?.title || 'Food pickup', organization: d.donor?.organization || d.donor?.name || 'Food donor', to: d.recipient?.organization || d.recipient?.name || 'Receiving organization', toLocality: d.recipient?.locality || '', pickupAddress: d.donation?.pickup?.address || '', pickupLocality: d.donation?.pickup?.locality || '', donor: String(d.donor?._id || d.donor || ''), recipient: String(d.recipient?._id || d.recipient || ''), partner: String(d.partner?._id || d.partner || ''), currentLocation: d.currentLocation, deliveredQuantity: d.deliveredQuantity, statusHistory: d.statusHistory || [], assignmentHistory: d.assignmentHistory || [], portions: d.donation?.portions || 0, deadline: prettyDeadline(d.donation?.deadline), distance: d.donation?.pickup?.locality || 'Nearby' }))
  const requests = (read(requestResult).requests || []).map(r => ({ ...r, id: String(r.id || r._id), donationId: String(r.donationId), time: r.createdAt ? prettyDeadline(r.createdAt) : 'Recently' }))
  const notices = (read(noticeResult).notifications || []).map(n => ({ id: String(n.id || n._id), title: n.title, message: n.body, time: prettyDeadline(n.createdAt), unread: !n.readAt }))
  const distributions = (read(distributionResult).distributions || []).map(d => ({ id: String(d._id || d.id), deliveryId: String(d.delivery), donationId: String(d.donation?._id || d.donation || ''), donationTitle: d.donation?.title || 'Food donation', portions: d.portions, locality: d.locality, createdAt: d.createdAt, time: prettyDeadline(d.createdAt) }))
  return { donations, deliveries, requests, notices, distributions, impact: read(impactResult) }
}
