from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..logic import (
    action_dict,
    balance,
    days_overdue,
    invoice_dict,
    money,
    paid_amount,
)
from ..models import CollectionAction, Dispute, Invoice, PaymentPlan

router = APIRouter(tags=["dashboard"])

CLOSED = ("draft", "written_off")


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    invoices = db.query(Invoice).all()
    active = [i for i in invoices if i.status not in CLOSED]

    billed = money(sum(i.total for i in active))
    collected = money(sum(paid_amount(i) for i in active))
    outstanding = money(sum(balance(i) for i in active))
    overdue_rows = [i for i in active if days_overdue(i) > 0]
    overdue = money(sum(balance(i) for i in overdue_rows))

    def bucket(low: int, high: int | None) -> float:
        return money(
            sum(
                balance(i)
                for i in overdue_rows
                if days_overdue(i) > low and (high is None or days_overdue(i) <= high)
            )
        )

    aging = [
        ("Not yet due", money(outstanding - overdue)),
        ("1-30 days", bucket(0, 30)),
        ("31-60 days", bucket(30, 60)),
        ("61-90 days", bucket(60, 90)),
        ("90+ days", bucket(90, None)),
    ]
    aging_total = outstanding or 1

    open_disputes = (
        db.query(Dispute)
        .filter(Dispute.status.in_(("open", "investigating")))
        .all()
    )
    active_plans = (
        db.query(PaymentPlan).filter(PaymentPlan.status == "active").all()
    )

    trailing = date.today() - timedelta(days=90)
    trailing_billed = money(sum(i.total for i in active if i.issue_date >= trailing))
    dso = round(outstanding / (trailing_billed / 90)) if trailing_billed else 0

    per_customer: dict[int, dict] = {}
    for invoice in active:
        row = per_customer.setdefault(
            invoice.customer_id,
            {
                "customer_id": invoice.customer_id,
                "customer_name": invoice.customer.name if invoice.customer else "-",
                "outstanding": 0.0,
                "overdue": 0.0,
                "currency": invoice.currency,
            },
        )
        row["outstanding"] = money(row["outstanding"] + balance(invoice))
        if days_overdue(invoice) > 0:
            row["overdue"] = money(row["overdue"] + balance(invoice))

    recent_actions = (
        db.query(CollectionAction)
        .order_by(CollectionAction.performed_on.desc(), CollectionAction.id.desc())
        .limit(6)
        .all()
    )

    return {
        "as_of": date.today().isoformat(),
        "currency": "TND",
        "kpis": {
            "total_billed": billed,
            "collected": collected,
            "outstanding": outstanding,
            "overdue": overdue,
            "overdue_count": len(overdue_rows),
            "overdue_customers": len({i.customer_id for i in overdue_rows}),
            "open_disputes": len(open_disputes),
            "dispute_amount": money(
                sum(balance(d.invoice) for d in open_disputes if d.invoice)
            ),
            "active_plans": len(active_plans),
            "plan_remaining": money(
                sum(balance(p.invoice) for p in active_plans if p.invoice)
            ),
            "dso": dso,
            "active_invoices": len(active),
            "collection_rate": round(collected / billed * 100, 1) if billed else 0,
        },
        "aging": [
            {
                "label": label,
                "amount": amount,
                "share": round(amount / aging_total * 100, 1),
            }
            for label, amount in aging
        ],
        "top_customers": sorted(
            per_customer.values(), key=lambda r: r["outstanding"], reverse=True
        )[:5],
        "recent_actions": [action_dict(a) for a in recent_actions],
    }


@router.get("/collections")
def collections_queue(db: Session = Depends(get_db)):
    rows = [i for i in db.query(Invoice).all() if days_overdue(i) > 0]
    rows.sort(key=lambda i: days_overdue(i), reverse=True)

    items = []
    for invoice in rows:
        data = invoice_dict(invoice)
        last = invoice.actions[0] if invoice.actions else None
        data["last_action"] = action_dict(last) if last else None
        data["next_action_on"] = (
            last.next_action_on.isoformat() if last and last.next_action_on else None
        )
        items.append(data)

    return {
        "items": items,
        "summary": {
            "count": len(items),
            "amount": money(sum(d["balance"] for d in items)),
            "over_60": money(
                sum(d["balance"] for d in items if d["days_overdue"] > 60)
            ),
            "without_followup": sum(1 for d in items if not d["last_action"]),
        },
    }
