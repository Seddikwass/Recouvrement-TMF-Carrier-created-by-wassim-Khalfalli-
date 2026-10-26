# Recouvrement TMF Carrier

Collections workspace for carrier interconnect receivables: contracts, invoices,
payments, disputes, payment plans and the dunning trail behind every overdue
invoice.

## Stack

- **API** — FastAPI + SQLAlchemy 2 + PostgreSQL (`backend/`)
- **Web** — React 18 + Vite (`frontend/`)

## Getting started

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

Then open <http://localhost:3000>. The database is created and seeded with a demo
carrier portfolio on first start, so the dashboard, collection queue and invoice
workflow are usable immediately.

API documentation is available through the web proxy at
<http://localhost:3000/api/docs>.

## What the app does

| Area | What you can do |
| --- | --- |
| Overview | Receivables, overdue, collection rate, DSO, aging buckets and top exposure |
| Invoices | Filter/search the ledger, create invoices, open the invoice workspace |
| Invoice | Record payments, open and settle disputes, create payment plans, log follow-ups, write off |
| Collection queue | Overdue invoices ranked by days late, with a one-click reminder log |
| Customers | Credit limits, exposure, contracts and the full invoice statement |
| Contracts | Billing agreements, their invoices and lifecycle status |
| Disputes | Register of contested invoices with resolution notes |
| Payment plans | Installment schedules with per-installment settlement |

Invoice statuses are derived from payments, open disputes and the due date, so the
ledger always reflects what has actually been collected.

## Resetting the demo data

```bash
docker compose -f docker-compose.base44.yml down -v
docker compose -f docker-compose.base44.yml up -d --build
```

See [AGENTS.md](AGENTS.md) for the internal wiring and sandbox-specific notes.
