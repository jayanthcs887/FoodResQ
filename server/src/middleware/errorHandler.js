export function errorHandler(err, _req, res, _next) {
  console.error(err)
  if (err.name === 'ValidationError') return res.status(400).json({ error: 'Some submitted details are invalid.' })
  if (err.name === 'CastError') return res.status(400).json({ error: 'That record identifier is invalid.' })
  if (err.code === 11000) return res.status(409).json({ error: 'That record already exists.' })
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
}
