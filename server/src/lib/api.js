import axios from 'axios'

const API_BASE = 'http://localhost:5000'

axios.defaults.withCredentials = true

function getAuthHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const reportsApi = {
  list: async (params = {}) => {
    const res = await axios.get(`${API_BASE}/reports`, {
      params,
      headers: getAuthHeaders(),
    })
    return res.data
  },

  createText: async text => {
    const res = await axios.post(
      `${API_BASE}/reports`,
      { sourceType: 'text', text },
      { headers: { 'Content-Type': 'application/json', ...getAuthHeaders() } }
    )
    return res.data
  },

  uploadPdf: async file => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await axios.post(`${API_BASE}/reports/pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...getAuthHeaders(),
      },
    })
    return res.data
  },
}

export const summariesApi = {
  generate: async id => {
    const res = await axios.post(`${API_BASE}/summaries/${id}`, {}, {
      headers: getAuthHeaders(),
    })
    return res.data
  },
}
