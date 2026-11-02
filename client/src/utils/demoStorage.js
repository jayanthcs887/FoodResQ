import { initialData } from '../constants/demoData.js'

export const readStore = () => {
  try {
    return { ...initialData, ...JSON.parse(localStorage.getItem('foodresq-data') || '{}') }
  } catch {
    return initialData
  }
}

export const saveStore = data => {
  if (localStorage.getItem('foodresq-api-mode') === 'true') return
  localStorage.setItem('foodresq-data', JSON.stringify(data))
}
