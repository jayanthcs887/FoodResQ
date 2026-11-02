import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const configDirectory = path.dirname(fileURLToPath(import.meta.url))
const serverDirectory = path.resolve(configDirectory, '../..')
dotenv.config({ path: path.join(serverDirectory, '.env') })
// Keep existing root-level development configuration working while preferring
// server/.env for server-specific values. dotenv does not overwrite values
// already loaded above or supplied by the process environment.
dotenv.config({ path: path.resolve(serverDirectory, '..', '.env') })

export const PORT = Number(process.env.PORT || 4000)
export const MONGODB_URI = process.env.MONGODB_URI || ''
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
export const isProduction = process.env.NODE_ENV === 'production'

