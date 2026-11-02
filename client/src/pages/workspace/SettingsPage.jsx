import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'
import { roleLabel } from '../../utils/formatters.js'

const statusText = status => ({ pending: 'Awaiting Admin review', approved: 'Approved account', rejected: 'Changes requested', suspended: 'Account suspended' }[status] || 'Awaiting Admin review')

export function SettingsPage({ user }) {
  const { setUser, apiMode } = useAuth()
  const [name, setName] = useState(user.name)
  const [organization, setOrganization] = useState(user.organization || '')
  const [locality, setLocality] = useState(user.locality || '')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const status = user.suspended ? 'suspended' : user.verificationStatus || (user.verified ? 'approved' : 'pending')
  const canResubmit = apiMode && status === 'rejected'

  const submit = async event => {
    event.preventDefault()
    if (apiMode) {
      if (!canResubmit) return
      setBusy(true); setError(''); setSuccess('')
      try {
        const { data } = await api.patch('/auth/resubmission', { name: name.trim(), organization: organization.trim(), locality: locality.trim() })
        setUser(data.user)
        setSuccess('Your updated details are submitted. Your account is pending Admin review.')
      } catch (requestError) { setError(requestError.response?.data?.error || 'Could not resubmit your application.') }
      finally { setBusy(false) }
      return
    }
    const nextUser = { ...user, name: name.trim(), organization: organization.trim(), locality: locality.trim() }
    setUser(nextUser)
    localStorage.setItem('foodresq-demo-user', JSON.stringify(nextUser))
    setSaved(true)
  }

  return <div className="settings-grid">
    <section className="panel settings-panel">
      <span className="panel-kicker">YOUR ACCOUNT</span><h2>Profile details</h2>
      <div className="settings-profile"><span className="profile-avatar large-avatar">{user.name.split(' ').map(word => word[0]).slice(0, 2).join('')}</span><div><b>{user.name}</b><small>{user.email}</small><span className={`verification-status-label status-${status}`}><Icons.ShieldCheck size={13} />{user.id?.startsWith('demo') ? 'Fictional demo profile' : statusText(status)}</span></div></div>
      {apiMode && status !== 'approved' && <div className={`verification-message status-${status}`}><b>{status === 'rejected' ? 'Admin decision' : status === 'suspended' ? 'Access is restricted' : 'Your request is being reviewed'}</b><span>{status === 'rejected' ? user.verificationReason || 'Review the account details below and resubmit when they are corrected.' : status === 'suspended' ? 'Contact platform support if you believe this account was suspended in error.' : 'You can sign in while review is pending, but role-specific actions stay unavailable until approval.'}</span></div>}
      <form onSubmit={submit}>
        <div className="settings-fields"><label>Your name<input value={name} onChange={event => setName(event.target.value)} readOnly={apiMode && !canResubmit} required maxLength={100} /></label><label>Organization<input value={organization} onChange={event => setOrganization(event.target.value)} readOnly={apiMode && !canResubmit} maxLength={120} /></label><label>Service area<input value={locality} onChange={event => setLocality(event.target.value)} readOnly={apiMode && !canResubmit} maxLength={100} /></label><label>Account type<input value={roleLabel(user.role)} readOnly /></label></div>
        {canResubmit ? <button className="button button-dark button-sm" disabled={busy}>{busy ? 'Submitting…' : 'Update and resubmit application'} <Icons.ArrowRight size={14} /></button> : <button className="button button-dark button-sm" disabled={apiMode}>{saved ? 'Saved in this browser' : 'Save demo profile'}</button>}
      </form>
      {error && <div className="form-error listing-error" role="alert">{error}</div>}{success && <div className="success-banner" role="status"><Icons.CheckCircle2 size={16} />{success}</div>}
      {apiMode && status === 'rejected' && <p className="setting-note">Resubmission records a new review event and returns this application to pending. Email and account role cannot be changed here.</p>}
      {!apiMode && <p className="setting-note">Demo profile changes are saved only in this browser.</p>}
    </section>
    <section className="panel settings-panel"><span className="panel-kicker">PRIVACY & NOTIFICATIONS</span><h2>Thoughtful by default.</h2><div className="privacy-row"><span><Icons.Bell size={16} /></span><p><b>In-app updates</b><small>Donation and handoff notices stay in your workspace.</small></p></div><div className="privacy-row"><span><Icons.LocateFixed size={16} /></span><p><b>Delivery location</b><small>Sharing starts from an active delivery after browser permission.</small></p></div><div className="privacy-note"><Icons.ShieldCheck size={14} /> Passwords and session tokens are never stored in demo browser storage.</div><Link to="/food-safety" className="text-link">Read privacy and safety notes <Icons.ArrowRight size={14} /></Link></section>
  </div>
}
