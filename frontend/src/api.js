const BASE = '/api'

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    let detail
    try {
      const body = await response.json()
      detail = body.detail
    } catch {
      detail = null
    }
    throw new Error(
      typeof detail === 'string' ? detail : `Request failed (${response.status})`,
    )
  }
  if (response.status === 204) return null
  return response.json()
}

const query = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      search.set(key, value)
    }
  })
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

const post = (path, body) =>
  request(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
const patch = (path, body) =>
  request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) })

export const api = {
  dashboard: () => request('/dashboard'),
  collections: () => request('/collections'),

  customers: () => request('/customers'),
  customer: (id) => request(`/customers/${id}`),
  createCustomer: (body) => post('/customers', body),
  updateCustomer: (id, body) => patch(`/customers/${id}`, body),

  contracts: (params) => request(`/contracts${query(params)}`),
  contract: (id) => request(`/contracts/${id}`),
  createContract: (body) => post('/contracts', body),
  updateContractStatus: (id, status) =>
    patch(`/contracts/${id}${query({ status })}`),

  invoices: (params) => request(`/invoices${query(params)}`),
  invoice: (id) => request(`/invoices/${id}`),
  createInvoice: (body) => post('/invoices', body),
  recordPayment: (id, body) => post(`/invoices/${id}/payments`, body),
  openDispute: (id, body) => post(`/invoices/${id}/disputes`, body),
  createPaymentPlan: (id, body) => post(`/invoices/${id}/payment-plans`, body),
  logAction: (id, body) => post(`/invoices/${id}/actions`, body),
  writeOff: (id, body) => post(`/invoices/${id}/write-off`, body),

  disputes: (params) => request(`/disputes${query(params)}`),
  updateDispute: (id, body) => patch(`/disputes/${id}`, body),

  paymentPlans: (params) => request(`/payment-plans${query(params)}`),
  payInstallment: (id) => post(`/installments/${id}/pay`),
}
