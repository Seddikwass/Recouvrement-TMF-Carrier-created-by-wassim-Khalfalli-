import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Card, Empty, ErrorNote, Loading, Notice, StatusBadge } from '../components/ui'
import { fmtMoney, todayISO } from '../format'

function NewContractForm({ onCreated, onCancel }) {
  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({
    customer_id: '',
    title: '',
    start_date: todayISO(),
    billing_cycle: 'monthly',
    payment_terms_days: '30',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }))

  useEffect(() => {
    api.customers().then(setCustomers).catch((err) => setError(err.message))
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const created = await api.createContract({
        customer_id: Number(form.customer_id),
        title: form.title,
        start_date: form.start_date,
        billing_cycle: form.billing_cycle,
        payment_terms_days: Number(form.payment_terms_days || 30),
      })
      onCreated(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="New contract" subtitle="Interconnect or wholesale agreement">
      <form className="form" onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label>Customer</label>
            <select value={form.customer_id} onChange={update('customer_id')} required>
              <option value="">Select a customer…</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.code})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Title</label>
            <input
              value={form.title}
              onChange={update('title')}
              placeholder="International voice termination"
              required
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Start date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={update('start_date')}
              required
            />
          </div>
          <div className="field">
            <label>Billing cycle</label>
            <select value={form.billing_cycle} onChange={update('billing_cycle')}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Payment terms (days)</label>
          <input
            type="number"
            min="0"
            max="180"
            value={form.payment_terms_days}
            onChange={update('payment_terms_days')}
          />
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="actions-row">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create contract'}
          </button>
          <button className="btn" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  )
}

export default function Contracts() {
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = () =>
    api
      .contracts()
      .then(setRows)
      .catch((err) => setError(err.message))

  useEffect(() => {
    load()
  }, [])

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Contracts</h1>
          <p>Billing agreements that generate carrier invoices.</p>
        </div>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close form' : 'New contract'}
        </button>
      </header>

      {notice && <Notice>{notice}</Notice>}
      {error && <ErrorNote message={error} />}

      {showForm && (
        <div style={{ marginBottom: 16 }}>
          <NewContractForm
            onCancel={() => setShowForm(false)}
            onCreated={(created) => {
              setShowForm(false)
              setNotice(`${created.reference} created.`)
              load()
            }}
          />
        </div>
      )}

      <Card>
        {!rows ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>No contracts yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Title</th>
                  <th>Cycle</th>
                  <th className="num">Terms</th>
                  <th className="num">Invoices</th>
                  <th className="num">Billed</th>
                  <th className="num">Outstanding</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="clickable"
                    onClick={() => navigate(`/contracts/${row.id}`)}
                  >
                    <td className="strong">{row.reference}</td>
                    <td>
                      <Link
                        to={`/customers/${row.customer_id}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {row.customer_name}
                      </Link>
                    </td>
                    <td>{row.title}</td>
                    <td>{row.billing_cycle}</td>
                    <td className="num">{row.payment_terms_days}d</td>
                    <td className="num">{row.invoice_count}</td>
                    <td className="num">{fmtMoney(row.billed)}</td>
                    <td className="num strong">{fmtMoney(row.outstanding)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
