import app from './app.js'
import { PORT } from './config/env.js'
import { connectDatabase } from './config/db.js'

try {
  await connectDatabase()
  app.listen(PORT, () => console.log(`FoodResQ API listening on http://localhost:${PORT}`))
} catch (error) {
  console.error('Could not connect to MongoDB:', error.message)
  process.exit(1)
}


