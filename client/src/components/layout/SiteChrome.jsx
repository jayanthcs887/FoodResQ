import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'

export function Brand({ light = false, compact = false }) {
  return <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="FoodResQ home"><span className="brand-mark"><Icons.Sprout size={19} strokeWidth={2.5} /></span><span className="brand-word">foodresq<span className="brand-dot">.</span></span>{!compact && <span className="brand-tagline">RESCUE · SHARE · REPEAT</span>}</Link>
}

export function PublicHeader() {
  const [open, setOpen] = useState(false)
  return <header className="public-header"><Brand /><button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <Icons.X /> : <Icons.Menu />}</button><nav className={`public-nav ${open ? 'is-open' : ''}`}><a href="/#how-it-works">How it works</a><a href="/#impact">Our impact</a><a href="/#about">About</a><Link to="/login" className="nav-login">Log in</Link><Link to="/register" className="button button-dark button-sm">Join the network <Icons.ArrowUpRight size={15} /></Link></nav></header>
}

export function Metric({ value, label, icon: Icon }) { return <div className="impact-metric"><span className="metric-icon"><Icon size={17} /></span><strong>{value}</strong><span>{label}</span></div> }

export function PublicFooter() { return <footer className="public-footer"><Brand /><span>Care travels well.</span><nav><Link to="/about">About</Link><Link to="/food-safety">Food safety</Link><Link to="/faq">FAQs</Link><Link to="/contact">Contact</Link></nav><small>© 2026 FoodResQ Network · Built for local good</small></footer> }
