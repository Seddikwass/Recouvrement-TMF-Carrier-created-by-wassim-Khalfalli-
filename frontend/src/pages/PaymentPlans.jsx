import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Card, Empty, ErrorNote, Loading, Notice, StatusBadge } from '../components/ui'
import { fmtDate, fmtMoney, titleCase } from '../format'

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'broken', label: 'Broken' },
]

export default function PaymentPlans() {
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = () =>
    api
      .paymentPlans({ status: filter || undefined })
      .then(setRows)
      .catch((err) => setError(err.message))

  useEffect(() => {
    setRows(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const pay = async (row) => {
    setBusyId(row.id)
    setError('')
    try {
      await api.payInstallment(row.id)
      setNotice(`Installment ${row.number} settled.`)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Payment plans</h1>
          <p>Recovery schedules agreed with carrier finance teams.</p>
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
          <Empty>No payment plan in this view.</Empty>
        </Card>
      ) : (
        <div className="stack">
          {rows.map((plan) => (
            <Card
              key={plan.id}
              title={`${plan.reference} · ${plan.invoice_number}`}
              subtitle={`${plan.customer_name} · ${plan.installments} × ${fmtMoney(
                plan.installment_amount,
                plan.currency,
              )} ${titleCase(plan.frequency)}`}
              actions={<StatusBadge status={plan.status} />}
            >
              <div className="facts">
                <div>
                  <div className="k">Planned amount</div>
                  <div className="v">{fmtMoney(plan.total_amount, plan.currency)}</div>
                </div>
                <div>
                  <div className="k">Paid so far</div>
                  <div className="v">{fmtMoney(plan.paid_amount, plan.currency)}</div>
                </div>
                <div>
                  <div className="k">Started</div>
                  <div className="v">{fmtDate(plan.start_date)}</div>
                </div>
                <div>
                  <div className="k">Invoice</div>
                  <div className="v">
                    <Link to={`/invoices/${plan.invoice_id}`}>
                      {plan.invoice_number}
                    </Link>
                  </div>
                </div>
              </div>
              {plan.note && <p className="small muted">{plan.note}</p>}
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
                        <td className="num">{fmtMoney(row.amount, plan.currency)}</td>
                        <td className="num">{fmtMoney(row.paid_amount, plan.currency)}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="num">
                          {row.remaining > 0 && plan.status === 'active' ? (
                            <button
                              className="btn sm"
                              disabled={busyId === row.id}
                              onClick={() => pay(row)}
                            >
                              {busyId === row.id ? 'Saving…' : 'Record payment'}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
