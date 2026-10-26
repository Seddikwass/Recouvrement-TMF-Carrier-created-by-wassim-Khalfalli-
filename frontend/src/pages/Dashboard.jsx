import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Card, ErrorNote, Kpi, Loading } from '../components/ui'
import { fmtDate, fmtMoney, titleCase } from '../format'

const barClass = (index) => (index >= 4 ? 'bad' : index >= 2 ? 'warn' : '')

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api
      .dashboard()
      .then((result) => active && setData(result))
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [])

  if (error) return <ErrorNote message={error} />
  if (!data) return <Loading />

  const k = data.kpis
  const currency = data.currency

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Collections overview</h1>
          <p>
            Accounts receivable position as of {fmtDate(data.as_of)} · reporting
            currency {currency}
          </p>
        </div>
        <div className="actions-row">
          <Link className="btn primary" to="/collections">
            Open collection queue
          </Link>
          <Link className="btn" to="/invoices">
            Browse invoices
          </Link>
        </div>
      </header>

      <div className="cards cols-4">
        <Kpi
          label="Outstanding"
          value={fmtMoney(k.outstanding, currency)}
          hint={`${k.active_invoices} open invoices`}
        />
        <Kpi
          label="Overdue"
          value={fmtMoney(k.overdue, currency)}
          hint={`${k.overdue_count} invoices · ${k.overdue_customers} customers`}
          tone="bad"
        />
        <Kpi
          label="Collected"
          value={fmtMoney(k.collected, currency)}
          hint={`${k.collection_rate}% of ${fmtMoney(k.total_billed, currency)} billed`}
          tone="good"
        />
        <Kpi label="DSO" value={`${k.dso} days`} hint="Trailing 90-day billed base" />
      </div>

      <div className="detail-grid" style={{ marginTop: 16 }}>
        <Card
          title="Aging of receivables"
          subtitle="Open balance by days past due"
        >
          <div className="bars">
            {data.aging.map((bucket, index) => (
              <div className="bar-row" key={bucket.label}>
                <span className="muted">{bucket.label}</span>
                <span className="bar-track">
                  <span
                    className={`bar-fill ${barClass(index)}`.trim()}
                    style={{ width: `${Math.min(100, bucket.share)}%` }}
                  />
                </span>
                <span className="amount">{fmtMoney(bucket.amount, currency)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Workflow status" subtitle="Open disputes and recovery plans">
          <div className="facts">
            <div>
              <div className="k">Open disputes</div>
              <div className="v">{k.open_disputes}</div>
            </div>
            <div>
              <div className="k">Amount under dispute</div>
              <div className="v">{fmtMoney(k.dispute_amount, currency)}</div>
            </div>
            <div>
              <div className="k">Active payment plans</div>
              <div className="v">{k.active_plans}</div>
            </div>
            <div>
              <div className="k">Balance on plans</div>
              <div className="v">{fmtMoney(k.plan_remaining, currency)}</div>
            </div>
            <div>
              <div className="k">Collection rate</div>
              <div className="v">{k.collection_rate}%</div>
            </div>
            <div>
              <div className="k">Billed to date</div>
              <div className="v">{fmtMoney(k.total_billed, currency)}</div>
            </div>
          </div>
          <div className="actions-row" style={{ marginTop: 16 }}>
            <Link className="btn sm" to="/disputes">
              Review disputes
            </Link>
            <Link className="btn sm" to="/plans">
              Review payment plans
            </Link>
          </div>
        </Card>
      </div>

      <div className="detail-grid" style={{ marginTop: 16 }}>
        <Card title="Top exposure by customer" subtitle="Outstanding vs overdue">
          {data.top_customers.length === 0 ? (
            <div className="empty">No open receivables.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="num">Outstanding</th>
                    <th className="num">Overdue</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.top_customers.map((row) => (
                    <tr key={row.customer_id} className="clickable">
                      <td className="strong">
                        <Link to={`/customers/${row.customer_id}`}>
                          {row.customer_name}
                        </Link>
                      </td>
                      <td className="num">{fmtMoney(row.outstanding, currency)}</td>
                      <td className="num">
                        {row.overdue > 0 ? (
                          <span style={{ color: '#b42318' }}>
                            {fmtMoney(row.overdue, currency)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num small muted">
                        {Math.round((row.outstanding / (k.outstanding || 1)) * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Latest collection activity">
          {data.recent_actions.length === 0 ? (
            <div className="empty">No follow-up logged yet.</div>
          ) : (
            <ul className="timeline">
              {data.recent_actions.map((action) => (
                <li key={action.id}>
                  <div className="when">{fmtDate(action.performed_on)}</div>
                  <div className="what">
                    {titleCase(action.action_type)} ·{' '}
                    <Link to={`/invoices/${action.invoice_id}`}>
                      {action.invoice_number}
                    </Link>
                  </div>
                  <div className="small muted">{action.customer_name}</div>
                  {action.note && <div className="small">{action.note}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
