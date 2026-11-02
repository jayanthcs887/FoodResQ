import mongoose from 'mongoose'
import { MONGODB_URI } from './env.js'

export async function connectDatabase() {
  if (!MONGODB_URI) {
    console.warn('MONGODB_URI is not set; API requests requiring data will be unavailable.')
    return false
  }

  await mongoose.connect(MONGODB_URI)
  return true
}
