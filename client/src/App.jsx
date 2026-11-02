import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext } from './context/AuthContext.jsx'
import { api } from './services/api.js'
import { initialData } from './constants/demoData.js'
import { PUBLIC_ROLES } from './constants/roles.js'
import { readStore } from './utils/demoStorage.js'
import { loadApiWorkspace } from './services/workspace.js'
import { Brand } from './components/layout/SiteChrome.jsx'
import { Landing } from './pages/public/LandingPage.jsx'
import { PublicInfo } from './pages/public/PublicInfoPage.jsx'
import { JoinPage, LoginPage, RegisterPage } from './pages/auth/AuthPages.jsx'
import { ProtectedShell } from './layouts/WorkspaceLayout.jsx'
import { AdminRoutes } from './routes/AdminRoutes.jsx'

export function App() {
  const [user, setUser] = useState(null)
  const [apiMode, setApiMode] = useState(false)
  const [data, setData] = useState(readStore)
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    let active = true
    const saved = localStorage.getItem('foodresq-demo-user')
    if (saved) {
      try {
        const savedUser = JSON.parse(saved)
        if (PUBLIC_ROLES.includes(savedUser?.role)) setUser(savedUser)
        else localStorage.removeItem('foodresq-demo-user')
      } catch { localStorage.removeItem('foodresq-demo-user') }
    }
    api.get('/auth/me').then(async ({ data: response }) => {
      if (!active) return
      localStorage.removeItem('foodresq-demo-user')
      localStorage.setItem('foodresq-api-mode', 'true')
      setUser(response.user)
      setApiMode(true)
      const connected = await loadApiWorkspace()
      if (active) setData({ ...initialData, ...connected, incidents: [] })
    }).catch(() => {
      if (active) {
        localStorage.setItem('foodresq-api-mode', 'false')
        setApiMode(false)
      }
    }).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const auth = useMemo(() => ({ user, setUser, apiMode }), [user, apiMode])
  const login = (nextUser, fromApi, options = {}) => {
    setUser(nextUser)
    setApiMode(fromApi)
    localStorage.setItem('foodresq-api-mode', fromApi ? 'true' : 'false')
    if (!fromApi) localStorage.setItem('foodresq-demo-user', JSON.stringify(nextUser))
    else {
      localStorage.removeItem('foodresq-demo-user')
      if (options.workspace) setData({ ...initialData, ...options.workspace, incidents: [] })
      else if (options.loadWorkspace !== false) loadApiWorkspace().then(connected => setData({ ...initialData, ...connected, incidents: [] }))
    }
  }
  const logout = async () => {
    if (apiMode) try { await api.post('/auth/logout') } catch {}
    localStorage.removeItem('foodresq-demo-user')
    localStorage.setItem('foodresq-api-mode', 'false')
    setUser(null)
    setApiMode(false)
    setData(readStore())
  }

  if (loading && (location.pathname.startsWith('/app') || location.pathname.startsWith('/admin'))) {
    return <div className="loading-screen"><Brand /><span className="loading-pulse" />Checking your FoodResQ session…</div>
  }

  return <AuthContext.Provider value={auth}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/register" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace /> : <RegisterPage onLogin={login} />} />
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace /> : <LoginPage onLogin={login} />} />
      <Route path="/app/*" element={!user ? <Navigate to="/login" replace /> : user.role === 'admin' ? <Navigate to="/admin" replace /> : <ProtectedShell user={user} onLogout={logout} data={data} setData={setData} apiMode={apiMode} />} />
      <Route path="/admin/*" element={<AdminRoutes user={user} apiMode={apiMode} onLogin={login} onLogout={logout} data={data} setData={setData} />} />
      {['how-it-works', 'about', 'impact', 'food-safety', 'faq', 'contact'].map(type => <Route key={type} path={`/${type}`} element={<PublicInfo type={type} />} />)}
      <Route path="*" element={<Landing />} />
    </Routes>
  </AuthContext.Provider>
}
