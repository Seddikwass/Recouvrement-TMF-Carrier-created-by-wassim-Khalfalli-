import { Link, NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/invoices', label: 'Invoices' },
  { to: '/collections', label: 'Collection queue' },
  { to: '/customers', label: 'Customers' },
  { to: '/contracts', label: 'Contracts' },
  { to: '/disputes', label: 'Disputes' },
  { to: '/plans', label: 'Payment plans' },
]

export default function Layout({ children }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">RT</span>
          <span>
            <strong>Recouvrement</strong>
            <em>TMF Carrier</em>
          </span>
        </Link>
        <nav className="nav">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="dot" />
          Collections workspace
          <p>Interconnect receivables · TND</p>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}
