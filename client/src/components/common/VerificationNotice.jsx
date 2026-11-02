import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'

export function VerificationNotice({ user, action }) {
  const status = user.suspended ? 'suspended' : user.verificationStatus || (user.verified ? 'approved' : 'pending')
  const heading = status === 'rejected' ? 'Update your application' : status === 'suspended' ? 'Account suspended' : 'Your application is in review'
  const message = status === 'rejected'
    ? user.verificationReason || 'Your application was not approved. Review your account details and resubmit for Admin review.'
    : status === 'suspended'
      ? 'This account is suspended. Contact platform support if you believe this is an error.'
      : `A FoodResQ administrator needs to approve your account before you can ${action}.`
  return <section className={`panel verification-gate status-${status}`}><span className="verification-gate-icon"><Icons.ShieldAlert size={24} /></span><span className="section-kicker">ACCOUNT VERIFICATION</span><h2>{heading}</h2><p>{message}</p>{status === 'rejected' && <Link className="button button-dark button-sm" to="/app/settings">Review and resubmit details <Icons.ArrowRight size={14} /></Link>}</section>
}
