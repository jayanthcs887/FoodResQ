import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { api } from '../../services/api.js'
import { loadApiWorkspace } from '../../services/workspace.js'
import { Brand } from '../../components/layout/SiteChrome.jsx'

export function AdminLogin({ user, apiMode, onLogin, onLogout }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  if (user?.role === 'admin' && apiMode) return <Navigate to="/admin" replace />

  const submit = async event => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      if (data.user.role !== 'admin') {
        try { await api.post('/auth/logout') } catch {}
        if (user) await onLogout()
        setError('This account does not have administrator access.')
        return
      }
      const workspace = await loadApiWorkspace()
      onLogin(data.user, true, { workspace })
      navigate('/admin', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'The Admin service is unavailable. Check the API and try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="admin-login-page">
    <div className="admin-login-top"><Brand /><Link to="/">Return to FoodResQ <Icons.ArrowUpRight size={15} /></Link></div>
    <section className="admin-login-card">
      <div className="admin-login-mark"><Icons.ShieldCheck size={23} /></div>
      <span className="section-kicker">RESTRICTED OPERATIONS</span>
      <h1>Administrator<br /><em>sign in.</em></h1>
      <p>Use your provisioned FoodResQ administrator account to continue.</p>
      <form onSubmit={submit} className="form-stack">
        <label>Email address<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button button-dark button-full" disabled={busy}>{busy ? 'Checking account…' : 'Sign in securely'} <Icons.ArrowRight size={16} /></button>
      </form>
      <div className="admin-login-security"><Icons.LockKeyhole size={15} /> Session uses the same HTTP-only cookie and rate-limited API sign-in.</div>
      <Link className="admin-login-secondary" to="/login">Looking for your organization workspace?</Link>
    </section>
  </main>
}
