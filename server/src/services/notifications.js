import { Notification } from '../models/index.js'

export const notify = (user, title, body, href = '/app') => Notification.create({ user, title, body, href })
