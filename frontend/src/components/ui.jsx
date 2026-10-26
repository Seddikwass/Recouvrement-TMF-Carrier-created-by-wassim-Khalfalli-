import { titleCase } from '../format'

export function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {actions && <div className="actions-row">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Kpi({ label, value, hint, tone = '' }) {
  return (
    <div className={`card kpi ${tone}`.trim()}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  )
}

export function StatusBadge({ status }) {
  if (!status) return null
  return <span className={`badge ${status}`}>{titleCase(status)}</span>
}

export function Loading({ label = 'Loading…' }) {
  return <div className="loading">{label}</div>
}

export function ErrorNote({ message }) {
  return <div className="notice error">{message}</div>
}

export function Empty({ children = 'Nothing here yet.' }) {
  return <div className="empty">{children}</div>
}

export function Notice({ kind = 'success', children }) {
  if (!children) return null
  return <div className={`notice ${kind}`}>{children}</div>
}
