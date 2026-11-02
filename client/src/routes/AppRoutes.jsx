import { Route, Routes } from 'react-router-dom'
import { Dashboard, ConnectedDashboard } from '../pages/workspace/DashboardPages.jsx'
import { DonationBrowser, DonorListingRoute, RequestsPage } from '../pages/workspace/DonationPages.jsx'
import { DeliveryList } from '../pages/workspace/DeliveryPage.jsx'
import { DistributionPage } from '../pages/workspace/DistributionPage.jsx'
import { ImpactPage, ConnectedImpactPage } from '../pages/workspace/ImpactPages.jsx'
import { IncidentPage } from '../pages/workspace/OperationsPages.jsx'
import { SettingsPage } from '../pages/workspace/SettingsPage.jsx'
import { AccessCard } from '../components/common/AccessCard.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export function AppRoutes({ user, data, setData, apiMode }) {
  const { setUser } = useAuth()
  return <Routes>
    <Route index element={apiMode ? <ConnectedDashboard user={user} data={data} apiMode={apiMode} /> : <Dashboard user={user} data={data} />} />
    <Route path="donations" element={<DonationBrowser user={user} data={data} setData={setData} apiMode={apiMode} />} />
    <Route path="new" element={user.role === 'donor' ? <DonorListingRoute user={user} data={data} setData={setData} apiMode={apiMode} /> : <AccessCard />} />
    <Route path="requests" element={<RequestsPage user={user} data={data} setData={setData} apiMode={apiMode} />} />
    <Route path="deliveries" element={<DeliveryList user={user} data={data} setData={setData} apiMode={apiMode} />} />
    <Route path="distributions" element={user.role === 'recipient' ? <DistributionPage user={user} data={data} setData={setData} apiMode={apiMode} /> : <AccessCard />} />
    <Route path="impact" element={apiMode ? <ConnectedImpactPage user={user} data={data} /> : <ImpactPage user={user} data={data} />} />
    <Route path="incidents" element={<IncidentPage user={user} data={data} setData={setData} apiMode={apiMode} />} />
    <Route path="settings" element={<SettingsPage user={user} apiMode={apiMode} setUser={setUser} />} />
    <Route path="*" element={apiMode ? <ConnectedDashboard user={user} data={data} apiMode={apiMode} /> : <Dashboard user={user} data={data} />} />
  </Routes>
}
