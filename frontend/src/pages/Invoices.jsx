import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Card, Empty, ErrorNote, Loading, Notice, StatusBadge } from '../components/ui'
import { fmtDate, fmtMoney, todayISO } from '../format'

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'issued', label: 'Issued' },
  { value: 'partially_paid', label: 'Part paid' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'paid', label: 'Paid' },
  { value: 'written_off', label: 'Written off' },
]

function NewInvoiceForm({ onCreated, onClose }) {
  const [customers, setCustomers] = useState([])
  const [contracts, setContracts] = useState([])
  const [form, setForm] = useState({
    customer_id: '',
    contract_id: '',
    issue_date: todayISO(),
    amount: '',
    tax_rate: '19',
    notes: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.customers().then(setCustomers).catch((err) => setError(err.message))
    api.contracts().then(setContracts).catch((err) => setError(err.message))
  }, [])

  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }))

  const customerContracts = contracts.filter(
    (contract) => String(contract.customer_id) === String(form.customer_id),
  )

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const created = await api.createInvoice({
        customer_id: Number(form.customer_id),
        contract_id: form.contract_id ? Number(form.contract_id) : null,
        issue_date: form.issue_date,
        amount: Number(form.amount),
        tax_rate: Number(form.tax_rate || 0),
        notes: form.notes || null,
      })
      onCreated(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="New invoice" subtitle="Billed against a carrier contract">
      <form className="form" onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label>Customer</label>
            <select
              value={form.customer_id}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  customer_id: event.target.value,
                  contract_id: '',
                }))
              }
              required
            >
              <option value="">Select a customer…</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.code})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Contract</label>
            <select
              value={form.contract_id}
              onChange={update('contract_id')}
              disabled={!form.customer_id}
            >
              <option value="">No contract</option>
              {customerContracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.reference} · {contract.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Issue date</label>
            <input
              type="date"
              value={form.issue_date}
              onChange={update('issue_date')}
              required
            />
          </div>
          <div className="field">
            <label>Amount excl. tax (TND)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={form.amount}
              onChange={update('amount')}
              required
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>VAT rate (%)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.tax_rate}
              onChange={update('tax_rate')}
            />
          </div>
          <div className="field">
            <label>Notes</label>
            <input value={form.notes} onChange={update('notes')} placeholder="Optional" />
          </div>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="actions-row">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create invoice'}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  )
}

export default function Invoices() {
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = () => {
    const params =
      filter === 'overdue' ? { overdue: true } : { status: filter || undefined }
    params.search = search || undefined
    api
      .invoices(params)
      .then(setRows)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    setRows(null)
    const timer = setTimeout(load, search ? 220 : 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search])

  const totalOutstanding = (rows || []).reduce((sum, row) => sum + row.balance, 0)

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Invoices</h1>
          <p>
            {rows ? `${rows.length} invoices` : 'Loading…'} ·{' '}
            {fmtMoney(totalOutstanding)} outstanding in this view
          </p>
        </div>
        <div className="actions-row">
          <button
            className="btn primary"
            onClick={() => setShowForm((value) => !value)}
          >
            {showForm ? 'Close form' : 'New invoice'}
          </button>
        </div>
      </header>

      {notice && <Notice>{notice}</Notice>}
      {error && <ErrorNote message={error} />}

      {showForm && (
        <div style={{ marginBottom: 16 }}>
          <NewInvoiceForm
            onClose={() => setShowForm(false)}
            onCreated={(created) => {
              setShowForm(false)
              setNotice(`Invoice ${created.number} created.`)
              load()
            }}
          />
        </div>
      )}

      <div className="filter-bar">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            className={`chip ${filter === option.value ? 'active' : ''}`.trim()}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
        <span className="spacer" />
        <input
          className="search"
          placeholder="Search number or customer…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <Card>
        {!rows ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>No invoices match this view.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Contract</th>
                  <th>Due date</th>
                  <th className="num">Total</th>
                  <th className="num">Balance</th>
                  <th className="num">Days late</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="clickable"
                    onClick={() => navigate(`/invoices/${row.id}`)}
                  >
                    <td className="strong">{row.number}</td>
                    <td>
                      <Link
                        to={`/customers/${row.customer_id}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {row.customer_name}
                      </Link>
                      <span className="sub">{row.customer_code}</span>
                    </td>
                    <td>
                      {row.contract_reference || '—'}
                      {row.contract_title && (
                        <span className="sub">{row.contract_title}</span>
                      )}
                    </td>
                    <td className="nowrap">{fmtDate(row.due_date)}</td>
                    <td className="num">{fmtMoney(row.total, row.currency)}</td>
                    <td className="num strong">
                      {fmtMoney(row.balance, row.currency)}
                    </td>
                    <td className="num">
                      {row.days_overdue > 0 ? row.days_overdue : '—'}
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
