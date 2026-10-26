import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Card, Empty, ErrorNote, Kpi, Loading, StatusBadge } from '../components/ui'
import { fmtDate, fmtMoney } from '../format'

export default function CustomerDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    api
      .customer(id)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [id])

  if (error && !data) return <ErrorNote message={error} />
  if (!data) return <Loading />

  return (
    <>
      <div className="crumbs">
        <Link to="/customers">Customers</Link> / {data.code}
      </div>
      <header className="page-head">
        <div>
          <h1>
            {data.name} <StatusBadge status={data.status} />
          </h1>
          <p>
            {data.segment} · {data.country || '—'} · terms{' '}
            {data.payment_terms_days} days
          </p>
        </div>
        <div className="actions-row">
          <Link className="btn" to="/collections">
            Collection queue
          </Link>
        </div>
      </header>

      <div className="cards cols-4">
        <Kpi label="Billed" value={fmtMoney(data.billed)} hint={`${data.invoice_count} invoices`} />
        <Kpi label="Collected" value={fmtMoney(data.collected)} tone="good" />
        <Kpi label="Outstanding" value={fmtMoney(data.outstanding)} />
        <Kpi
          label="Overdue"
          value={fmtMoney(data.overdue)}
          hint={`${data.open_disputes} open disputes`}
          tone="bad"
        />
      </div>

      <div className="detail-grid" style={{ marginTop: 16 }}>
        <Card title="Contracts" subtitle={`${data.contracts.length} on record`}>
          {data.contracts.length === 0 ? (
            <Empty>No contract yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Title</th>
                    <th>Cycle</th>
                    <th className="num">Outstanding</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contracts.map((contract) => (
                    <tr key={contract.id}>
                      <td className="strong">
                        <Link to={`/contracts/${contract.id}`}>
                          {contract.reference}
                        </Link>
                      </td>
                      <td>{contract.title}</td>
                      <td>{contract.billing_cycle}</td>
                      <td className="num">{fmtMoney(contract.outstanding)}</td>
                      <td>
                        <StatusBadge status={contract.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Account details">
          <div className="facts">
            <div>
              <div className="k">Customer code</div>
              <div className="v">{data.code}</div>
            </div>
            <div>
              <div className="k">Credit limit</div>
              <div className="v">{fmtMoney(data.credit_limit)}</div>
            </div>
            <div>
              <div className="k">Credit used</div>
              <div className="v">
                {data.credit_exposure === null ? '—' : `${data.credit_exposure}%`}
              </div>
            </div>
            <div>
              <div className="k">Billing email</div>
              <div className="v">{data.email || '—'}</div>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card title="Invoices" subtitle="Most recent first">
          {data.invoices.length === 0 ? (
            <Empty>No invoice issued to this customer.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Issue date</th>
                    <th>Due date</th>
                    <th className="num">Total</th>
                    <th className="num">Balance</th>
                    <th className="num">Days late</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="strong">
                        <Link to={`/invoices/${invoice.id}`}>{invoice.number}</Link>
                      </td>
                      <td>{fmtDate(invoice.issue_date)}</td>
                      <td>{fmtDate(invoice.due_date)}</td>
                      <td className="num">{fmtMoney(invoice.total)}</td>
                      <td className="num strong">{fmtMoney(invoice.balance)}</td>
                      <td className="num">
                        {invoice.days_overdue > 0 ? invoice.days_overdue : '—'}
                      </td>
                      <td>
                        <StatusBadge status={invoice.status} />
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
