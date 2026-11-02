import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { api } from '../../services/api.js'
import { loadApiWorkspace } from '../../services/workspace.js'
import { saveStore } from '../../utils/demoStorage.js'
import { prettyDeadline } from '../../utils/formatters.js'

export function DeliveryMap({ selected, apiMode }) {
  if (apiMode) {
    const age = selected.currentLocation?.updatedAt ? Date.now() - new Date(selected.currentLocation.updatedAt).getTime() : null
    const locationLabel = age === null ? 'No partner location has been shared for this trip.'
      : age > 120_000 ? `Location may be stale. Last update ${prettyDeadline(selected.currentLocation.updatedAt)}.`
        : `Partner location last shared ${prettyDeadline(selected.currentLocation.updatedAt)}.`
    return <div className="route-not-ready"><span className="route-placeholder-icon"><Icons.MapPin size={21} /></span><span className="section-kicker">TRIP LOCATION</span><b>Map directions aren’t configured</b><p>Pickup area: {selected.pickupLocality || 'Available to assigned participants'}.</p><small>{locationLabel} Browser location sharing depends on the active page and device permission.</small></div>
  }
  return <div className="delivery-map"><div className="map-grid" /><div className="map-water" /><div className="map-road road-one" /><div className="map-road road-two" /><svg className="route-line" viewBox="0 0 580 220" preserveAspectRatio="none"><path d="M70,160 C160,145 130,85 245,102 S340,165 415,67 S490,85 530,45" /></svg><span className="map-pin pin-start"><Icons.CookingPot size={14} /></span><span className="map-pin pin-end"><Icons.Building2 size={14} /></span><span className="map-bike"><Icons.Bike size={15} /></span><span className="map-tag">DEMO · SAMPLE ROUTE</span><span className="map-distance"><b>0.8 mi</b><small>straight-line distance</small></span></div>
}

const statusLabel = {
  assigned: 'Awaiting delivery partner',
  to_pickup: 'Heading to pickup',
  at_pickup: 'At pickup',
  collected: 'Collected',
  in_transit: 'On the way',
  at_destination: 'At destination',
  delivered: 'Recipient confirmed',
  cancelled: 'Cancelled',
}

const isPoolTask = delivery => delivery.status === 'assigned' && !delivery.partner

export function DeliveryList({ user, data, setData, apiMode }) {
  const approved = user.suspended ? false : (user.verificationStatus ? user.verificationStatus === 'approved' : Boolean(user.verified) || !apiMode)
  const own = data.deliveries.filter(delivery => user.role === 'admin'
    || (user.role === 'donor' ? delivery.donor === user.id
      : user.role === 'partner' ? delivery.partner === user.id || (approved && isPoolTask(delivery))
        : delivery.recipient === user.id))
  const [selected, setSelected] = useState(own[0] || null)
  const [gps, setGps] = useState('')
  const [pickupCode, setPickupCode] = useState('')
  const [deliveryFilter, setDeliveryFilter] = useState('Active')
  const [deliveredQuantity, setDeliveredQuantity] = useState('')
  const [busy, setBusy] = useState(false)
  const visible = own.filter(delivery => deliveryFilter === 'Active' ? !['delivered', 'cancelled'].includes(delivery.status) : ['delivered', 'cancelled'].includes(delivery.status))

  useEffect(() => {
    if (!visible.some(delivery => delivery.id === selected?.id)) setSelected(visible[0] || null)
  }, [deliveryFilter, visible.map(delivery => delivery.id).join('|'), selected?.id])

  const accept = async delivery => {
    if (!approved) return
    setBusy(true)
    setGps('')
    if (apiMode) {
      try {
        await api.post(`/deliveries/${delivery.id}/accept`)
        const latest = await loadApiWorkspace()
        setData(previous => ({ ...previous, ...latest }))
        setSelected(latest.deliveries.find(item => item.id === delivery.id) || null)
        setGps('Task accepted. The donor and receiving partner were notified.')
      } catch (error) {
        setGps(error.response?.data?.error || 'Could not accept this task. Refresh and try again.')
      } finally {
        setBusy(false)
      }
      return
    }
    const next = {
      ...data,
      deliveries: data.deliveries.map(item => item.id === delivery.id ? { ...item, partner: user.id, status: 'to_pickup' } : item),
      notices: [
        { id: `n${Date.now()}-donor`, title: 'Delivery partner accepted', message: `${user.organization || user.name} accepted ${delivery.title}.`, time: 'Just now', unread: true },
        { id: `n${Date.now()}-recipient`, title: 'Delivery partner assigned', message: `A delivery partner is heading to collect ${delivery.title}.`, time: 'Just now', unread: true },
        ...data.notices,
      ],
    }
    setData(next)
    saveStore(next)
    setSelected(next.deliveries.find(item => item.id === delivery.id))
    setGps('Task accepted. The donor and receiving partner were notified in this demo.')
    setBusy(false)
  }

  const requestPickupCode = async () => {
    if (!apiMode) { setGps('DEMO · Sample handover verification. No real code is being sent.'); return }
    try {
      const { data: response } = await api.post(`/deliveries/${selected.id}/pickup-code`)
      if (response.demoCode) setPickupCode(response.demoCode)
      setGps(response.message || 'Code generated. Share it with the donor through your agreed secure channel.')
    } catch (error) {
      setGps(error.response?.data?.error || 'A delivery channel is not configured for pickup codes.')
    }
  }

  const advance = async delivery => {
    const flow = user.role === 'partner' ? { assigned: 'to_pickup', to_pickup: 'at_pickup', collected: 'in_transit', in_transit: 'at_destination' }
      : user.role === 'donor' ? { at_pickup: 'collected' }
        : user.role === 'recipient' ? { at_destination: 'delivered' } : {}
    const nextStatus = flow[delivery.status]
    if (!nextStatus) return
    if (apiMode) {
      try {
        if (user.role === 'donor' && nextStatus === 'collected') await api.post(`/deliveries/${delivery.id}/verify-pickup`, { code: pickupCode })
        await api.post(`/deliveries/${delivery.id}/status`, { status: nextStatus, confirmed: nextStatus === 'delivered', quantity: Number(deliveredQuantity || delivery.portions || 1) })
      } catch (error) {
        setGps(error.response?.data?.error || 'Status update did not reach the API. Confirm your role and current trip state.')
        return
      }
    }
    const next = {
      ...data,
      deliveries: data.deliveries.map(item => item.id === delivery.id ? { ...item, status: nextStatus, deliveredQuantity: nextStatus === 'delivered' ? Number(deliveredQuantity || delivery.portions || 1) : item.deliveredQuantity } : item),
      donations: data.donations.map(item => item.id === delivery.donationId && nextStatus === 'delivered' ? { ...item, status: 'delivered' } : item),
    }
    setData(next)
    saveStore(next)
    setSelected(next.deliveries.find(item => item.id === delivery.id))
    setPickupCode('')
    setGps('Trip updated. Recipient confirmation is recorded for this delivery.')
  }

  const shareLocation = () => {
    if (!navigator.geolocation) { setGps('This browser does not support location sharing.'); return }
    setGps('Requesting your location…')
    navigator.geolocation.getCurrentPosition(async position => {
      const location = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, time: Date.now() }
      if (apiMode) {
        try { await api.post(`/deliveries/${selected.id}/location`, location) }
        catch (error) { setGps(error.response?.data?.error || 'Could not send location to the delivery API.'); return }
      }
      const next = { ...data, deliveries: data.deliveries.map(item => item.id === selected?.id ? { ...item, ...location, currentLocation: { ...location, updatedAt: new Date() }, updatedAt: Date.now() } : item) }
      setData(next)
      saveStore(next)
      setGps(`Location shared at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Browser updates are one-time; share again to refresh.`)
    }, () => setGps('Location permission was not granted. Pickup details remain available.'), { enableHighAccuracy: true, timeout: 10000 })
  }

  const nextStatus = selected && (user.role === 'partner' ? { assigned: selected.partner === user.id ? 'to_pickup' : null, to_pickup: 'at_pickup', collected: 'in_transit', in_transit: 'at_destination' }[selected.status]
    : user.role === 'donor' ? { at_pickup: 'collected' }[selected.status]
      : user.role === 'recipient' ? { at_destination: 'delivered' }[selected.status] : null)

  return <>
    <div className="delivery-toolbar"><div className="delivery-filters"><button onClick={() => setDeliveryFilter('Active')} className={deliveryFilter === 'Active' ? 'filter-tab filter-on' : 'filter-tab'}>Active <span>{own.filter(delivery => !['delivered', 'cancelled'].includes(delivery.status)).length}</span></button><button onClick={() => setDeliveryFilter('Completed')} className={deliveryFilter === 'Completed' ? 'filter-tab filter-on' : 'filter-tab'}>Completed <span>{own.filter(delivery => ['delivered', 'cancelled'].includes(delivery.status)).length}</span></button></div>{user.role === 'partner' && <span className="gps-permission"><Icons.LocateFixed size={14} />Location is opt-in, trip-only</span>}</div>
    {user.role === 'partner' && !approved && <div className="verification-banner"><Icons.ShieldCheck size={16} />Account approval is required before accepting or updating delivery tasks.</div>}
    <div className="delivery-layout"><div className="delivery-list">{visible.map(delivery => <button className={`delivery-list-item ${selected?.id === delivery.id ? 'selected' : ''}`} key={delivery.id} onClick={() => { setSelected(delivery); setGps(''); setPickupCode('') }}><span className="delivery-list-icon"><Icons.Truck size={17} /></span><span><b>{delivery.title}</b><small>{delivery.organization} → {delivery.to}</small><em><i />{isPoolTask(delivery) ? 'Available to accept' : statusLabel[delivery.status] || delivery.status}</em></span><Icons.ChevronRight size={16} /></button>)}{!visible.length && <div className="empty-state"><Icons.Truck size={26} /><b>{user.role === 'partner' ? 'No available delivery tasks' : 'No active deliveries'}</b><span>{user.role === 'partner' ? 'New tasks matching the pickup area will appear here.' : 'Claims and delivery progress will appear here.'}</span></div>}</div>
      <div className="panel delivery-detail">{selected ? <><DeliveryMap selected={selected} apiMode={apiMode} /><div className="delivery-detail-body"><div className="delivery-detail-head"><div><span className="status-chip chip-green"><i />{isPoolTask(selected) ? 'Available to accept' : statusLabel[selected.status] || selected.status}</span><h2>{selected.title}</h2><p>Food rescue · {selected.pickupLocality || 'pickup area unavailable'}</p></div><span className="more-button" aria-hidden="true"><Icons.MoreHorizontal /></span></div>
        <div className="detail-route"><div className="detail-stop"><span className="stop-marker pickup-marker"><Icons.CookingPot size={13} /></span><div><span>PICKUP POINT</span><b>{selected.organization}</b><small>{selected.pickupAddress || (apiMode ? 'Pickup address unavailable' : '248 Wythe Avenue, Brooklyn')}</small></div></div><div className="detail-route-line" /><div className="detail-stop"><span className="stop-marker drop-marker"><Icons.Building2 size={13} /></span><div><span>RECEIVING ORGANIZATION</span><b>{selected.to}</b><small>{selected.toLocality ? `Area: ${selected.toLocality}` : 'Destination details are shared with authorized participants'}</small></div></div></div>
        <div className="trip-timeline"><span className="timeline-done"><i><Icons.Check size={10} /></i><b>Donation claimed</b><small>Delivery task created</small></span><span className="timeline-active"><i /><b>{isPoolTask(selected) ? 'Awaiting delivery partner' : statusLabel[selected.status] || 'Delivery in progress'}</b><small>Next: confirm each handoff</small></span><span><i /><b>Recipient confirmed</b><small>Received quantity is recorded</small></span></div>
        {gps && <div className={gps.includes('not') || gps.includes('Could') || gps.includes('cannot') ? 'form-error' : 'gps-message'} role="status">{gps}</div>}
        <div className="delivery-detail-actions">{user.role === 'partner' && isPoolTask(selected) && <button className="button button-dark button-sm" disabled={!approved || busy} onClick={() => accept(selected)}>{busy ? 'Accepting…' : 'Accept delivery task'} <Icons.ArrowRight size={15} /></button>}{apiMode && user.role === 'partner' && selected.status === 'at_pickup' && <button className="button button-light button-sm" onClick={requestPickupCode}><Icons.ShieldCheck size={14} />Create pickup code</button>}{user.role === 'partner' && ['to_pickup', 'at_pickup', 'collected', 'in_transit', 'at_destination'].includes(selected.status) && <button className="button button-light button-sm" onClick={shareLocation}><Icons.LocateFixed size={15} />Share location</button>}{apiMode && user.role === 'donor' && selected.status === 'at_pickup' && <input className="pickup-code-input" value={pickupCode} onChange={event => setPickupCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Pickup code" inputMode="numeric" maxLength={6} aria-label="Pickup verification code" />}{user.role === 'partner' && pickupCode && <span className="pickup-code-display">Code for donor: <b>{pickupCode}</b></span>}{user.role === 'recipient' && selected.status === 'at_destination' && <input className="pickup-code-input" type="number" min="1" max={selected.portions || undefined} value={deliveredQuantity || String(selected.portions || 1)} placeholder="Quantity received" onChange={event => setDeliveredQuantity(event.target.value)} aria-label="Quantity received" />}{nextStatus && <button className="button button-dark button-sm" onClick={() => advance(selected)}>{nextStatus === 'delivered' ? 'Confirm received' : `Mark ${statusLabel[nextStatus]?.toLowerCase() || nextStatus}`} <Icons.ArrowRight size={15} /></button>}<Link to="/app/incidents" className="issue-link"><Icons.CircleAlert size={14} />Report an issue</Link></div>
      </div></> : <div className="empty-state"><Icons.Truck /><b>Select a delivery</b><span>View pickup and handoff details here.</span></div>}</div></div>
  </>
}
