import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from '../layouts/AdminLayout.jsx'
import { AdminLogin } from '../pages/admin/AdminLogin.jsx'
import { AdminDashboard } from '../pages/admin/AdminDashboard.jsx'
import { AdminListingMonitor } from '../pages/admin/AdminListingReview.jsx'
import { UserManagement } from '../pages/admin/UserManagement.jsx'
import { VerificationRequestDetail, VerificationRequests } from '../pages/admin/VerificationRequests.jsx'
import { AdminAssignments, AdminIncidentQueue } from '../pages/workspace/OperationsPages.jsx'

export function AdminRoutes({ user, apiMode, onLogin, onLogout, data, setData }) {
  const authorized = apiMode && user?.role === 'admin'
  return <Routes>
    <Route path="login" element={<AdminLogin user={user} apiMode={apiMode} onLogin={onLogin} onLogout={onLogout} />} />
    <Route element={authorized ? <AdminLayout user={user} onLogout={onLogout} /> : <Navigate to="/admin/login" replace />}>
      <Route index element={<AdminDashboard />} />
      <Route path="verification" element={<VerificationRequests />} />
      <Route path="verification/:id" element={<VerificationRequestDetail />} />
      <Route path="accounts" element={<UserManagement />} />
      <Route path="listings" element={<AdminListingMonitor />} />
      <Route path="deliveries" element={<AdminAssignments data={data} setData={setData} />} />
      <Route path="incidents" element={<AdminIncidentQueue apiMode={apiMode} data={data} setData={setData} />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Route>
  </Routes>
}
