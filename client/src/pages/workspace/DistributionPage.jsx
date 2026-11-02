import { useState } from 'react'
import * as Icons from 'lucide-react'
import { api } from '../../services/api.js'
import { saveStore } from '../../utils/demoStorage.js'
import { prettyDeadline } from '../../utils/formatters.js'
import { VerificationNotice } from '../../components/common/VerificationNotice.jsx'

export function DistributionPage(props) {
  const { user, apiMode } = props
  const status = user.suspended ? 'suspended' : user.verificationStatus || (user.verified ? 'approved' : 'pending')
  if (apiMode && status !== 'approved') return <VerificationNotice user={user} action="record distributions" />
  return <DistributionWorkspace {...props} />
}

function DistributionWorkspace({ user, data, setData, apiMode }) {
  const [error, setError] = useState(''); const [success, setSuccess] = useState('')
  const deliveries = data.deliveries.filter(d => d.recipient === user.id && d.status === 'delivered')
  const distributed = data.distributions || []
  const totalReported = distributed.reduce((n, item) => n + Number(item.portions || 0), 0)
  const report = async (e, delivery) => {
    e.preventDefault(); setError(''); setSuccess('')
    const portions = Number(new FormData(e.currentTarget).get('portions'))
    const already = distributed.filter(d => d.deliveryId === delivery.id).reduce((n, d) => n + Number(d.portions || 0), 0)
    const remaining = Number(delivery.deliveredQuantity || 0) - already
    if (!Number.isInteger(portions) || portions < 1 || portions > remaining) { setError(`Enter a whole number from 1 to ${Math.max(0, remaining)}.`); return }
    let record = { id: `dist-${Date.now()}`, deliveryId: delivery.id, donationId: delivery.donationId, donationTitle: delivery.title, portions, locality: user.locality, time: 'Just now' }
    if (apiMode) { try { const { data: response } = await api.post('/distributions', { deliveryId: delivery.id, portions }); record = { ...record, ...response.distribution, id: response.distribution.id }; } catch (e) { setError(e.response?.data?.error || 'Could not record distribution.'); return } }
    const newTotal = already + portions; const next = { ...data, distributions: [record, ...distributed], donations: data.donations.map(d => d.id === delivery.donationId && newTotal >= Number(delivery.deliveredQuantity || 0) ? { ...d, status: 'distributed', distributedQuantity: newTotal } : d), notices: [{ id: `notice-${Date.now()}`, title: 'Distribution recorded', message: `${portions} portions · ${delivery.title}`, time: 'Just now', unread: true }, ...data.notices] }
    setData(next); saveStore(next); setSuccess(`${portions} portions recorded for ${delivery.title}.`)
  }
  return <><div className="distribution-intro"><span className="distribution-icon"><Icons.HandHeart size={20} /></span><div><span className="section-kicker">CLOSE THE LOOP</span><h2>What reached the table?</h2><p>Record portions distributed after delivery. Use aggregate counts only—never add beneficiary names or personal details.</p></div><div className="distribution-total"><b>{totalReported}</b><small>portions reported here</small></div></div>{error && <div className="form-error listing-error">{error}</div>}{success && <div className="success-banner"><Icons.CheckCheck size={16} />{success}<button onClick={() => setSuccess('')}><Icons.X size={15} /></button></div>}<section className="panel distribution-panel"><div className="panel-head"><div><span className="panel-kicker">COMPLETED HANDOFFS</span><h2>Record community distribution</h2></div><span className="count-badge">{deliveries.length} deliveries</span></div>{deliveries.map(delivery => { const reported = distributed.filter(d => d.deliveryId === delivery.id).reduce((n, d) => n + Number(d.portions || 0), 0); const remaining = Math.max(0, Number(delivery.deliveredQuantity || 0) - reported); return <article className="distribution-row" key={delivery.id}><div className="distribution-head"><span className="delivery-list-icon"><Icons.PackageCheck size={16} /></span><div><b>{delivery.title}</b><small>{delivery.organization} · Delivered {delivery.deliveredQuantity || 0} portions</small></div><span className={remaining ? 'request-status rs-pending' : 'request-status rs-accepted'}>{remaining ? `${remaining} unreported` : 'All portions reported'}</span></div>{remaining > 0 && <form className="distribution-form" onSubmit={e => report(e, delivery)}><label>Portions distributed<input name="portions" type="number" min="1" max={remaining} defaultValue={remaining} required /></label><button className="button button-dark button-sm"><Icons.Check size={14} />Record distribution</button></form>} {distributed.some(d => d.deliveryId === delivery.id) && <div className="distribution-recorded">{distributed.filter(d => d.deliveryId === delivery.id).map(d => <span key={d.id}>{d.portions} portions · {d.time || prettyDeadline(d.createdAt)}</span>)}</div>}</article> })}{!deliveries.length && <div className="empty-state"><Icons.PackageCheck size={25} /><b>No completed deliveries yet</b><span>Once your team confirms a handoff, you can record distribution here.</span></div>}</section></>
}
