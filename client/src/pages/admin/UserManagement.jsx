import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { adminService } from '../../services/adminService.js'
import { roleLabel } from '../../utils/formatters.js'

const dateLabel = value => value ? new Date(value).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : 'Date unavailable'

export function UserManagement() {
  const [status, setStatus] = useState('all')
  const [role, setRole] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setUsers((await adminService.users({ status, role: role || undefined })).requests); setError('') }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not load accounts.') }
    finally { setLoading(false) }
  }, [status, role])
  useEffect(() => { load() }, [load])

  const suspend = async user => {
    const reason = window.prompt(`Why are you suspending ${user.organization || user.name}?`)
    if (reason === null) return
    if (reason.trim().length < 3) { setError('Enter a suspension reason of at least 3 characters.'); return }
    if (!window.confirm('Suspend this account? It will lose access to protected workflows.')) return
    setBusyId(user._id); setError(''); setSuccess('')
    try { await adminService.suspendUser(user._id, reason.trim()); setSuccess('Account suspended and the decision was added to its history.'); await load() }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not suspend this account.') }
    finally { setBusyId('') }
  }

  const reinstate = async user => {
    if (!window.confirm(`Restore ${user.organization || user.name} to its previous verification status?`)) return
    setBusyId(user._id); setError(''); setSuccess('')
    try { await adminService.reinstateUser(user._id); setSuccess('Account restored to its previous verification status.'); await load() }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not restore this account.') }
    finally { setBusyId('') }
  }

  return <>
    <div className="admin-page-heading"><div><span className="section-kicker">ACCOUNT DIRECTORY</span><h1>User management</h1><p>Review submitted public accounts and manage suspension status.</p></div><button className="button button-light button-sm" onClick={load} disabled={loading}><Icons.RefreshCw size={14} />Refresh</button></div>
    {error && <div className="admin-alert" role="alert"><Icons.CircleAlert size={17} />{error}</div>}
    {success && <div className="admin-success" role="status"><Icons.CircleCheck size={17} />{success}</div>}
    <section className="admin-panel admin-table-panel">
      <div className="admin-toolbar"><label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select></label><label>Role<select value={role} onChange={event => setRole(event.target.value)}><option value="">All public roles</option><option value="donor">Food donor</option><option value="recipient">Receiving partner</option><option value="partner">Delivery partner</option></select></label><span className="admin-result-count">{loading ? 'Loading…' : `${users.length} account${users.length === 1 ? '' : 's'}`}</span></div>
      {loading ? <div className="admin-empty"><span className="admin-spinner" />Loading accounts…</div> : error ? <div className="admin-empty">Account data is unavailable.</div> : users.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Account</th><th>Role</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map(user => <tr key={user._id}><td><b>{user.organization || user.name}</b><small>{user.name} · {user.email}</small></td><td>{roleLabel(user.role)}</td><td>{dateLabel(user.submittedAt)}</td><td><span className={`admin-status-badge status-${user.verificationStatus}`}>{user.verificationStatus}</span></td><td><div className="admin-row-actions"><Link className="button button-light button-sm" to={`/admin/verification/${user._id}`}>Details</Link>{user.verificationStatus === 'suspended' ? <button className="button button-dark button-sm" disabled={busyId === user._id} onClick={() => reinstate(user)}>{busyId === user._id ? 'Saving…' : 'Restore'}</button> : <button className="button button-light button-sm" disabled={busyId === user._id} onClick={() => suspend(user)}>{busyId === user._id ? 'Saving…' : 'Suspend'}</button>}</div></td></tr>)}</tbody></table></div> : <div className="admin-empty admin-empty-large"><Icons.UsersRound size={25} /><b>No matching accounts</b><span>Try another status or role.</span></div>}
    </section>
    <div className="admin-note"><Icons.Info size={15} />Suspension is recorded separately from approval. Restoring a suspended account returns it to the status it had before suspension.</div>
  </>
}
