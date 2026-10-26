from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..logic import (
    balance,
    days_overdue,
    invoice_dict,
    money,
    paid_amount,
    refresh_invoice_status,
    refresh_plan_status,
)
from ..models import (
    CollectionAction,
    Contract,
    Customer,
    Dispute,
    Invoice,
    Payment,
    PaymentPlan,
    PlanInstallment,
)
from ..schemas import (
    CollectionActionCreate,
    DisputeCreate,
    InvoiceCreate,
    PaymentCreate,
    PaymentPlanCreate,
    WriteOffCreate,
)

router = APIRouter(tags=["invoices"])

PLAN_OFFSETS = {"monthly": 30, "biweekly": 14, "weekly": 7}


def _reload(db: Session, invoice_id: int) -> Invoice:
    """Flush pending work and return the invoice with fresh relationships."""
    db.flush()
    db.expire_all()
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


def _get_invoice(db: Session, invoice_id: int) -> Invoice:
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


def _next_invoice_number(db: Session, year: int) -> str:
    seq = db.query(Invoice).count() + 1
    while db.query(Invoice).filter(Invoice.number == f"INV-{year}-{seq:04d}").first():
        seq += 1
    return f"INV-{year}-{seq:04d}"


def _unique_reference(db: Session, model, prefix: str) -> str:
    seq = db.query(model).count() + 1
    candidate = f"{prefix}-{seq:04d}"
    while db.query(model).filter(model.reference == candidate).first():
        seq += 1
        candidate = f"{prefix}-{seq:04d}"
    return candidate


def _apply_payment_to_plan(db: Session, invoice: Invoice, amount: float) -> None:
    """Mirror a payment onto the oldest open installments of the active plan."""
    plan = next((p for p in invoice.plans if p.status == "active"), None)
    if not plan:
        return
    remaining = money(amount)
    for row in sorted(plan.schedule, key=lambda r: r.number):
        left = money(money(row.amount) - money(row.paid_amount))
        if left <= 0.005:
            continue
        applied = min(left, remaining)
        row.paid_amount = money(money(row.paid_amount) + applied)
        remaining = money(remaining - applied)
        if remaining <= 0.005:
            break
    refresh_plan_status(plan)


@router.get("/invoices")
def list_invoices(
    status: str | None = None,
    customer_id: int | None = None,
    contract_id: int | None = None,
    search: str | None = None,
    overdue: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(Invoice)
    if status:
        query = query.filter(Invoice.status == status)
    if customer_id:
        query = query.filter(Invoice.customer_id == customer_id)
    if contract_id:
        query = query.filter(Invoice.contract_id == contract_id)

    rows = [invoice_dict(i) for i in query.order_by(Invoice.due_date.desc()).all()]
    if overdue:
        rows = [r for r in rows if r["days_overdue"] > 0]
    if search:
        needle = search.lower()
        rows = [
            r
            for r in rows
            if needle in (r["number"] or "").lower()
            or needle in (r["customer_name"] or "").lower()
            or needle in (r["contract_reference"] or "").lower()
        ]
    return rows


@router.post("/invoices", status_code=201)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)):
    customer = db.get(Customer, payload.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    contract = None
    if payload.contract_id:
        contract = db.get(Contract, payload.contract_id)
        if not contract or contract.customer_id != customer.id:
            raise HTTPException(
                status_code=400, detail="Contract does not belong to this customer"
            )

    terms = (
        contract.payment_terms_days
        if contract
        else customer.payment_terms_days
    )
    number = (payload.number or "").strip() or _next_invoice_number(
        db, payload.issue_date.year
    )
    if db.query(Invoice).filter(Invoice.number == number).first():
        raise HTTPException(status_code=409, detail=f"Invoice {number} already exists")

    invoice = Invoice(
        number=number,
        customer_id=customer.id,
        contract_id=contract.id if contract else None,
        issue_date=payload.issue_date,
        due_date=payload.due_date or payload.issue_date + timedelta(days=terms),
        amount=payload.amount,
        tax_rate=payload.tax_rate,
        currency=payload.currency or (contract.currency if contract else customer.currency),
        status=payload.status,
        notes=payload.notes,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    refresh_invoice_status(invoice)
    db.commit()
    return invoice_dict(_reload(db, invoice.id), detailed=True)


@router.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    return invoice_dict(_get_invoice(db, invoice_id), detailed=True)


@router.post("/invoices/{invoice_id}/payments", status_code=201)
def record_payment(
    invoice_id: int, payload: PaymentCreate, db: Session = Depends(get_db)
):
    invoice = _get_invoice(db, invoice_id)
    if invoice.status == "written_off":
        raise HTTPException(status_code=400, detail="Invoice is written off")
    remaining = balance(invoice)
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="Invoice is already settled")
    if payload.amount > remaining + 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Payment exceeds the outstanding balance ({remaining:.2f})",
        )

    db.add(
        Payment(
            invoice_id=invoice.id,
            amount=payload.amount,
            paid_on=payload.paid_on or date.today(),
            method=payload.method,
            reference=payload.reference,
            note=payload.note,
        )
    )
    invoice = _reload(db, invoice_id)
    _apply_payment_to_plan(db, invoice, payload.amount)
    refresh_invoice_status(invoice)
    db.commit()
    return invoice_dict(_reload(db, invoice_id), detailed=True)


@router.post("/invoices/{invoice_id}/disputes", status_code=201)
def open_dispute(
    invoice_id: int, payload: DisputeCreate, db: Session = Depends(get_db)
):
    invoice = _get_invoice(db, invoice_id)
    if any(d.status in ("open", "investigating") for d in invoice.disputes):
        raise HTTPException(
            status_code=400, detail="This invoice already has an open dispute"
        )
    db.add(
        Dispute(
            invoice_id=invoice.id,
            reference=_unique_reference(db, Dispute, "DSP"),
            reason=payload.reason,
            description=payload.description,
            status="open",
            opened_on=payload.opened_on or date.today(),
        )
    )
    invoice = _reload(db, invoice_id)
    refresh_invoice_status(invoice)
    db.commit()
    return invoice_dict(_reload(db, invoice_id), detailed=True)


@router.post("/invoices/{invoice_id}/payment-plans", status_code=201)
def create_payment_plan(
    invoice_id: int, payload: PaymentPlanCreate, db: Session = Depends(get_db)
):
    invoice = _get_invoice(db, invoice_id)
    if invoice.status == "written_off":
        raise HTTPException(status_code=400, detail="Invoice is written off")
    if any(p.status == "active" for p in invoice.plans):
        raise HTTPException(
            status_code=400, detail="This invoice already has an active payment plan"
        )
    remaining = balance(invoice)
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="Invoice is already settled")

    offset = PLAN_OFFSETS.get(payload.frequency, 30)
    count = payload.installments
    per = money(remaining / count)
    start = payload.start_date or date.today()

    plan = PaymentPlan(
        invoice_id=invoice.id,
        reference=_unique_reference(db, PaymentPlan, "PP"),
        installments=count,
        installment_amount=per,
        total_amount=remaining,
        start_date=start,
        frequency=payload.frequency,
        status="active",
        note=payload.note,
    )
    db.add(plan)
    db.flush()
    for number in range(1, count + 1):
        amount = per if number < count else money(remaining - per * (count - 1))
        db.add(
            PlanInstallment(
                plan_id=plan.id,
                number=number,
                due_date=start + timedelta(days=offset * (number - 1)),
                amount=amount,
                paid_amount=0,
            )
        )
    invoice = _reload(db, invoice_id)
    refresh_invoice_status(invoice)
    db.commit()
    return invoice_dict(_reload(db, invoice_id), detailed=True)


@router.post("/invoices/{invoice_id}/actions", status_code=201)
def log_action(
    invoice_id: int, payload: CollectionActionCreate, db: Session = Depends(get_db)
):
    invoice = _get_invoice(db, invoice_id)
    db.add(
        CollectionAction(
            invoice_id=invoice.id,
            action_type=payload.action_type,
            note=payload.note,
            performed_on=payload.performed_on or date.today(),
            next_action_on=payload.next_action_on,
        )
    )
    db.commit()
    return invoice_dict(_reload(db, invoice_id), detailed=True)


@router.post("/invoices/{invoice_id}/write-off")
def write_off(
    invoice_id: int, payload: WriteOffCreate, db: Session = Depends(get_db)
):
    invoice = _get_invoice(db, invoice_id)
    if invoice.status == "written_off":
        raise HTTPException(status_code=400, detail="Invoice is already written off")
    invoice.status = "written_off"
    invoice.write_off_reason = (
        payload.reason or "Written off by the collections committee."
    )
    db.commit()
    return invoice_dict(_reload(db, invoice_id), detailed=True)
