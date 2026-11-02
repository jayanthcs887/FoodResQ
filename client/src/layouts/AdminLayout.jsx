import { Link, NavLink, Outlet } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { Brand } from '../components/layout/SiteChrome.jsx'
import './admin.css'

const navItems = [
  { to: '/admin', label: 'Overview', icon: Icons.LayoutDashboard, end: true },
  { to: '/admin/verification', label: 'Verification', icon: Icons.UserRoundCheck },
  { to: '/admin/accounts', label: 'Accounts', icon: Icons.UsersRound },
  { to: '/admin/listings', label: 'Food listings', icon: Icons.Boxes },
  { to: '/admin/deliveries', label: 'Delivery monitor', icon: Icons.Truck },
  { to: '/admin/incidents', label: 'Incident reports', icon: Icons.ShieldAlert },
]

export function AdminLayout({ user, onLogout }) {
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-brand"><Brand compact light /></div>
      <div className="admin-account"><span className="admin-account-icon"><Icons.Shield size={18} /></span><span><b>{user.name}</b><small>Platform administrator</small></span></div>
      <span className="admin-nav-label">OPERATIONS</span>
      <nav className="admin-nav">{navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `admin-nav-link ${isActive ? 'admin-nav-active' : ''}`}><Icon size={17} /><span>{label}</span></NavLink>)}</nav>
      <div className="admin-sidebar-bottom"><div><Icons.LockKeyhole size={15} /><span>Restricted admin workspace</span></div><button onClick={onLogout}><Icons.LogOut size={16} />Sign out</button></div>
    </aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><span>FOODRESQ OPERATIONS</span><b>Admin Panel</b></div><Link to="/" className="admin-public-link">View public site <Icons.ArrowUpRight size={14} /></Link></header>
      <div className="admin-content"><Outlet /></div>
    </main>
  </div>
}
