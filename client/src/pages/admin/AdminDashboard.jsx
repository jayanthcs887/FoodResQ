import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { adminService } from '../../services/adminService.js'
import { roleLabel } from '../../utils/formatters.js'

const statCards = [
  ['totalUsers', 'Registered users', Icons.UsersRound, 'neutral'],
  ['pending', 'Accounts awaiting review', Icons.Clock3, 'warm'],
  ['approved', 'Verified accounts', Icons.UserRoundCheck, 'sage'],
  ['availableListings', 'Available listings', Icons.Boxes, 'neutral'],
  ['claimedDonations', 'Claimed donations', Icons.HandHeart, 'warm'],
  ['pendingDeliveryTasks', 'Pending delivery tasks', Icons.Truck, 'coral'],
  ['completedDeliveries', 'Recipient confirmed', Icons.PackageCheck, 'sage'],
  ['rejected', 'Rejected accounts', Icons.UserRoundX, 'coral'],
  ['suspended', 'Suspended accounts', Icons.ShieldBan, 'slate'],
]

const prettyDate = value => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable'

export function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    try { setDashboard(await adminService.dashboard()); setError('') }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not load the admin dashboard.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const summary = dashboard?.summary || {}
  return <>
    <div className="admin-page-heading"><div><span className="section-kicker">OPERATIONS OVERVIEW</span><h1>Admin dashboard</h1><p>Review account verification and monitor listings, claims, and delivery tasks.</p></div><button className="button button-light button-sm" onClick={() => load(true)} disabled={refreshing}><Icons.RefreshCw size={14} />{refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
    {error && <div className="admin-alert" role="alert"><Icons.CircleAlert size={17} />{error}</div>}
    <div className="admin-stat-grid">{statCards.map(([key, label, Icon, tone]) => <article className={`admin-stat-card tone-${tone}`} key={key}><span className="admin-stat-icon"><Icon size={18} /></span><div><small>{label}</small><strong>{loading || error ? '—' : Number(summary[key] || 0).toLocaleString()}</strong></div></article>)}</div>
    <div className="admin-dashboard-grid">
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="section-kicker">CURRENT STATUS</span><h2>Food listings</h2></div><Link to="/admin/listings">Monitor listings <Icons.ArrowRight size={14} /></Link></div>
        {loading ? <div className="admin-empty">Loading listing counts…</div> : error ? <div className="admin-empty">Listing data is unavailable.</div> : Object.keys(dashboard?.listingStatuses || {}).length ? <div className="admin-status-grid">{Object.entries(dashboard.listingStatuses).map(([status, count]) => <div key={status}><span className={`admin-status-dot status-${status}`} /><span>{status.replaceAll('_', ' ')}</span><b>{count}</b></div>)}</div> : <div className="admin-empty">No food listings have been created.</div>}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><span className="section-kicker">ACCOUNT DECISIONS</span><h2>Recent verification activity</h2></div><Link to="/admin/verification">Open queue <Icons.ArrowRight size={14} /></Link></div>
        {loading ? <div className="admin-empty">Loading recent activity…</div> : error ? <div className="admin-empty">Activity data is unavailable.</div> : dashboard?.recentActivity?.length ? <div className="admin-activity-list">{dashboard.recentActivity.map((event, index) => <Link className="admin-activity-row" to={`/admin/verification/${event.userId}`} key={`${event.userId}-${event.createdAt}-${index}`}><span className="admin-activity-icon"><Icons.ShieldCheck size={16} /></span><span className="admin-activity-copy"><b>{event.organization || event.name}</b><small>{roleLabel(event.role)} · {event.fromStatus} → {event.toStatus}</small><small>{event.action} by {event.actor?.name || 'Applicant'} · {prettyDate(event.createdAt)}</small></span><Icons.ChevronRight size={16} /></Link>)}</div> : <div className="admin-empty">Verification decisions and resubmissions will appear here.</div>}
      </section>
    </div>
    <div className="admin-note"><Icons.Info size={15} />Verification is an operational access decision. It does not certify food safety or establish an organization’s legal status.</div>
  </>
}
