"""Shared collection logic: balances, derived statuses and API serialization."""

from datetime import date

from .models import (
    CollectionAction,
    Contract,
    Customer,
    Dispute,
    Invoice,
    Payment,
    PaymentPlan,
    PlanInstallment,
)

OPEN_DISPUTE_STATUSES = ("open", "investigating")
CLOSED_INVOICE_STATUSES = ("draft", "written_off")


def money(value) -> float:
    return round(float(value or 0), 2)


def today() -> date:
    return date.today()


def paid_amount(invoice: Invoice) -> float:
    return money(sum(money(p.amount) for p in invoice.payments))


def balance(invoice: Invoice) -> float:
    if invoice.status == "written_off":
        return 0.0
    return max(0.0, money(invoice.total - paid_amount(invoice)))


def has_open_dispute(invoice: Invoice) -> bool:
    return any(d.status in OPEN_DISPUTE_STATUSES for d in invoice.disputes)


def days_overdue(invoice: Invoice) -> int:
    if invoice.status in CLOSED_INVOICE_STATUSES or balance(invoice) <= 0.005:
        return 0
    return max(0, (today() - invoice.due_date).days)


def refresh_invoice_status(invoice: Invoice) -> None:
    """Derive the invoice status from payments, disputes and the due date."""
    if invoice.status in CLOSED_INVOICE_STATUSES:
        return
    remaining = money(invoice.total - paid_amount(invoice))
    if remaining <= 0.005:
        invoice.status = "paid"
    elif has_open_dispute(invoice):
        invoice.status = "disputed"
    elif paid_amount(invoice) > 0.005:
        invoice.status = "partially_paid"
    elif invoice.due_date < today():
        invoice.status = "overdue"
    else:
        invoice.status = "issued"


def refresh_plan_status(plan: PaymentPlan) -> None:
    if plan.status in ("cancelled", "completed"):
        return
    rows = plan.schedule
    if rows and all(money(r.paid_amount) >= money(r.amount) - 0.005 for r in rows):
        plan.status = "completed"
    elif any(
        money(r.paid_amount) < money(r.amount) - 0.005 and r.due_date < today()
        for r in rows
    ):
        plan.status = "broken"
    else:
        plan.status = "active"


# --------------------------------------------------------------------------- #
# Serializers
# --------------------------------------------------------------------------- #


def payment_dict(payment: Payment) -> dict:
    return {
        "id": payment.id,
        "invoice_id": payment.invoice_id,
        "amount": money(payment.amount),
        "paid_on": payment.paid_on.isoformat(),
        "method": payment.method,
        "reference": payment.reference,
        "note": payment.note,
    }


def dispute_dict(dispute: Dispute) -> dict:
    invoice = dispute.invoice
    return {
        "id": dispute.id,
        "reference": dispute.reference,
        "invoice_id": dispute.invoice_id,
        "invoice_number": invoice.number if invoice else None,
        "customer_id": invoice.customer_id if invoice else None,
        "customer_name": invoice.customer.name if invoice and invoice.customer else None,
        "amount": balance(invoice) if invoice else 0,
        "currency": invoice.currency if invoice else "TND",
        "reason": dispute.reason,
        "description": dispute.description,
        "status": dispute.status,
        "opened_on": dispute.opened_on.isoformat(),
        "resolved_on": dispute.resolved_on.isoformat() if dispute.resolved_on else None,
        "resolution_note": dispute.resolution_note,
    }


def installment_dict(row: PlanInstallment) -> dict:
    paid = money(row.paid_amount)
    amount = money(row.amount)
    if paid >= amount - 0.005:
        status = "paid"
    elif row.due_date < today():
        status = "overdue"
    else:
        status = "planned"
    return {
        "id": row.id,
        "plan_id": row.plan_id,
        "number": row.number,
        "due_date": row.due_date.isoformat(),
        "amount": amount,
        "paid_amount": paid,
        "remaining": max(0.0, money(amount - paid)),
        "status": status,
    }


def plan_dict(plan: PaymentPlan) -> dict:
    invoice = plan.invoice
    rows = [installment_dict(r) for r in plan.schedule]
    return {
        "id": plan.id,
        "reference": plan.reference,
        "invoice_id": plan.invoice_id,
        "invoice_number": invoice.number if invoice else None,
        "customer_id": invoice.customer_id if invoice else None,
        "customer_name": invoice.customer.name if invoice and invoice.customer else None,
        "currency": invoice.currency if invoice else "TND",
        "installments": plan.installments,
        "installment_amount": money(plan.installment_amount),
        "total_amount": money(plan.total_amount),
        "paid_amount": money(sum(r["paid_amount"] for r in rows)),
        "start_date": plan.start_date.isoformat(),
        "frequency": plan.frequency,
        "status": plan.status,
        "note": plan.note,
        "schedule": rows,
    }


def action_dict(action: CollectionAction) -> dict:
    invoice = action.invoice
    return {
        "id": action.id,
        "invoice_id": action.invoice_id,
        "invoice_number": invoice.number if invoice else None,
        "customer_name": invoice.customer.name if invoice and invoice.customer else None,
        "action_type": action.action_type,
        "note": action.note,
        "performed_on": action.performed_on.isoformat(),
        "next_action_on": action.next_action_on.isoformat() if action.next_action_on else None,
        "created_by": action.created_by,
    }


def invoice_dict(invoice: Invoice, detailed: bool = False) -> dict:
    remaining = balance(invoice)
    data = {
        "id": invoice.id,
        "number": invoice.number,
        "customer_id": invoice.customer_id,
        "customer_name": invoice.customer.name if invoice.customer else None,
        "customer_code": invoice.customer.code if invoice.customer else None,
        "contract_id": invoice.contract_id,
        "contract_reference": invoice.contract.reference if invoice.contract else None,
        "contract_title": invoice.contract.title if invoice.contract else None,
        "issue_date": invoice.issue_date.isoformat(),
        "due_date": invoice.due_date.isoformat(),
        "amount": money(invoice.amount),
        "tax_rate": money(invoice.tax_rate),
        "total": invoice.total,
        "currency": invoice.currency,
        "status": invoice.status,
        "paid_amount": paid_amount(invoice),
        "balance": remaining,
        "days_overdue": days_overdue(invoice),
        "open_disputes": sum(1 for d in invoice.disputes if d.status in OPEN_DISPUTE_STATUSES),
        "has_payment_plan": any(p.status == "active" for p in invoice.plans),
        "write_off_reason": invoice.write_off_reason,
        "notes": invoice.notes,
    }
    if detailed:
        data["payments"] = [payment_dict(p) for p in invoice.payments]
        data["disputes"] = [dispute_dict(d) for d in invoice.disputes]
        data["plans"] = [plan_dict(p) for p in invoice.plans]
        data["actions"] = [action_dict(a) for a in invoice.actions]
        data["timeline"] = invoice_timeline(invoice)
    return data


def invoice_timeline(invoice: Invoice) -> list[dict]:
    events: list[dict] = [
        {
            "date": invoice.issue_date.isoformat(),
            "kind": "issued",
            "label": f"Invoice {invoice.number} issued",
            "detail": f"{invoice.currency} {invoice.total:,.2f}",
        }
    ]
    for payment in invoice.payments:
        events.append(
            {
                "date": payment.paid_on.isoformat(),
                "kind": "payment",
                "label": f"Payment received ({payment.method.replace('_', ' ')})",
                "detail": f"{invoice.currency} {money(payment.amount):,.2f}",
            }
        )
    for dispute in invoice.disputes:
        events.append(
            {
                "date": dispute.opened_on.isoformat(),
                "kind": "dispute",
                "label": f"Dispute {dispute.reference} opened",
                "detail": dispute.description,
            }
        )
        if dispute.resolved_on:
            events.append(
                {
                    "date": dispute.resolved_on.isoformat(),
                    "kind": "dispute",
                    "label": f"Dispute {dispute.reference} {dispute.status}",
                    "detail": dispute.resolution_note or "",
                }
            )
    for plan in invoice.plans:
        events.append(
            {
                "date": plan.start_date.isoformat(),
                "kind": "plan",
                "label": f"Payment plan {plan.reference} created",
                "detail": f"{plan.installments} installments of {invoice.currency} "
                f"{money(plan.installment_amount):,.2f}",
            }
        )
        for row in plan.schedule:
            if money(row.paid_amount) > 0:
                events.append(
                    {
                        "date": row.due_date.isoformat(),
                        "kind": "plan",
                        "label": f"{plan.reference} installment {row.number} settled",
                        "detail": f"{invoice.currency} {money(row.paid_amount):,.2f}",
                    }
                )
    for action in invoice.actions:
        events.append(
            {
                "date": action.performed_on.isoformat(),
                "kind": "action",
                "label": action.action_type.replace("_", " ").capitalize(),
                "detail": action.note or "",
            }
        )
    if invoice.status == "written_off":
        events.append(
            {
                "date": invoice.due_date.isoformat(),
                "kind": "write_off",
                "label": "Invoice written off",
                "detail": invoice.write_off_reason or "",
            }
        )
    return sorted(events, key=lambda e: e["date"], reverse=True)


def contract_dict(contract: Contract, detailed: bool = False) -> dict:
    invoices = contract.invoices
    data = {
        "id": contract.id,
        "reference": contract.reference,
        "customer_id": contract.customer_id,
        "customer_name": contract.customer.name if contract.customer else None,
        "title": contract.title,
        "status": contract.status,
        "start_date": contract.start_date.isoformat(),
        "end_date": contract.end_date.isoformat() if contract.end_date else None,
        "currency": contract.currency,
        "billing_cycle": contract.billing_cycle,
        "payment_terms_days": contract.payment_terms_days,
        "invoice_count": len(invoices),
        "billed": money(sum(i.total for i in invoices)),
        "outstanding": money(sum(balance(i) for i in invoices)),
    }
    if detailed:
        data["invoices"] = [invoice_dict(i) for i in invoices]
    return data


def customer_dict(customer: Customer, detailed: bool = False) -> dict:
    invoices = customer.invoices
    outstanding = money(sum(balance(i) for i in invoices))
    data = {
        "id": customer.id,
        "code": customer.code,
        "name": customer.name,
        "segment": customer.segment,
        "email": customer.email,
        "phone": customer.phone,
        "country": customer.country,
        "currency": customer.currency,
        "credit_limit": money(customer.credit_limit),
        "payment_terms_days": customer.payment_terms_days,
        "status": customer.status,
        "invoice_count": len(invoices),
        "billed": money(sum(i.total for i in invoices)),
        "collected": money(sum(paid_amount(i) for i in invoices)),
        "outstanding": outstanding,
        "overdue": money(
            sum(balance(i) for i in invoices if days_overdue(i) > 0)
        ),
        "credit_exposure": round(outstanding / money(customer.credit_limit) * 100, 1)
        if money(customer.credit_limit) > 0
        else None,
    }
    if detailed:
        data["contracts"] = [contract_dict(c) for c in customer.contracts]
        data["invoices"] = [invoice_dict(i) for i in invoices]
        data["open_disputes"] = sum(
            1
            for i in invoices
            for d in i.disputes
            if d.status in OPEN_DISPUTE_STATUSES
        )
    return data
