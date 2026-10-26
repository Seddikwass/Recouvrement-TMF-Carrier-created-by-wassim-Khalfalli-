import { useState } from 'react'
import { daysFromNow, todayISO } from '../format'

function Submit({ busy, label, className = 'btn primary', disabled }) {
  return (
    <button className={className} type="submit" disabled={busy || disabled}>
      {busy ? 'Saving…' : label}
    </button>
  )
}

export function PaymentForm({ max, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    amount: max ? String(max) : '',
    method: 'bank_transfer',
    reference: '',
    paid_on: todayISO(),
    note: '',
  })
  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }))

  return (
    <form
      className="form inline-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({
          amount: Number(form.amount),
          method: form.method,
          reference: form.reference || null,
          paid_on: form.paid_on || null,
          note: form.note || null,
        })
      }}
    >
      <div className="field-row">
        <div className="field">
          <label>Amount received</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={max}
            value={form.amount}
            onChange={update('amount')}
            required
          />
        </div>
        <div className="field">
          <label>Payment date</label>
          <input type="date" value={form.paid_on} onChange={update('paid_on')} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Method</label>
          <select value={form.method} onChange={update('method')}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="offset">Offset / netting</option>
          </select>
        </div>
        <div className="field">
          <label>Reference</label>
          <input
            value={form.reference}
            onChange={update('reference')}
            placeholder="Transfer id"
          />
        </div>
      </div>
      <div className="field">
        <label>Note</label>
        <input value={form.note} onChange={update('note')} placeholder="Optional" />
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="actions-row">
        <Submit busy={busy} label="Record payment" />
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export function DisputeForm({ busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({ reason: 'amount', description: '' })

  return (
    <form
      className="form inline-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({ reason: form.reason, description: form.description })
      }}
    >
      <div className="field">
        <label>Reason</label>
        <select
          value={form.reason}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, reason: event.target.value }))
          }
        >
          <option value="amount">Rate / amount contested</option>
          <option value="service_quality">Service quality</option>
          <option value="duplicate">Duplicate billing</option>
          <option value="contract_terms">Contract terms</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="field">
        <label>Description</label>
        <textarea
          value={form.description}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, description: event.target.value }))
          }
          placeholder="What is the customer contesting?"
          required
        />
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="actions-row">
        <Submit busy={busy} label="Open dispute" />
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export function PlanForm({ busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    installments: '3',
    frequency: 'monthly',
    start_date: todayISO(),
    note: '',
  })
  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }))

  return (
    <form
      className="form inline-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({
          installments: Number(form.installments),
          frequency: form.frequency,
          start_date: form.start_date || null,
          note: form.note || null,
        })
      }}
    >
      <div className="field-row">
        <div className="field">
          <label>Installments</label>
          <input
            type="number"
            min="2"
            max="12"
            value={form.installments}
            onChange={update('installments')}
            required
          />
        </div>
        <div className="field">
          <label>Frequency</label>
          <select value={form.frequency} onChange={update('frequency')}>
            <option value="monthly">Monthly</option>
            <option value="biweekly">Every two weeks</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>First due date</label>
        <input type="date" value={form.start_date} onChange={update('start_date')} />
      </div>
      <div className="field">
        <label>Agreement note</label>
        <input value={form.note} onChange={update('note')} placeholder="Optional" />
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="actions-row">
        <Submit busy={busy} label="Create plan" />
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export function ActionForm({ busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    action_type: 'reminder',
    note: '',
    performed_on: todayISO(),
    next_action_on: daysFromNow(7),
  })
  const update = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }))

  return (
    <form
      className="form inline-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({
          action_type: form.action_type,
          note: form.note || null,
          performed_on: form.performed_on || null,
          next_action_on: form.next_action_on || null,
        })
      }}
    >
      <div className="field-row">
        <div className="field">
          <label>Follow-up type</label>
          <select value={form.action_type} onChange={update('action_type')}>
            <option value="reminder">Reminder</option>
            <option value="email">Email</option>
            <option value="phone_call">Phone call</option>
            <option value="letter">Formal letter</option>
            <option value="escalation">Escalation</option>
            <option value="note">Internal note</option>
          </select>
        </div>
        <div className="field">
          <label>Performed on</label>
          <input
            type="date"
            value={form.performed_on}
            onChange={update('performed_on')}
          />
        </div>
      </div>
      <div className="field">
        <label>Note</label>
        <textarea
          value={form.note}
          onChange={update('note')}
          placeholder="What was said or sent?"
        />
      </div>
      <div className="field">
        <label>Next action on</label>
        <input
          type="date"
          value={form.next_action_on}
          onChange={update('next_action_on')}
        />
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="actions-row">
        <Submit busy={busy} label="Log follow-up" />
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export function WriteOffForm({ busy, error, onSubmit, onCancel }) {
  const [reason, setReason] = useState('')

  return (
    <form
      className="form inline-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit({ reason: reason || null })
      }}
    >
      <div className="notice error">
        Writing off removes this balance from receivables. This cannot be undone
        from the app.
      </div>
      <div className="field">
        <label>Reason</label>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Committee decision, insolvency, prescription…"
        />
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="actions-row">
        <Submit busy={busy} label="Confirm write-off" className="btn danger" />
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
