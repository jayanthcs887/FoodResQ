import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { api } from '../../services/api.js'
import { loadApiWorkspace } from '../../services/workspace.js'
import { demoDonations } from '../../constants/demoData.js'
import { saveStore } from '../../utils/demoStorage.js'
import { DonationCard } from './DashboardPages.jsx'
import { VerificationNotice } from '../../components/common/VerificationNotice.jsx'

export function DonorListingRoute(props) {
  const { user, apiMode } = props
  const status = user.suspended ? 'suspended' : user.verificationStatus || (user.verified ? 'approved' : 'pending')
  if (apiMode && status !== 'approved') return <VerificationNotice user={user} action="publish food listings" />
  return <NewDonation {...props} />
}

export function DonationBrowser({ user, data, setData, apiMode }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All food')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const recipient = user.role === 'recipient'
  const verificationStatus = user.suspended ? 'suspended' : user.verificationStatus || (user.verified ? 'approved' : 'pending')
  const canClaimFood = !apiMode || verificationStatus === 'approved'
  const rows = data.donations
    .filter(donation => recipient ? donation.status === 'available' && donation.time > Date.now() : user.role === 'donor' ? donation.donor === user.id : true)
    .filter(donation => `${donation.title} ${donation.organization} ${donation.category} ${donation.locality}`.toLowerCase().includes(search.toLowerCase()))
    .filter(donation => filter === 'All food' || donation.category === filter)

  const claim = async donation => {
    if (busyId) return
    setBusyId(donation.id)
    setError('')
    if (apiMode) {
      try {
        const { data: response } = await api.post(`/donations/${donation.id}/claim`)
        const latest = await loadApiWorkspace()
        setData(previous => ({ ...previous, ...latest }))
        setToast(response.notifiedDeliveryPartners
          ? 'Claim confirmed. Verified delivery partners in the pickup area were notified.'
          : 'Claim confirmed. The delivery task is available; no verified partner matched its pickup area yet.')
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Could not claim this donation. Refresh and try again.')
      } finally {
        setBusyId('')
      }
      return
    }

    const delivery = {
      id: `trip-${Date.now()}`,
      donationId: donation.id,
      title: donation.title,
      organization: donation.organization,
      to: user.organization || user.name,
      toLocality: user.locality || '',
      pickupAddress: donation.address,
      pickupLocality: donation.locality,
      status: 'assigned',
      deadline: donation.deadline,
      donor: donation.donor,
      recipient: user.id,
      partner: '',
      portions: donation.portions,
    }
    const request = { id: `r${Date.now()}`, donationId: donation.id, donationTitle: donation.title, organization: user.organization || user.name, recipient: user.id, quantity: donation.quantity, unit: donation.unit, status: 'accepted', note: 'Direct claim', time: 'Just now' }
    const next = {
      ...data,
      donations: data.donations.map(item => item.id === donation.id ? { ...item, status: 'reserved' } : item),
      requests: [request, ...data.requests],
      deliveries: [delivery, ...data.deliveries],
      notices: [
        { id: `n${Date.now()}-recipient`, title: 'Claim confirmed', message: `${donation.title} is reserved for ${request.organization}.`, time: 'Just now', unread: true },
        { id: `n${Date.now()}-donor`, title: 'Donation claimed', message: `${request.organization} claimed ${donation.title}. A delivery task is available.`, time: 'Just now', unread: true },
        { id: `n${Date.now()}-partner`, title: 'Delivery task available', message: `${donation.title} needs collection in ${donation.locality}.`, time: 'Just now', unread: true },
        ...data.notices,
      ],
    }
    setData(next)
    saveStore(next)
    setToast('Claim confirmed. The delivery task is available to verified delivery partners.')
    setBusyId('')
  }

  return <>
    <div className="toolbar"><div className="search-box"><Icons.Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search food, kitchen, or neighborhood" /></div><label className="filter-select"><Icons.Filter size={15} /><select value={filter} onChange={event => setFilter(event.target.value)}><option>All food</option>{['Prepared meals', 'Bakery', 'Produce', 'Dairy', 'Packaged'].map(value => <option key={value}>{value}</option>)}</select><Icons.ChevronDown size={14} /></label>{user.role === 'donor' && <Link to="/app/new" className="button button-dark button-sm"><Icons.Plus size={16} />New listing</Link>}</div>
    {recipient && !canClaimFood && <VerificationNotice user={user} action="claim food" />}
    {recipient && <div className="location-banner"><span className="loc-icon"><Icons.MapPin size={17} /></span><span><b>Showing food around {user.locality || 'your neighborhood'}</b><small>{user.locality ? 'Listings are matched by the pickup neighborhood.' : 'Add a service area to see neighborhood matches.'}</small></span><span className="location-note"><Icons.LocateFixed size={14} />Area set by profile</span></div>}
    {toast && <div className="success-banner" role="status"><Icons.CheckCheck size={16} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss message"><Icons.X size={15} /></button></div>}
    {error && <div className="form-error listing-error" role="alert">{error}</div>}
    <div className="food-grid">{rows.map(donation => <DonationCard key={donation.id} donation={donation} onRequest={recipient && canClaimFood ? () => claim(donation) : null} requestLabel="Claim donation" busy={busyId === donation.id} />)}</div>
    {!rows.length && <div className="empty-panel"><span><Icons.Search size={22} /></span><h3>{recipient ? 'No available food matches this area' : 'Nothing here by that name'}</h3><p>{recipient ? 'Published listings that match your neighborhood will appear here.' : 'Try another search or clear the filters to see more.'}</p><button className="text-link" onClick={() => { setSearch(''); setFilter('All food') }}>Clear filters <Icons.ArrowRight size={14} /></button></div>}
  </>
}

export function NewDonation({ user, data, setData, apiMode }) {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [matchedRecipients, setMatchedRecipients] = useState(null)
  const submit = async event => {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const item = {
      id: `d${Date.now()}`,
      title: form.get('title'),
      description: form.get('description'),
      organization: user.organization,
      category: form.get('category'),
      foodType: form.get('foodType'),
      quantity: Number(form.get('quantity')),
      unit: form.get('unit'),
      portions: Number(form.get('portions')),
      locality: user.locality || '',
      address: form.get('address'),
      deadline: new Date(form.get('deadline')).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
      time: new Date(form.get('deadline')).getTime(),
      storage: form.get('storage'),
      status: 'available',
      distance: 'Nearby',
      donor: user.id,
      image: form.get('category') === 'Bakery' ? demoDonations[1].image : form.get('category') === 'Produce' ? demoDonations[2].image : demoDonations[0].image,
    }
    let matchedCount = null
    if (apiMode) {
      try {
        const { data: response } = await api.post('/donations', {
          ...item,
          preparedAt: new Date(form.get('preparedAt')),
          deadline: new Date(form.get('deadline')),
          pickup: { address: item.address, locality: form.get('locality') || item.locality },
          safety: { sealed: form.get('sealed') === 'on', temperatureKnown: form.get('temperatureKnown') === 'on', allergens: form.get('allergens'), donorConfirmed: form.get('confirm') === 'on' },
        })
        item.id = response.donation.id
        item.status = response.donation.status
        item.time = new Date(response.donation.deadline).getTime()
        item.deadline = new Date(response.donation.deadline).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
        matchedCount = response.matchedRecipients
        setMatchedRecipients(matchedCount)
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Could not publish the listing. Check the details and try again.')
        return
      }
    }
    const matchingText = matchedCount === 0 ? 'No approved receiving partner matches this pickup area yet; the listing remains available.'
      : matchedCount > 0 ? `${matchedCount} approved receiving partner${matchedCount === 1 ? '' : 's'} in this area were notified.`
        : 'Eligible receiving partners can now see and claim the listing.'
    const next = {
      ...data,
      donations: [item, ...data.donations],
      notices: [{ id: `n${Date.now()}`, title: 'Listing published', message: `${item.title} · ${matchingText}`, time: 'Just now', unread: true }, ...data.notices],
    }
    setData(next)
    saveStore(next)
    setSent(true)
  }

  if (sent) return <div className="form-success"><span><Icons.Check size={25} /></span><span className="section-kicker">LISTING PUBLISHED</span><h2>Your food is ready<br />to find <em>its people.</em></h2><p>{matchedRecipients === 0 ? 'No verified receiving partner matched the pickup area yet. Your listing stays available until it is claimed or its collection deadline passes.' : 'Verified receiving partners can see the food details and claim this listing directly. No listing approval step is required.'}</p><div><Link to="/app/donations" className="button button-dark">View my listing <Icons.ArrowRight size={16} /></Link><Link to="/app" className="button button-light">Back to overview</Link></div></div>

  return <form className="donation-form" onSubmit={submit}><div className="form-column"><section className="form-section"><div className="form-section-title"><span>01</span><div><h2>The food</h2><p>Tell your neighbors what you have to share.</p></div></div><div className="field-grid"><label className="field-full">Listing title<input name="title" placeholder="e.g. Fresh vegetable soup & sourdough" required maxLength="120" /></label><label className="field-full">A little more about it<textarea name="description" placeholder="What’s included? Anything the receiving team should know?" required maxLength="1000" rows="3" /></label><label>Food category<select name="category" required>{['Prepared meals', 'Bakery', 'Produce', 'Dairy', 'Packaged'].map(value => <option key={value}>{value}</option>)}</select></label><label>Food preference<select name="foodType" required>{['Vegetarian', 'Vegan', 'Non-vegetarian', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label><label>Available quantity<input name="quantity" type="number" min="1" placeholder="30" required /></label><label>Quantity unit<select name="unit"><option value="portions">Portions</option><option value="kg">Kilograms</option><option value="boxes">Boxes</option></select></label><label>Estimated meal portions<input name="portions" type="number" min="1" placeholder="30" required /></label><label>Prepared at<input name="preparedAt" type="datetime-local" required /></label></div></section>
    <section className="form-section"><div className="form-section-title"><span>02</span><div><h2>Pickup & handling</h2><p>Clear details help the right people arrive prepared.</p></div></div><div className="field-grid"><label className="field-full">Pickup address<input name="address" placeholder="Street address, entrance or pickup point" required /></label><label>Neighborhood<input name="locality" defaultValue={user.locality || ''} required maxLength="100" /></label><label>Collect by<input name="deadline" type="datetime-local" min={new Date().toISOString().slice(0, 16)} required /></label><label className="field-full">Storage & handling notes<textarea name="storage" placeholder="How has the food been stored? Any useful handling instructions?" rows="2" required maxLength="300" /></label><label className="field-full">Allergen or special handling notes<input name="allergens" placeholder="e.g. Contains nuts; keep chilled" maxLength="300" /></label></div><div className="check-row"><label><input type="checkbox" name="sealed" /> Food is appropriately covered or sealed</label><label><input type="checkbox" name="temperatureKnown" /> Storage conditions are known and described</label></div></section>
    <div className="safety-inline"><Icons.Shield size={17} /><p><b>Care comes first.</b> Your listing details help others assess suitability; they do not certify that food is safe. Follow official local food-safety guidance.</p></div><label className="confirm-row"><input type="checkbox" name="confirm" required /><span>I confirm that the details above are accurate to the best of my knowledge.</span></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="form-actions"><Link to="/app/donations" className="button button-light">Cancel</Link><button className="button button-dark"><Icons.Plus size={16} />Publish listing <Icons.ArrowRight size={15} /></button></div></div>
    <aside className="form-aside"><div className="aside-sticky"><span className="section-kicker">YOUR LISTING CHECKLIST</span><div className="checklist-item"><span><Icons.Check size={13} /></span><p><b>Describe the food</b><small>Type, quantity and estimated portions</small></p></div><div className="checklist-item"><span><Icons.Check size={13} /></span><p><b>Share the handling details</b><small>Preparation and storage information</small></p></div><div className="checklist-item"><span><Icons.Check size={13} /></span><p><b>Set a clear collection window</b><small>Give a receiving team time to respond</small></p></div><div className="aside-help"><Icons.Sparkles size={17} /><b>A good note goes a long way.</b><p>Mention packaging, allergens, or anything that makes pickup easier.</p></div><div className="privacy-note"><Icons.ShieldCheck size={14} /> Your business contact details stay private until needed.</div></div></aside></form>
}

export function RequestsPage({ user, data, setData, apiMode }) {
  const donor = user.role === 'donor' || user.role === 'admin'
  const [error, setError] = useState('')
  const rows = donor ? data.requests.filter(request => user.role === 'admin' || data.donations.some(donation => donation.id === request.donationId && donation.donor === user.id)) : data.requests.filter(request => request.recipient === user.id || request.organization === user.organization)

  const act = async (request, nextStatus) => {
    const decision = nextStatus === 'accepted' ? 'accept' : 'decline'
    let deliveryId = `trip-${Date.now()}`
    if (apiMode) {
      try {
        const { data: response } = await api.post(`/donations/${request.donationId}/requests/${request.id}/respond`, { decision })
        if (response.deliveryId) deliveryId = response.deliveryId
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Could not update this legacy request.')
        return
      }
    }
    const donation = data.donations.find(item => item.id === request.donationId)
    const requests = data.requests.map(item => item.id === request.id ? { ...item, status: nextStatus } : item)
    const updatedDonation = nextStatus === 'accepted' && donation ? { ...donation, status: 'reserved' } : donation
    const delivery = nextStatus === 'accepted' && donation ? {
      id: deliveryId, donationId: donation.id, title: donation.title, organization: donation.organization,
      to: request.organization, status: apiMode ? 'assigned' : 'to_pickup', distance: donation.distance || 'Nearby',
      deadline: donation.deadline, donor: donation.donor, recipient: request.recipient || user.id,
      partner: '', portions: donation.portions,
    } : null
    const next = {
      ...data,
      requests,
      donations: updatedDonation ? data.donations.map(item => item.id === donation.id ? updatedDonation : item) : data.donations,
      deliveries: delivery ? [delivery, ...data.deliveries.filter(item => item.id !== delivery.id)] : data.deliveries,
      notices: [{ id: `n${Date.now()}`, title: nextStatus === 'accepted' ? 'Request accepted' : 'Request declined', message: `${donation?.title || 'Donation request'} · ${request.organization}`, time: 'Just now', unread: true }, ...data.notices],
    }
    setData(next)
    saveStore(next)
    setError('')
  }

  return <div className="request-layout"><div className="panel request-panel"><div className="panel-head"><div><span className="panel-kicker">{donor ? 'FROM YOUR NEIGHBORS' : 'YOUR COMMUNITY NEEDS'}</span><h2>{donor ? 'Claims and legacy requests' : 'Your food claims'}</h2></div><span className="count-badge">{rows.length} records</span></div>{error && <div className="form-error listing-error">{error}</div>}{rows.map((request, index) => <div className="request-row" key={request.id}><span className={`request-avatar ra-${index % 3}`}>{(request.organization || 'HT').split(' ').map(word => word[0]).slice(0, 2).join('')}</span><div className="request-main"><div className="request-title"><b>{request.organization}</b><span className={`request-status rs-${request.status}`}>{request.status === 'pending' ? 'Needs a reply' : request.status === 'accepted' ? 'Claimed' : request.status}</span></div><p>{request.status === 'accepted' ? 'Claimed' : 'Requested'} <b>{request.quantity} {request.unit || 'portions'}</b> of {request.donationTitle || 'a food listing'}</p><small>{request.note} · {request.time || 'Recently'}</small></div><div className="request-actions">{donor && request.status === 'pending' ? <><button className="button button-light button-sm" onClick={() => act(request, 'declined')}>Decline</button><button className="button button-dark button-sm" onClick={() => act(request, 'accepted')}><Icons.Check size={14} />Accept legacy request</button></> : request.status === 'accepted' ? <Link to="/app/deliveries" className="text-link">View delivery <Icons.ArrowRight size={14} /></Link> : <span className="request-wait">Waiting for donor</span>}</div></div>)}{!rows.length && <div className="empty-state"><Icons.ClipboardList size={26} /><b>No claims yet</b><span>Direct claims and delivery progress will appear here.</span></div>}</div><aside className="request-aside"><span className="aside-round-icon"><Icons.HeartHandshake size={21} /></span><span className="section-kicker">DIRECT COMMUNITY MATCHING</span><h3>Food claimed,<br />care coordinated.</h3><p>New claims reserve an available listing and create a delivery task automatically. Older pending requests remain available here for follow-up.</p><div className="note-divider" /><span className="safety-small"><Icons.ShieldCheck size={14} />Verification helps build trust, but never replaces your own judgment.</span></aside></div>
}
