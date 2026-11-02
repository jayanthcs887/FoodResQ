import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { adminService } from '../../services/adminService.js'
import { roleLabel } from '../../utils/formatters.js'

const dateLabel = value => value ? new Date(value).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : 'Date unavailable'
const statusTone = status => `admin-status-badge status-${status || 'pending'}`

export function VerificationRequests() {
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('pending')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setRequests((await adminService.verificationRequests({ role: role || undefined, status })).requests); setError('') }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not load verification requests.') }
    finally { setLoading(false) }
  }, [role, status])
  useEffect(() => { load() }, [load])

  return <>
    <div className="admin-page-heading"><div><span className="section-kicker">ACCOUNT REVIEW</span><h1>Verification requests</h1><p>Review the account details applicants submitted and record a decision.</p></div><button className="button button-light button-sm" onClick={load} disabled={loading}><Icons.RefreshCw size={14} />Refresh</button></div>
    {error && <div className="admin-alert" role="alert"><Icons.CircleAlert size={17} />{error}</div>}
    <section className="admin-panel admin-table-panel">
      <div className="admin-toolbar"><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option><option value="all">All statuses</option></select></label><label>Role<select value={role} onChange={event => setRole(event.target.value)}><option value="">All public roles</option><option value="donor">Food donor</option><option value="recipient">Receiving partner</option><option value="partner">Delivery partner</option></select></label><span className="admin-result-count">{loading ? 'Loading…' : `${requests.length} request${requests.length === 1 ? '' : 's'}`}</span></div>
      {loading ? <div className="admin-empty"><span className="admin-spinner" />Loading requests…</div> : error ? <div className="admin-empty">Request data is unavailable.</div> : requests.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Applicant</th><th>Role</th><th>Submitted</th><th>Status</th><th /></tr></thead><tbody>{requests.map(request => <tr key={request._id}><td><b>{request.organization || request.name}</b><small>{request.name}{request.organization ? ` · ${request.email}` : request.email}</small></td><td>{roleLabel(request.role)}</td><td>{dateLabel(request.submittedAt)}</td><td><span className={statusTone(request.verificationStatus)}>{request.verificationStatus}</span></td><td><Link className="button button-light button-sm" to={`/admin/verification/${request._id}`}>View details <Icons.ArrowRight size={14} /></Link></td></tr>)}</tbody></table></div> : <div className="admin-empty admin-empty-large"><Icons.Inbox size={25} /><b>No matching requests</b><span>Try another status or role, or check back after a new registration.</span></div>}
    </section>
  </>
}

export function VerificationRequestDetail() {
  const { id } = useParams()
  const [request, setRequest] = useState(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { const response = await adminService.verificationRequest(id); setRequest(response.request); setReason(response.request.verificationReason || ''); setError('') }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not load this verification request.') }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  const decide = async decision => {
    if (decision === 'rejected' && reason.trim().length < 3) { setError('Add a reason of at least 3 characters before rejecting.'); return }
    const action = decision === 'approved' ? 'approve this account' : 'reject this application'
    if (!window.confirm(`Are you sure you want to ${action}? This decision will be recorded in the account history.`)) return
    setBusy(true); setError(''); setSuccess('')
    try {
      await adminService.decideVerification(id, decision, reason.trim())
      setSuccess(decision === 'approved' ? 'Account approved. The applicant can now use approved workflows.' : 'Application rejected. The reason is saved and visible to the applicant.')
      await load()
    } catch (requestError) { setError(requestError.response?.data?.error || 'Could not save this verification decision.') }
    finally { setBusy(false) }
  }

  if (loading) return <div className="admin-empty"><span className="admin-spinner" />Loading application details…</div>
  if (!request) return <><Link className="admin-back-link" to="/admin/verification"><Icons.ArrowLeft size={15} />Back to requests</Link><div className="admin-alert" role="alert">{error || 'Verification request not found.'}</div></>

  return <>
    <Link className="admin-back-link" to="/admin/verification"><Icons.ArrowLeft size={15} />Back to requests</Link>
    <div className="admin-page-heading"><div><span className="section-kicker">APPLICATION DETAILS</span><h1>{request.organization || request.name}</h1><p>Review the submitted organization information and prior decisions.</p></div><span className={statusTone(request.verificationStatus)}>{request.verificationStatus}</span></div>
    {error && <div className="admin-alert" role="alert"><Icons.CircleAlert size={17} />{error}</div>}
    {success && <div className="admin-success" role="status"><Icons.CircleCheck size={17} />{success}</div>}
    <div className="admin-detail-grid">
      <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">APPLICANT INFORMATION</span><h2>Submitted account details</h2></div></div><dl className="admin-detail-list"><div><dt>Applicant name</dt><dd>{request.name}</dd></div><div><dt>Organization</dt><dd>{request.organization || 'Not provided'}</dd></div><div><dt>Email</dt><dd><a href={`mailto:${request.email}`}>{request.email}</a></dd></div><div><dt>Role</dt><dd>{roleLabel(request.role)}</dd></div><div><dt>Service area</dt><dd>{request.locality || 'Not provided'}</dd></div><div><dt>Submitted</dt><dd>{request.submittedAt ? new Date(request.submittedAt).toLocaleString() : 'Date unavailable'}</dd></div>{request.reviewer && <div><dt>Last reviewed by</dt><dd>{request.reviewer.name} · {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : 'time unavailable'}</dd></div>}{request.verificationReason && <div className="admin-reason-detail"><dt>Latest decision reason</dt><dd>{request.verificationReason}</dd></div>}</dl><div className="admin-evidence-note"><Icons.FileSearch size={17} /><span><b>No supporting documents were submitted.</b><small>The current registration flow collects account and organization details only. Do not treat this review as a food-safety or legal certification.</small></span></div></section>
      <section className="admin-panel admin-decision-panel"><div className="admin-panel-heading"><div><span className="section-kicker">REVIEW DECISION</span><h2>{request.verificationStatus === 'pending' ? 'Record your decision' : 'Current status'}</h2></div></div>{request.verificationStatus === 'pending' ? <><label className="admin-reason-field">Decision note<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={4} placeholder="Required when rejecting. Explain what should be corrected." /></label><small className="admin-field-help">A rejection reason is shared with the applicant. Keep it specific and respectful.</small><div className="admin-decision-actions"><button className="button button-light" disabled={busy} onClick={() => decide('rejected')}><Icons.X size={15} />Reject application</button><button className="button button-dark" disabled={busy} onClick={() => decide('approved')}><Icons.Check size={15} />{busy ? 'Saving…' : 'Approve account'}</button></div></> : <div className="admin-current-status"><span className={statusTone(request.verificationStatus)}>{request.verificationStatus}</span><p>{request.verificationStatus === 'suspended' ? 'This account is suspended and cannot use protected workflows.' : request.verificationStatus === 'approved' ? 'This account is approved for role-specific workflows.' : 'This application was rejected. The applicant can update their account details and resubmit.'}</p><Link className="text-link" to="/admin/accounts">Manage account status <Icons.ArrowRight size={14} /></Link></div>}</section>
    </div>
    <section className="admin-panel admin-history-panel"><div className="admin-panel-heading"><div><span className="section-kicker">AUDIT TRAIL</span><h2>Verification history</h2></div></div>{request.verificationHistory?.length ? <div className="admin-history-list">{request.verificationHistory.map((event, index) => <div key={`${event.action}-${event.createdAt}-${index}`}><span className={`admin-history-dot status-${event.toStatus}`} /><span><b>{event.action}</b><small>{event.fromStatus} → {event.toStatus} · {event.actor?.name || 'Unknown reviewer'} · {new Date(event.createdAt).toLocaleString()}</small>{event.reason && <p>{event.reason}</p>}</span></div>)}</div> : <div className="admin-empty">No verification decisions have been recorded yet.</div>}</section>
  </>
}
