import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Card, Empty, ErrorNote, Loading, Notice, StatusBadge } from '../components/ui'
import { fmtDate, fmtMoney, titleCase } from '../format'

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
]

function DisputeCard({ dispute, onUpdate }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const isOpen = dispute.status === 'open' || dispute.status === 'investigating'

  const update = async (status) => {
    setBusy(true)
    try {
      await onUpdate(dispute.id, status, note)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title={`${dispute.reference} · ${dispute.invoice_number}`}
      subtitle={`${dispute.customer_name} · ${titleCase(dispute.reason)}`}
      actions={<StatusBadge status={dispute.status} />}
    >
      <p className="small" style={{ marginTop: 0 }}>
        {dispute.description}
      </p>
      <div className="facts">
        <div>
          <div className="k">Invoice</div>
          <div className="v">
            <Link to={`/invoices/${dispute.invoice_id}`}>
              {fmtMoney(dispute.amount, dispute.currency)} outstanding
            </Link>
          </div>
        </div>
        <div>
          <div className="k">Opened</div>
          <div className="v">{fmtDate(dispute.opened_on)}</div>
        </div>
        {dispute.resolved_on && (
          <div>
            <div className="k">Closed</div>
            <div className="v">{fmtDate(dispute.resolved_on)}</div>
          </div>
        )}
      </div>
      {dispute.resolution_note && (
        <p className="small muted">{dispute.resolution_note}</p>
      )}
      {isOpen && (
        <div className="form inline-form">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Resolution note (optional)"
          />
          <div className="actions-row">
            <button
              className="btn sm primary"
              disabled={busy}
              onClick={() => update('resolved')}
            >
              Mark resolved
            </button>
            <button
              className="btn sm"
              disabled={busy}
              onClick={() => update('investigating')}
            >
              Investigating
            </button>
            <button
              className="btn sm danger"
              disabled={busy}
              onClick={() => update('rejected')}
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function Disputes() {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = () =>
    api
      .disputes({ status: filter || undefined })
      .then(setRows)
      .catch((err) => setError(err.message))

  useEffect(() => {
    setRows(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const updateDispute = async (id, status, note) => {
    setError('')
    try {
      await api.updateDispute(id, { status, resolution_note: note || null })
      setNotice(`Dispute marked ${status}.`)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Disputes</h1>
          <p>Invoices on hold until the customer contest is settled.</p>
        </div>
      </header>

      {notice && <Notice>{notice}</Notice>}
      {error && <ErrorNote message={error} />}

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
      </div>

      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Card>
          <Empty>No dispute in this view.</Empty>
        </Card>
      ) : (
        <div className="stack">
          {rows.map((dispute) => (
            <DisputeCard
              key={dispute.id}
              dispute={dispute}
              onUpdate={updateDispute}
            />
          ))}
        </div>
      )}
    </>
  )
}
