import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Card, Empty, ErrorNote, Kpi, Loading, Notice } from '../components/ui'
import { fmtDate, fmtMoney } from '../format'

export default function Collections() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = () =>
    api
      .collections()
      .then(setData)
      .catch((err) => setError(err.message))

  useEffect(() => {
    load()
  }, [])

  const logReminder = async (item) => {
    setBusyId(item.id)
    setError('')
    try {
      await api.logAction(item.id, {
        action_type: 'reminder',
        note: 'Payment reminder sent from the collection queue.',
        next_action_on: new Date(Date.now() + 7 * 86400000)
          .toISOString()
          .slice(0, 10),
      })
      setNotice(`Reminder logged on ${item.number}.`)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (error && !data) return <ErrorNote message={error} />
  if (!data) return <Loading />

  const summary = data.summary

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Collection queue</h1>
          <p>Overdue invoices ordered by days past due.</p>
        </div>
        <Link className="btn" to="/invoices">
          All invoices
        </Link>
      </header>

      <div className="cards cols-3">
        <Kpi
          label="Overdue invoices"
          value={summary.count}
          hint={`${summary.without_followup} without any follow-up`}
          tone="bad"
        />
        <Kpi label="Overdue balance" value={fmtMoney(summary.amount)} />
        <Kpi
          label="Beyond 60 days"
          value={fmtMoney(summary.over_60)}
          hint="Escalation candidates"
        />
      </div>

      <div style={{ marginTop: 16 }}>
        {notice && <Notice>{notice}</Notice>}
        {error && <ErrorNote message={error} />}
        <Card>
          {data.items.length === 0 ? (
            <Empty>Nothing overdue — the ledger is clean.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Due date</th>
                    <th className="num">Days late</th>
                    <th className="num">Balance</th>
                    <th>Last follow-up</th>
                    <th>Next action</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td className="strong">
                        <Link to={`/invoices/${item.id}`}>{item.number}</Link>
                      </td>
                      <td>
                        <Link to={`/customers/${item.customer_id}`}>
                          {item.customer_name}
                        </Link>
                      </td>
                      <td className="nowrap">{fmtDate(item.due_date)}</td>
                      <td className="num">{item.days_overdue}</td>
                      <td className="num strong">
                        {fmtMoney(item.balance, item.currency)}
                      </td>
                      <td>
                        {item.last_action ? (
                          <>
                            {item.last_action.action_type.replace(/_/g, ' ')}
                            <span className="sub">
                              {fmtDate(item.last_action.performed_on)}
                            </span>
                          </>
                        ) : (
                          <span className="muted">None</span>
                        )}
                      </td>
                      <td className="nowrap">
                        {item.next_action_on ? (
                          fmtDate(item.next_action_on)
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="num">
                        <button
                          className="btn sm"
                          onClick={() => logReminder(item)}
                          disabled={busyId === item.id}
                        >
                          {busyId === item.id ? 'Saving…' : 'Log reminder'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
