import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Card, Empty, ErrorNote, Loading, Notice, StatusBadge } from '../components/ui'
import { fmtMoney } from '../format'

const SEGMENTS = ['Carrier', 'Wholesale', 'Roaming', 'MVNO', 'Enterprise']

function NewCustomerForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    segment: 'Carrier',
    country: '',
    email: '',
    credit_limit: '100000',
    payment_terms_days: '30',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const created = await api.createCustomer({
        name: form.name,
        segment: form.segment,
        country: form.country || null,
        email: form.email || null,
        credit_limit: Number(form.credit_limit || 0),
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
    <Card title="New customer" subtitle="Carrier or wholesale account">
      <form className="form" onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={update('name')} required />
          </div>
          <div className="field">
            <label>Segment</label>
            <select value={form.segment} onChange={update('segment')}>
              {SEGMENTS.map((segment) => (
                <option key={segment}>{segment}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Country</label>
            <input value={form.country} onChange={update('country')} placeholder="TN" />
          </div>
          <div className="field">
            <label>Billing email</label>
            <input
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="ap@carrier.com"
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Credit limit (TND)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={form.credit_limit}
              onChange={update('credit_limit')}
            />
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
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="actions-row">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create customer'}
          </button>
          <button className="btn" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  )
}

export default function Customers() {
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = () =>
    api
      .customers()
      .then(setRows)
      .catch((err) => setError(err.message))

  useEffect(() => {
    load()
  }, [])

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Customers</h1>
          <p>Carrier accounts, credit limits and exposure.</p>
        </div>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close form' : 'New customer'}
        </button>
      </header>

      {notice && <Notice>{notice}</Notice>}
      {error && <ErrorNote message={error} />}

      {showForm && (
        <div style={{ marginBottom: 16 }}>
          <NewCustomerForm
            onCancel={() => setShowForm(false)}
            onCreated={(created) => {
              setShowForm(false)
              setNotice(`${created.name} created.`)
              load()
            }}
          />
        </div>
      )}

      <Card>
        {!rows ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>No customers yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Segment</th>
                  <th className="num">Terms</th>
                  <th className="num">Credit limit</th>
                  <th className="num">Outstanding</th>
                  <th className="num">Overdue</th>
                  <th className="num">Exposure</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="clickable"
                    onClick={() => navigate(`/customers/${row.id}`)}
                  >
                    <td className="strong">
                      {row.name}
                      <span className="sub">
                        {row.code} · {row.country || '—'}
                      </span>
                    </td>
                    <td>{row.segment}</td>
                    <td className="num">{row.payment_terms_days}d</td>
                    <td className="num">{fmtMoney(row.credit_limit)}</td>
                    <td className="num strong">{fmtMoney(row.outstanding)}</td>
                    <td className="num">
                      {row.overdue > 0 ? (
                        <span style={{ color: '#b42318' }}>
                          {fmtMoney(row.overdue)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num">
                      {row.credit_exposure === null
                        ? '—'
                        : `${row.credit_exposure}%`}
                    </td>
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
