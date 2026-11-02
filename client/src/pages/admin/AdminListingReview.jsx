import { useCallback, useEffect, useState } from 'react'
import * as Icons from 'lucide-react'
import { api } from '../../services/api.js'
import { prettyDeadline } from '../../utils/formatters.js'

const label = value => String(value || 'unknown').replaceAll('_', ' ')

export function AdminListingMonitor() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

  const load = useCallback(async (requestedPage = page) => {
    setLoading(true)
    try {
      const response = await api.get('/donations', { params: { page: requestedPage, limit: 25 } })
      const nextPagination = response.data.pagination || { page: requestedPage, pages: 1, total: (response.data.donations || []).length }
      if (requestedPage > nextPagination.pages && nextPagination.pages > 0) {
        setPage(nextPagination.pages)
        return
      }
      setListings(response.data.donations || [])
      setPagination(nextPagination)
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not load food listings.')
    } finally {
      setLoading(false)
    }
  }, [page])
  useEffect(() => { load(page) }, [load, page])

  const restrict = async listing => {
    const reason = window.prompt('Why does this available listing need to be restricted?') || ''
    if (reason.trim().length < 3) return
    if (!window.confirm(`Restrict “${listing.title}” from new claims?`)) return
    setBusyId(listing.id)
    setError('')
    setSuccess('')
    try {
      await api.patch(`/admin/donations/${listing.id}/review`, { decision: 'restrict', reason: reason.trim() })
      setSuccess('Listing restricted. The action and reason were recorded, and the donor was notified.')
      await load(page)
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not restrict this listing.')
    } finally {
      setBusyId('')
    }
  }

  const resolveLegacyReview = async (listing, decision) => {
    const reason = decision === 'reject' ? window.prompt('Add a short reason for the donor:') || '' : ''
    if (decision === 'reject' && reason.trim().length < 3) return
    setBusyId(listing.id)
    setError('')
    setSuccess('')
    try {
      await api.patch(`/admin/donations/${listing.id}/review`, { decision, reason: reason.trim() })
      setSuccess(`Legacy listing ${decision === 'approve' ? 'approved' : 'rejected'} and the donor was notified.`)
      await load(page)
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not update this legacy listing.')
    } finally {
      setBusyId('')
    }
  }

  return <>
    <div className="admin-page-heading"><div><span className="section-kicker">OPERATIONS MONITOR</span><h1>Food listings</h1><p>Listings publish directly after donor account approval. Review status and restrict a problematic available listing when needed.</p></div><button className="button button-light button-sm" onClick={() => load(page)} disabled={loading}><Icons.RefreshCw size={14} />Refresh</button></div>
    {error && <div className="admin-alert" role="alert"><Icons.CircleAlert size={17} />{error}</div>}
    {success && <div className="admin-success" role="status"><Icons.CircleCheck size={17} />{success}</div>}
    <section className="admin-panel">
      <div className="admin-panel-heading"><div><span className="section-kicker">ALL CONNECTED LISTINGS</span><h2>Donation status</h2></div><span className="admin-count-chip">{loading ? '…' : pagination.total}</span></div>
      {loading ? <div className="admin-empty"><span className="admin-spinner" />Loading listings…</div> : error ? <div className="admin-empty">Listing data is unavailable.</div> : listings.length ? <div className="admin-listing-list">{listings.map(listing => <article className="admin-listing-card" key={listing.id}>
        <div className="admin-listing-heading"><div><span className="admin-listing-category">{listing.category} · {listing.foodType}</span><h3>{listing.title}</h3><p>{listing.organization}</p></div><span className={`admin-status-badge status-${listing.status}`}>{label(listing.status)}</span></div>
        <p className="admin-listing-description">{listing.description}</p>
        <div className="admin-listing-meta"><span><Icons.Package size={15} />{listing.quantity} {listing.unit} · {listing.portions} portions</span><span><Icons.MapPin size={15} />{listing.pickup?.locality || 'Area not set'}</span><span><Icons.Clock3 size={15} />Collect by {prettyDeadline(listing.deadline)}</span><span><Icons.Snowflake size={15} />{listing.storage}</span></div>
        {listing.handling && <p className="admin-listing-handling"><b>Handling notes:</b> {listing.handling}</p>}
        {listing.safetyReview?.reason && <p className="admin-listing-handling"><b>Moderation note:</b> {listing.safetyReview.reason}</p>}
        {listing.status === 'available' && <div className="admin-listing-actions"><button className="button button-light button-sm" disabled={busyId === listing.id} onClick={() => restrict(listing)}><Icons.ShieldAlert size={14} />{busyId === listing.id ? 'Saving…' : 'Restrict listing'}</button></div>}
        {listing.status === 'needs_review' && <div className="admin-listing-actions"><span className="admin-listing-handling">Legacy submission awaiting a review decision.</span><button className="button button-light button-sm" disabled={busyId === listing.id} onClick={() => resolveLegacyReview(listing, 'reject')}><Icons.X size={14} />Reject</button><button className="button button-dark button-sm" disabled={busyId === listing.id} onClick={() => resolveLegacyReview(listing, 'approve')}><Icons.Check size={14} />Approve legacy listing</button></div>}
      </article>)}</div> : <div className="admin-empty admin-empty-large"><Icons.Boxes size={26} /><b>No food listings yet</b><span>Published donations and their current statuses will appear here.</span></div>}
      {!loading && pagination.pages > 1 && <div className="admin-pagination"><button className="button button-light button-sm" disabled={page <= 1} onClick={() => setPage(current => current - 1)}><Icons.ChevronLeft size={14} />Previous</button><span>Page {page} of {pagination.pages}</span><button className="button button-light button-sm" disabled={page >= pagination.pages} onClick={() => setPage(current => current + 1)}>Next<Icons.ChevronRight size={14} /></button></div>}
    </section>
    <div className="admin-note"><Icons.ShieldCheck size={15} />Routine publication does not wait for administrator review. Only older submissions already marked “needs review” retain an approval decision; a restriction needs a reason and remains visible in the listing record.</div>
  </>
}
