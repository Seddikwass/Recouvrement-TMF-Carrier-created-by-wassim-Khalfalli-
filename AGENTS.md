# Recouvrement TMF Carrier

Collections / accounts-receivable workspace for carrier interconnect billing:
customers → contracts → invoices → payments, disputes and payment plans, with a
dunning trail per invoice.

- `backend/` — FastAPI + SQLAlchemy + PostgreSQL (source bind-mounted, `uvicorn --reload`)
- `frontend/` — React + Vite single-page app (port 3000 on the host)

## Run it

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

- App: http://localhost:3000
- API docs (through the web proxy): http://localhost:3000/api/docs

## How it is wired

- The browser only talks to the Vite dev server on port 3000; `/api` is proxied to
  the `api` service (`VITE_API_PROXY_TARGET`), so there is a single origin and no CORS.
- Tables are created and demo data seeded on API startup (`backend/app/main.py` →
  `init_database`). The seed is skipped when the `customers` table already has rows.
- Invoice status is derived, never set by hand: `paid` when the balance is zero,
  `disputed` while a dispute is open, `partially_paid` when a payment was received,
  `overdue` past the due date, `issued` otherwise. See `backend/app/logic.py`.
  `written_off` and `draft` are terminal and excluded from receivables.
- Recording a payment on an invoice with an active payment plan settles the oldest
  open installments automatically.
- Amounts are stored with `Numeric` and exposed as floats; invoices carry a 19% VAT
  rate by default (`amount` is net, `total` = amount + VAT).

## Common tasks

```bash
# backend logs / reload
docker compose -f docker-compose.base44.yml logs -f api

# re-create the demo dataset (destroys local data)
docker compose -f docker-compose.base44.yml down -v
docker compose -f docker-compose.base44.yml up -d --build

# run python inside the API container
docker compose -f docker-compose.base44.yml exec api python -c "import app.main"
```

The sandbox host has no Python/Node installs — always run commands inside the
compose services.

## Sandbox / preview notes

`vite.config.js` reads two platform variables that only exist inside the Base44
sandbox:

- `BASE44_PREVIEW_MODE=1` — enables the sandbox-only overrides below.
- `BASE44_SANDBOX_HOST_DOMAIN` — the domain of the (rotating) sandbox host; Vite
  gets `.<domain>` appended to `server.allowedHosts` so the proxied Host header is
  accepted. Unset, `allowedHosts` stays empty and Vite behaves normally.

In preview mode HMR is pinned to `wss://<host>:443` because the page is served
through the HTTPS preview proxy. Both variables are passed through in
`docker-compose.base44.yml`; nothing is hardcoded.
