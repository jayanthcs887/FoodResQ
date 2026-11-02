import { api } from './api.js'

export const adminService = {
  dashboard: async () => (await api.get('/admin/dashboard')).data,
  verificationRequests: async params => (await api.get('/admin/verification-requests', { params })).data,
  verificationRequest: async id => (await api.get(`/admin/verification-requests/${id}`)).data,
  decideVerification: async (id, decision, reason = '') => (await api.patch(`/admin/verification-requests/${id}/${decision}`, { reason })).data,
  users: async params => (await api.get('/admin/verification-requests', { params: { status: 'all', ...params } })).data,
  suspendUser: async (id, reason) => (await api.patch(`/admin/users/${id}/suspend`, { reason })).data,
  reinstateUser: async id => (await api.patch(`/admin/users/${id}/reinstate`)).data,
}
