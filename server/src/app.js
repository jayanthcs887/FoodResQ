import { Router } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import express from 'express'
import cookieParser from 'cookie-parser'
import platformRoutes from './routes/platform.routes.js'
import authRoutes from './routes/auth.routes.js'
import donationRoutes from './routes/donations.routes.js'
import deliveryRoutes from './routes/deliveries.routes.js'
import distributionRoutes from './routes/distributions.routes.js'
import incidentRoutes from './routes/incidents.routes.js'
import notificationRoutes from './routes/notifications.routes.js'
import adminRoutes from './routes/admin.routes.js'
import { CLIENT_ORIGIN } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.use('/api', platformRoutes)
app.use('/api', authRoutes)
app.use('/api', donationRoutes)
app.use('/api', deliveryRoutes)
app.use('/api', distributionRoutes)
app.use('/api', incidentRoutes)
app.use('/api', notificationRoutes)
app.use('/api', adminRoutes)
app.use(errorHandler)

export default app

