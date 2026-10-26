import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Card, Empty, ErrorNote, Kpi, Loading, Notice, StatusBadge } from '../components/ui'
import { fmtDate, fmtMoney } from '../format'

export default function ContractDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    api
      .contract(id)
      .then(setData)
      .catch((err) => setError(err.message))

  useEffect(() => {
    setData(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const changeStatus = async (status) => {
    setBusy(true)
    setError('')
    try {
      const updated = await api.updateContractStatus(id, status)
      setData(updated)
      setNotice(`Contract is now ${status}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (error && !data) return <ErrorNote message={error} />
  if (!data) return <Loading />

  return (
    <>
      <div className="crumbs">
        <Link to="/contracts">Contracts</Link> / {data.reference}
      </div>
      <header className="page-head">
        <div>
          <h1>
            {data.reference} <StatusBadge status={data.status} />
          </h1>
          <p>
            {data.title} ·{' '}
            <Link to={`/customers/${data.customer_id}`}>{data.customer_name}</Link>
          </p>
        </div>
        <div className="actions-row">
          <button
            className="btn"
            disabled={busy || data.status === 'active'}
            onClick={() => changeStatus('active')}
          >
            Activate
          </button>
          <button
            className="btn"
            disabled={busy || data.status === 'suspended'}
            onClick={() => changeStatus('suspended')}
          >
            Suspend
          </button>
          <button
            className="btn danger"
            disabled={busy || data.status === 'terminated'}
            onClick={() => changeStatus('terminated')}
          >
            Terminate
          </button>
        </div>
      </header>

      {notice && <Notice>{notice}</Notice>}
      {error && <ErrorNote message={error} />}

      <div className="cards cols-3">
        <Kpi label="Billed" value={fmtMoney(data.billed)} hint={`${data.invoice_count} invoices`} />
        <Kpi label="Outstanding" value={fmtMoney(data.outstanding)} />
        <Kpi
          label="Payment terms"
          value={`${data.payment_terms_days} days`}
          hint={`${data.billing_cycle} billing`}
        />
      </div>

      <div className="detail-grid" style={{ marginTop: 16 }}>
        <Card title="Invoices on this contract">
          {data.invoices.length === 0 ? (
            <Empty>No invoice issued against this contract.</Empty>
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

        <Card title="Contract terms">
          <div className="facts">
            <div>
              <div className="k">Start date</div>
              <div className="v">{fmtDate(data.start_date)}</div>
            </div>
            <div>
              <div className="k">End date</div>
              <div className="v">{data.end_date ? fmtDate(data.end_date) : 'Open-ended'}</div>
            </div>
            <div>
              <div className="k">Billing cycle</div>
              <div className="v">{data.billing_cycle}</div>
            </div>
            <div>
              <div className="k">Currency</div>
              <div className="v">{data.currency}</div>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
