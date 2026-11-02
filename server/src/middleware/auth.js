import jwt from 'jsonwebtoken'
import { User } from '../models/index.js'
import { asyncRoute } from '../utils/asyncRoute.js'
import { CLIENT_ORIGIN, isProduction } from '../config/env.js'
import { isSupportedRole } from '../domain.js'

function tokenSecret() {
  if (!process.env.JWT_SECRET && isProduction) throw new Error('JWT_SECRET is required in production')
  return process.env.JWT_SECRET || 'local-development-only-secret-change-me'
}

export const issueSession = user => {
  if (!isSupportedRole(user.role)) throw new Error('Cannot create a session for an unsupported role.')
  return jwt.sign({ sub: user.id, role: user.role }, tokenSecret(), { expiresIn: '7d' })
}

export const setSession = (res, token) => res.cookie('foodresq_session', token, {
  httpOnly: true,
  secure: isProduction || process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
})

export const clearSession = res => res.clearCookie('foodresq_session', {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction || process.env.COOKIE_SECURE === 'true',
  path: '/',
})

export const requireAuth = asyncRoute(async (req, res, next) => {
  const token = req.cookies.foodresq_session
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' })
  try {
    const payload = jwt.verify(token, tokenSecret())
    const user = await User.findById(payload.sub)
    if (!user || user.suspended || user.verificationStatus === 'suspended' || !isSupportedRole(user.role)) return res.status(401).json({ error: 'This account cannot access the platform.' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Your session expired. Please sign in again.' })
  }
})

export const allow = (...roles) => (req, res, next) => isSupportedRole(req.user?.role) && roles.includes(req.user.role)
  ? next()
  : res.status(403).json({ error: 'You do not have permission to do that.' })

export const requireSameOrigin = (req, res, next) => {
  const origin = req.get('origin')
  const fetchSite = req.get('sec-fetch-site')
  if ((origin && origin !== CLIENT_ORIGIN) || fetchSite === 'cross-site') {
    return res.status(403).json({ error: 'This request did not come from the FoodResQ application.' })
  }
  next()
}
