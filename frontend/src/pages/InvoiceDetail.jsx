import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import {
  ActionForm,
  DisputeForm,
  PaymentForm,
  PlanForm,
  WriteOffForm,
} from '../components/InvoiceActionForms'
import { Card, Empty, ErrorNote, Loading, Notice, StatusBadge } from '../components/ui'
import { fmtDate, fmtMoney, titleCase } from '../format'

function DisputeItem({ dispute, busy, onUpdate }) {
  const [note, setNote] = useState('')
  const isOpen = dispute.status === 'open' || dispute.status === 'investigating'

  return (
    <div className="card" style={{ boxShadow: 'none', padding: 14 }}>
      <div className="actions-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>{dispute.reference}</strong>{' '}
          <span className="small muted">{titleCase(dispute.reason)}</span>
        </div>
        <StatusBadge status={dispute.status} />
      </div>
      <p className="small" style={{ margin: '8px 0 0' }}>
        {dispute.description}
      </p>
      <p className="small muted" style={{ margin: '4px 0 0' }}>
        Opened {fmtDate(dispute.opened_on)}
        {dispute.resolved_on ? ` · Closed ${fmtDate(dispute.resolved_on)}` : ''}
      </p>
      {dispute.resolution_note && (
        <p className="small" style={{ margin: '6px 0 0' }}>
          {dispute.resolution_note}
        </p>
      )}
      {isOpen && (
        <div className="form" style={{ marginTop: 10 }}>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Resolution note (optional)"
          />
          <div className="actions-row">
            <button
              className="btn sm primary"
              disabled={busy}
              onClick={() => onUpdate(dispute.id, 'resolved', note)}
            >
              Mark resolved
            </button>
            <button
              className="btn sm danger"
              disabled={busy}
              onClick={() => onUpdate(dispute.id, 'rejected', note)}
            >
              Reject dispute
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InvoiceDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [panel, setPanel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [busyDispute, setBusyDispute] = useState(null)
  const [busyInstallment, setBusyInstallment] = useState(null)

  const load = () =>
    api
      .invoice(id)
      .then((result) => {
        setData(result)
        return result
      })
      .catch((err) => setError(err.message))

  useEffect(() => {
    setData(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const run = async (action, message) => {
    setBusy(true)
    setFormError('')
    try {
      const updated = await action()
      setData(updated)
      setNotice(message)
      setPanel(null)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const openPanel = (name) => {
    setPanel((current) => (current === name ? null : name))
    setFormError('')
  }

  const updateDispute = async (disputeId, status, note) => {
    setBusyDispute(disputeId)
    setNotice('')
    try {
      await api.updateDispute(disputeId, {
        status,
        resolution_note: note || null,
      })
      await load()
      setNotice(`Dispute ${status}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyDispute(null)
    }
  }

  const payInstallment = async (row) => {
    setBusyInstallment(row.id)
    setNotice('')
    try {
      await api.payInstallment(row.id)
      await load()
      setNotice(`Installment ${row.number} settled.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyInstallment(null)
    }
  }

  if (error && !data) return <ErrorNote message={error} />
  if (!data) return <Loading />

  const activePlan = data.plans.find((plan) => plan.status === 'active')
  const hasOpenDispute = data.open_disputes > 0
  const settled = data.balance <= 0.005
  const writtenOff = data.status === 'written_off'

  return (
    <>
      <div className="crumbs">
        <Link to="/invoices">Invoices</Link> / {data.number}
      </div>
      <header className="page-head">
        <div>
          <h1>
            {data.number} <StatusBadge status={data.status} />
          </h1>
          <p>
            <Link to={`/customers/${data.customer_id}`}>{data.customer_name}</Link>
            {data.contract_reference && (
              <>
                {' · '}
                <Link to={`/contracts/${data.contract_id}`}>
                  {data.contract_reference}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="actions-row">
          <Link className="btn" to="/collections">
            Collection queue
          </Link>
        </div>
      </header>

      {notice && <Notice>{notice}</Notice>}
      {error && <ErrorNote message={error} />}

      <div className="detail-grid" style={{ marginTop: notice || error ? 14 : 0 }}>
        <div className="stack">
          <Card>
            <div className="amount-hero">
              <div>
                <div className="label">Invoice total</div>
                <div className="value">{fmtMoney(data.total, data.currency)}</div>
              </div>
              <div>
                <div className="label">Paid</div>
                <div className="value">{fmtMoney(data.paid_amount, data.currency)}</div>
              </div>
              <div>
                <div className="label">Balance</div>
                <div className={`value ${data.balance > 0 ? 'bad' : ''}`.trim()}>
                  {fmtMoney(data.balance, data.currency)}
                </div>
              </div>
              <div>
                <div className="label">Days past due</div>
                <div className={`value ${data.days_overdue > 0 ? 'bad' : ''}`.trim()}>
                  {data.days_overdue}
                </div>
              </div>
            </div>
            <div className="facts" style={{ marginTop: 18 }}>
              <div>
                <div className="k">Issue date</div>
                <div className="v">{fmtDate(data.issue_date)}</div>
              </div>
              <div>
                <div className="k">Due date</div>
                <div className="v">{fmtDate(data.due_date)}</div>
              </div>
              <div>
                <div className="k">Amount excl. tax</div>
                <div className="v">{fmtMoney(data.amount, data.currency)}</div>
              </div>
              <div>
                <div className="k">VAT</div>
                <div className="v">{data.tax_rate}%</div>
              </div>
            </div>
            {data.notes && (
              <p className="small muted" style={{ marginTop: 12 }}>
                {data.notes}
              </p>
            )}
            {writtenOff && data.write_off_reason && (
              <div className="notice error" style={{ marginTop: 12 }}>
                Written off — {data.write_off_reason}
              </div>
            )}
          </Card>

          <Card title="Payments" subtitle={`${data.payments.length} recorded`}>
            {data.payments.length === 0 ? (
              <Empty>No payment received yet.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{fmtDate(payment.paid_on)}</td>
                        <td>{titleCase(payment.method)}</td>
                        <td className="small muted">{payment.reference || '—'}</td>
                        <td className="num strong">
                          {fmtMoney(payment.amount, data.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="Payment plans"
            subtitle={activePlan ? 'Recovery schedule in force' : 'No active plan'}
          >
            {data.plans.length === 0 ? (
              <Empty>No payment plan agreed with this customer.</Empty>
            ) : (
              <div className="stack">
                {data.plans.map((plan) => (
                  <div key={plan.id}>
                    <div
                      className="actions-row"
                      style={{ justifyContent: 'space-between' }}
                    >
                      <div>
                        <strong>{plan.reference}</strong>{' '}
                        <span className="small muted">
                          {plan.installments} × {fmtMoney(plan.installment_amount, data.currency)} ·{' '}
                          {titleCase(plan.frequency)}
                        </span>
                      </div>
                      <StatusBadge status={plan.status} />
                    </div>
                    {plan.note && (
                      <p className="small muted" style={{ margin: '6px 0 0' }}>
                        {plan.note}
                      </p>
                    )}
                    <div className="table-wrap plan-schedule">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Due date</th>
                            <th className="num">Amount</th>
                            <th className="num">Paid</th>
                            <th>Status</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {plan.schedule.map((row) => (
                            <tr key={row.id}>
                              <td>{row.number}</td>
                              <td>{fmtDate(row.due_date)}</td>
                              <td className="num">
                                {fmtMoney(row.amount, data.currency)}
                              </td>
                              <td className="num">
                                {fmtMoney(row.paid_amount, data.currency)}
                              </td>
                              <td>
                                <StatusBadge status={row.status} />
                              </td>
                              <td className="num">
                                {row.remaining > 0 ? (
                                  <button
                                    className="btn sm"
                                    disabled={busyInstallment === row.id}
                                    onClick={() => payInstallment(row)}
                                  >
                                    {busyInstallment === row.id
                                      ? 'Saving…'
                                      : 'Record payment'}
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Disputes" subtitle={`${data.disputes.length} on record`}>
            {data.disputes.length === 0 ? (
              <Empty>No dispute raised on this invoice.</Empty>
            ) : (
              <div className="stack">
                {data.disputes.map((dispute) => (
                  <DisputeItem
                    key={dispute.id}
                    dispute={dispute}
                    busy={busyDispute === dispute.id}
                    onUpdate={updateDispute}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card title="Collection trail">
            {data.timeline.length === 0 ? (
              <Empty>Nothing recorded yet.</Empty>
            ) : (
              <ul className="timeline">
                {data.timeline.map((event, index) => (
                  <li key={`${event.kind}-${index}`}>
                    <div className="when">{fmtDate(event.date)}</div>
                    <div className="what">{event.label}</div>
                    {event.detail && (
                      <div className="small muted">{event.detail}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Actions" subtitle="Move this invoice through the workflow">
            <div className="actions-row">
              <button
                className="btn primary sm"
                onClick={() => openPanel('payment')}
                disabled={settled || writtenOff}
              >
                Record payment
              </button>
              <button
                className="btn sm"
                onClick={() => openPanel('dispute')}
                disabled={hasOpenDispute || writtenOff}
              >
                Open dispute
              </button>
              <button
                className="btn sm"
                onClick={() => openPanel('plan')}
                disabled={Boolean(activePlan) || settled || writtenOff}
              >
                Payment plan
              </button>
              <button className="btn sm" onClick={() => openPanel('action')}>
                Log follow-up
              </button>
              <button
                className="btn danger sm"
                onClick={() => openPanel('writeoff')}
                disabled={settled || writtenOff}
              >
                Write off
              </button>
            </div>

            {panel === 'payment' && (
              <PaymentForm
                max={data.balance}
                busy={busy}
                error={formError}
                onCancel={() => setPanel(null)}
                onSubmit={(payload) =>
                  run(
                    () => api.recordPayment(data.id, payload),
                    'Payment recorded.',
                  )
                }
              />
            )}
            {panel === 'dispute' && (
              <DisputeForm
                busy={busy}
                error={formError}
                onCancel={() => setPanel(null)}
                onSubmit={(payload) =>
                  run(
                    () => api.openDispute(data.id, payload),
                    'Dispute opened — the invoice is now on hold.',
                  )
                }
              />
            )}
            {panel === 'plan' && (
              <PlanForm
                busy={busy}
                error={formError}
                onCancel={() => setPanel(null)}
                onSubmit={(payload) =>
                  run(
                    () => api.createPaymentPlan(data.id, payload),
                    'Payment plan created.',
                  )
                }
              />
            )}
            {panel === 'action' && (
              <ActionForm
                busy={busy}
                error={formError}
                onCancel={() => setPanel(null)}
                onSubmit={(payload) =>
                  run(
                    () => api.logAction(data.id, payload),
                    'Follow-up logged.',
                  )
                }
              />
            )}
            {panel === 'writeoff' && (
              <WriteOffForm
                busy={busy}
                error={formError}
                onCancel={() => setPanel(null)}
                onSubmit={(payload) =>
                  run(
                    () => api.writeOff(data.id, payload),
                    'Invoice written off.',
                  )
                }
              />
            )}
          </Card>

          <Card title="Next step" subtitle="Suggested by the current state">
            <p className="small" style={{ margin: 0 }}>
              {writtenOff
                ? 'Balance removed from receivables — no further dunning.'
                : settled
                  ? 'Fully settled. Nothing left to collect.'
                  : hasOpenDispute
                    ? 'Invoice is on hold while the dispute is investigated.'
                    : activePlan
                      ? 'Follow the installment schedule and chase missed dates.'
                      : data.days_overdue > 0
                        ? `Send a formal reminder — ${data.days_overdue} days past due.`
                        : 'Invoice is not yet due; monitor the due date.'}
            </p>
            {!settled && !writtenOff && (
              <p className="small muted" style={{ marginTop: 8 }}>
                Outstanding {fmtMoney(data.balance, data.currency)} due{' '}
                {fmtDate(data.due_date)}.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
