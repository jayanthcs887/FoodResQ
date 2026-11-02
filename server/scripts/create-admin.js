import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { MONGODB_URI } from '../src/config/env.js'
import { User } from '../src/models/index.js'

if (!MONGODB_URI) {
  console.error('Set MONGODB_URI in server/.env before creating an administrator.')
  process.exit(1)
}

function hiddenPrompt(label) {
  return new Promise((resolve, reject) => {
    const input = process.stdin
    if (!input.isTTY || !input.setRawMode) return reject(new Error('Run this command in an interactive terminal.'))
    let value = ''
    process.stdout.write(label)
    input.setRawMode(true)
    input.resume()
    const onData = data => {
      for (const character of data.toString('utf8')) {
        if (character === '\u0003') {
          input.setRawMode(false); input.pause(); input.off('data', onData)
          reject(new Error('Cancelled.')); return
        }
        if (character === '\r' || character === '\n') {
          input.setRawMode(false); input.pause(); input.off('data', onData)
          process.stdout.write('\n'); resolve(value); return
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1); process.stdout.write('\b \b'); continue
        }
        if (character >= ' ') { value += character; process.stdout.write('*') }
      }
    }
    input.on('data', onData)
  })
}

try {
  const name = (await hiddenPrompt('Administrator name: ')).trim()
  const email = (await hiddenPrompt('Administrator email: ')).trim().toLowerCase()
  const password = await hiddenPrompt('Password (minimum 14 characters): ')
  const confirm = await hiddenPrompt('Confirm password: ')
  if (!name || !email.includes('@') || password.length < 14 || password !== confirm) throw new Error('Name, valid email and matching password (14+ characters) are required.')
  await mongoose.connect(MONGODB_URI)
  if (await User.exists({ email })) throw new Error('An account with that email already exists.')
  const passwordHash = await bcrypt.hash(password, 12)
  await User.create({ name, email, passwordHash, role: 'admin', organization: 'FoodResQ Operations', verified: true, verificationStatus: 'approved' })
  console.log('Administrator account created. Keep these credentials private.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (mongoose.connection.readyState) await mongoose.disconnect()
}


