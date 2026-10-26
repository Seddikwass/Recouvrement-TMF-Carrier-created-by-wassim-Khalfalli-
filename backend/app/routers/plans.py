from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..logic import (
    balance,
    money,
    plan_dict,
    refresh_invoice_status,
    refresh_plan_status,
)
from ..models import Invoice, Payment, PaymentPlan, PlanInstallment

router = APIRouter(tags=["payment-plans"])


@router.get("/payment-plans")
def list_payment_plans(status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(PaymentPlan)
    if status:
        query = query.filter(PaymentPlan.status == status)
    rows = query.order_by(PaymentPlan.start_date.desc()).all()
    return [plan_dict(p) for p in rows]


@router.post("/installments/{installment_id}/pay")
def pay_installment(installment_id: int, db: Session = Depends(get_db)):
    row = db.get(PlanInstallment, installment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Installment not found")

    plan = row.plan
    invoice = plan.invoice
    if invoice.status == "written_off":
        raise HTTPException(status_code=400, detail="Invoice is written off")

    due = money(money(row.amount) - money(row.paid_amount))
    if due <= 0.005:
        raise HTTPException(status_code=400, detail="Installment is already settled")

    db.add(
        Payment(
            invoice_id=invoice.id,
            amount=due,
            paid_on=date.today(),
            method="bank_transfer",
            reference=f"{plan.reference}-{row.number}",
            note=f"Payment plan installment {row.number}",
        )
    )
    row.paid_amount = money(money(row.paid_amount) + due)

    plan_id, invoice_id = plan.id, invoice.id
    db.flush()
    db.expire_all()

    plan = db.get(PaymentPlan, plan_id)
    refresh_plan_status(plan)
    refresh_invoice_status(db.get(Invoice, invoice_id))
    db.commit()
    return plan_dict(plan)


@router.delete("/payment-plans/{plan_id}", status_code=204)
def cancel_payment_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.get(PaymentPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Payment plan not found")
    plan.status = "cancelled"
    db.commit()
    return None
