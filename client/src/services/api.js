import axios from 'axios'

const configuredApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const normalizedApiUrl = configuredApiUrl.replace(/\/+$/, '')

const baseURL = normalizedApiUrl.endsWith('/api') ? normalizedApiUrl : `${normalizedApiUrl}/api`

const api = axios.create({
  baseURL,
  withCredentials: true,
})

export default api
export { api }
