import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { api } from '../../services/api.js'
import { loadApiWorkspace } from '../../services/workspace.js'
import { prettyDeadline } from '../../utils/formatters.js'
import { saveStore } from '../../utils/demoStorage.js'

export function AdminIncidentQueue({ apiMode, data, setData }) {
  const [items, setItems] = useState(data.incidents); const [error, setError] = useState('')
  const load = async () => { if (!apiMode) return; try { const { data: response } = await api.get('/admin/incidents'); setItems(response.incidents.map(x => ({ id: String(x._id), type: x.type, description: x.description, status: x.status, by: x.reporter?.organization || x.reporter?.name || 'Network member', created: prettyDeadline(x.createdAt) }))); setError('') } catch (e) { setError(e.response?.data?.error || 'Could not load reports.') } }
  useEffect(() => { load() }, [apiMode])
  const setStatus = async (item, status) => { if (apiMode) { try { await api.patch(`/admin/incidents/${item.id}`, { status }); await load() } catch (e) { setError(e.response?.data?.error || 'Could not update the report.') }; return } const next = { ...data, incidents: data.incidents.map(i => i.id === item.id ? { ...i, status } : i) }; setData(next); saveStore(next); setItems(next.incidents) }
  return <><section className="panel review-panel"><div className="panel-head"><div><span className="panel-kicker">SAFETY & ACCOUNTABILITY</span><h2>Incident reports</h2></div><button className="button button-light button-sm" onClick={load}><Icons.RefreshCw size={14} />Refresh</button></div>{error && <div className="form-error listing-error">{error}</div>}{items.map(item => <div className="incident-row" key={item.id}><span className="incident-kind"><Icons.CircleAlert size={16} /></span><div className="incident-copy"><b>{item.type.replaceAll('_', ' ')}</b><p>{item.description}</p><small>{item.by} · {item.created}</small></div><span className={`request-status ${item.status === 'resolved' ? 'rs-accepted' : 'rs-pending'}`}>{item.status}</span><select aria-label="Report status" value={item.status} onChange={e => setStatus(item, e.target.value)}><option value="open">Open</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option></select></div>)}{!items.length && <div className="empty-state review-empty"><Icons.ShieldCheck size={24} /><b>No open reports</b><span>New reports will appear here for careful review.</span></div>}<div className="review-note"><Icons.ShieldCheck size={15} />Review reports in context. An anomaly alone is not proof of wrongdoing.</div></section><Link to="/admin/verification" className="text-link admin-incidents-link">Return to verification queue <Icons.ArrowRight size={14} /></Link></>
}

export function IncidentPage({ user, data, setData, apiMode }) { const [done, setDone] = useState(false); const [error, setError] = useState(''); const submit = async e => { e.preventDefault(); const f = new FormData(e.currentTarget); const item = { id: `i${Date.now()}`, type: f.get('type'), description: f.get('description'), status: 'open', by: user.name, created: 'Just now' }; if (apiMode) { try { const { data: response } = await api.post('/incidents', item); item.id = response.incident.id } catch (e) { setError(e.response?.data?.error || 'Could not submit this report. Please try again.'); return } } const next = { ...data, incidents: [item, ...data.incidents] }; setData(next); saveStore(next); setDone(true) }; return <div className="incident-layout"><section className="panel incident-form-panel"><div className="panel-head"><div><span className="panel-kicker">REPORT A CONCERN</span><h2>Let’s take a closer look.</h2><p>Clear reports help the right people follow up.</p></div></div>{done ? <div className="form-success small-success"><span><Icons.Check size={23} /></span><h2>Your report is with us.</h2><p>It’s been added to the review queue for the FoodResQ operations team.</p><button className="button button-light" onClick={() => setDone(false)}>Report another issue</button></div> : <form onSubmit={submit} className="form-stack"><label>What best describes it?<select name="type"><option value="food_safety">Food safety concern</option><option value="quantity">Quantity or handoff mismatch</option><option value="delay">Missed pickup or delay</option><option value="route">Route or delivery issue</option><option value="other">Something else</option></select></label><label>What happened?<textarea name="description" rows="5" placeholder="Share what you observed and what follow-up might help." required maxLength="1200" /></label><label>Related listing or delivery<input name="reference" placeholder="Optional ID or donation title" /></label><div className="safety-inline"><Icons.Shield size={16} /><p>Reports are visible to authorized operations staff. Please avoid including private beneficiary details.</p></div>{error && <div className="form-error">{error}</div>}<button className="button button-dark"><Icons.Send size={15} />Submit report</button></form>}</section><aside className="report-aside"><span className="aside-round-icon"><Icons.ShieldCheck size={21} /></span><span className="section-kicker">SAFETY & ACCOUNTABILITY</span><h3>People first,<br />always.</h3><p>A report creates a review case. Location anomalies and handoff concerns are reviewed in context, not treated as proof of misconduct.</p><Link to="/food-safety" className="text-link">Read our safety approach <Icons.ArrowRight size={14} /></Link></aside></div> }

export function AdminAssignments({ data, setData }) {
  const [partners, setPartners] = useState([])
  const [choices, setChoices] = useState({})
  const [reasons, setReasons] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const refresh = async () => {
    try {
      const { data: response } = await api.get('/admin/users')
      setPartners(response.users.filter(user => user.role === 'partner' && user.verificationStatus === 'approved' && !user.suspended).map(user => ({ id: String(user.id || user._id), name: user.organization || user.name })))
      const latest = await loadApiWorkspace()
      setData(previous => ({ ...previous, ...latest }))
      setError('')
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not load delivery monitoring data.')
    }
  }
  useEffect(() => { refresh() }, [])
  const assign = async delivery => {
    const partnerId = choices[delivery.id]
    const reason = String(reasons[delivery.id] || '').trim()
    if (!partnerId) { setError('Choose an approved delivery partner.'); return }
    if (reason.length < 3) { setError('Add a short reason for this exceptional assignment.'); return }
    setBusy(delivery.id)
    try {
      await api.post(`/deliveries/${delivery.id}/assign`, { partnerId, reason })
      await refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not assign this delivery.')
    } finally {
      setBusy('')
    }
  }
  return <section className="panel review-panel"><div className="panel-head"><div><span className="panel-kicker">DELIVERY TASK MONITOR</span><h2>Available, assigned, and active handoffs</h2><p>Verified delivery partners can accept tasks directly. Use an admin assignment only for an operational exception.</p></div><button className="button button-light button-sm" onClick={refresh}><Icons.RefreshCw size={14} />Refresh</button></div>{error && <div className="form-error listing-error">{error}</div>}{data.deliveries.map(delivery => {
    const available = delivery.status === 'assigned' && !delivery.partner
    const interventionAvailable = available || (Boolean(delivery.partner) && ['assigned', 'to_pickup'].includes(delivery.status))
    const age = delivery.currentLocation?.updatedAt ? Date.now() - new Date(delivery.currentLocation.updatedAt).getTime() : null
    const lastAssignment = delivery.assignmentHistory?.at(-1)
    return <div className="assignment-row" key={delivery.id}><span className="delivery-list-icon"><Icons.Truck size={16} /></span><div className="assignment-info"><b>{delivery.title}</b><span>{delivery.organization} → {delivery.to}</span><small>{available ? 'Pending delivery · available to verified partners' : delivery.status.replaceAll('_', ' ')}{age !== null ? ` · ${age > 120000 ? 'Location may be stale' : `Location updated ${prettyDeadline(delivery.currentLocation.updatedAt)}`}` : ''}</small>{lastAssignment?.method === 'admin_override' && <small>Admin override recorded: {lastAssignment.reason}</small>}</div>{delivery.partner && <span className="assignment-partner"><Icons.ShieldCheck size={13} />{partners.find(partner => partner.id === delivery.partner)?.name || 'Partner assigned'}</span>}{interventionAvailable && <div className="assignment-actions"><select aria-label={`Emergency assign partner to ${delivery.title}`} value={choices[delivery.id] || ''} onChange={event => setChoices({ ...choices, [delivery.id]: event.target.value })}><option value="">Choose verified partner</option>{partners.map(partner => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select><input aria-label={`Reason for exceptional assignment to ${delivery.title}`} placeholder="Reason for override" maxLength={500} value={reasons[delivery.id] || ''} onChange={event => setReasons({ ...reasons, [delivery.id]: event.target.value })} /><button className="button button-dark button-sm" disabled={busy === delivery.id} onClick={() => assign(delivery)}>{busy === delivery.id ? 'Saving…' : available ? 'Emergency assign' : 'Emergency reassign'} <Icons.ArrowRight size={13} /></button></div>}</div>
  })}{!data.deliveries.length && <div className="empty-state review-empty"><Icons.Truck size={24} /><b>No delivery tasks yet</b><span>Partner claims create tasks automatically; they will appear here for monitoring.</span></div>}{data.deliveries.length > 0 && !partners.length && <div className="review-note"><Icons.CircleAlert size={15} />No approved active Delivery Partners are available for an exceptional assignment.</div>}</section>
}
