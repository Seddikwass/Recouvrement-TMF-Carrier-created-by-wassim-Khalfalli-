"""Demo dataset so the collections workflow is usable on first boot."""

import random
from datetime import date, timedelta

from sqlalchemy.orm import Session

from .logic import money, refresh_invoice_status, refresh_plan_status
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

CUSTOMERS = [
    ("CAR-1001", "Orange Tunisie", "Carrier", "TN", 420000, 30, "collections@orange.tn"),
    ("CAR-1002", "Ooredoo Tunisie", "Carrier", "TN", 360000, 30, "ap@ooredoo.tn"),
    ("CAR-1003", "Telecom Italia Sparkle", "Wholesale", "IT", 300000, 45, "ar@sparkle.it"),
    ("CAR-1004", "BICS", "Wholesale", "BE", 280000, 30, "billing@bics.be"),
    ("CAR-1005", "MTN GlobalConnect", "Carrier", "ZA", 250000, 60, "credit@mtngc.za"),
    ("CAR-1006", "Vodafone Roaming Services", "Roaming", "GB", 200000, 30, "roaming@vrs.co.uk"),
    ("CAR-1007", "Tunisie Telecom Mobile", "MVNO", "TN", 120000, 30, "finance@tt.tn"),
    ("CAR-1008", "Etisalat International", "Carrier", "AE", 180000, 45, "ar@etisalat.ae"),
]

CONTRACTS = [
    (0, "International voice termination", "CT-2024-001", 30, "monthly", -700),
    (0, "A2P SMS hubbing", "CT-2025-004", 45, "monthly", -320),
    (1, "Data roaming interconnect", "CT-2024-002", 30, "monthly", -640),
    (2, "Wholesale capacity lease", "CT-2024-003", 45, "quarterly", -520),
    (3, "Voice termination - Maghreb corridor", "CT-2025-001", 30, "monthly", -410),
    (4, "SMS hubbing - Africa", "CT-2025-002", 60, "monthly", -365),
    (5, "Roaming clearing house", "CT-2025-003", 30, "monthly", -290),
    (6, "MVNO airtime supply", "CT-2026-001", 30, "monthly", -150),
    (7, "International carrier services", "CT-2026-002", 45, "monthly", -210),
]

ACTION_TYPES = ["reminder", "email", "phone_call", "letter", "escalation"]


def seed(db: Session) -> None:
    if db.query(Customer).first():
        return

    rnd = random.Random(20261026)
    today = date.today()

    customers = [
        Customer(
            code=code,
            name=name,
            segment=segment,
            country=country,
            email=email,
            phone="+216 71 000 000",
            currency="TND",
            credit_limit=credit,
            payment_terms_days=terms,
            status="active",
        )
        for code, name, segment, country, credit, terms, email in CUSTOMERS
    ]
    db.add_all(customers)
    db.flush()

    contracts = [
        Contract(
            customer_id=customers[idx].id,
            title=title,
            reference=ref,
            status="active",
            start_date=today + timedelta(days=offset),
            currency="TND",
            billing_cycle=cycle,
            payment_terms_days=terms,
        )
        for idx, title, ref, terms, cycle, offset in CONTRACTS
    ]
    db.add_all(contracts)
    db.flush()

    invoices: list[Invoice] = []
    seq = 0
    for contract in contracts:
        for _ in range(rnd.randint(2, 4)):
            seq += 1
            # Keep a share of invoices recent so the ledger also shows balances
            # that are not yet due.
            age = rnd.randint(2, 20) if rnd.random() < 0.38 else rnd.randint(45, 225)
            issued = today - timedelta(days=age)
            amount = float(round(rnd.uniform(8_000, 145_000), -1))
            invoices.append(
                Invoice(
                    number=f"INV-{issued.year}-{seq:04d}",
                    customer_id=contract.customer_id,
                    contract_id=contract.id,
                    issue_date=issued,
                    due_date=issued + timedelta(days=contract.payment_terms_days),
                    amount=amount,
                    tax_rate=19,
                    currency="TND",
                    status="issued",
                    notes=None,
                )
            )
    db.add_all(invoices)
    db.flush()

    # Payments: settle some invoices, partially pay some, leave the rest open.
    for invoice in invoices:
        roll = rnd.random()
        paid_on = invoice.issue_date + timedelta(days=rnd.randint(5, 40))
        if paid_on > today:
            paid_on = today - timedelta(days=rnd.randint(1, 5))
        if roll < 0.46:
            db.add(
                Payment(
                    invoice_id=invoice.id,
                    amount=invoice.total,
                    paid_on=paid_on,
                    method=rnd.choice(["bank_transfer", "bank_transfer", "cheque"]),
                    reference=f"TRF-{rnd.randint(10000, 99999)}",
                )
            )
        elif roll < 0.64:
            db.add(
                Payment(
                    invoice_id=invoice.id,
                    amount=money(invoice.total * rnd.uniform(0.3, 0.7)),
                    paid_on=paid_on,
                    method="bank_transfer",
                    reference=f"TRF-{rnd.randint(10000, 99999)}",
                )
            )
    db.flush()

    # Only invoices that still carry a balance are collection candidates.
    paid_by_invoice: dict[int, float] = {}
    for payment in db.query(Payment).all():
        paid_by_invoice[payment.invoice_id] = paid_by_invoice.get(
            payment.invoice_id, 0.0
        ) + money(payment.amount)
    unpaid = [
        i
        for i in invoices
        if money(float(i.total) - paid_by_invoice.get(i.id, 0.0)) > 0.005
    ]

    def outstanding(invoice: Invoice) -> float:
        return money(float(invoice.total) - paid_by_invoice.get(invoice.id, 0.0))

    # Scenario 1: two open disputes on unpaid invoices.
    disputed_candidates = [i for i in unpaid if i.due_date < today][:2]
    for idx, invoice in enumerate(disputed_candidates):
        db.add(
            Dispute(
                invoice_id=invoice.id,
                reference=f"DSP-{invoice.number[-4:]}",
                reason="amount" if idx == 0 else "service_quality",
                description=(
                    "Customer contests the interconnect rate applied on peak traffic."
                    if idx == 0
                    else "Customer reports failed delivery on a batch of A2P messages."
                ),
                status="open",
                opened_on=max(invoice.issue_date, today - timedelta(days=18 + idx * 6)),
            )
        )

    # Scenario 2: two active payment plans with a settled first installment.
    plan_candidates = [i for i in unpaid if i.due_date < today][2:4]
    for idx, invoice in enumerate(plan_candidates):
        remaining = outstanding(invoice)
        count = 3
        per = money(remaining / count)
        start = today - timedelta(days=10)
        plan = PaymentPlan(
            invoice_id=invoice.id,
            reference=f"PP-{invoice.number[-4:]}",
            installments=count,
            installment_amount=per,
            total_amount=remaining,
            start_date=start,
            frequency="monthly",
            status="active",
            note="Recovery plan agreed with the carrier finance team.",
        )
        db.add(plan)
        db.flush()
        for number in range(1, count + 1):
            amount = per if number < count else money(remaining - per * (count - 1))
            db.add(
                PlanInstallment(
                    plan_id=plan.id,
                    number=number,
                    due_date=start + timedelta(days=30 * (number - 1)),
                    amount=amount,
                    paid_amount=amount if number == 1 else 0,
                )
            )
        if idx == 1:
            # Mirror the settled first installment as a real payment.
            db.add(
                Payment(
                    invoice_id=invoice.id,
                    amount=per,
                    paid_on=start,
                    method="bank_transfer",
                    reference=f"PP-{invoice.number[-4:]}-1",
                    note="First payment plan installment",
                )
            )

    # Scenario 3: one uncollectible invoice written off.
    write_off_candidates = [i for i in unpaid if i.due_date < today][4:5]
    for invoice in write_off_candidates:
        invoice.status = "written_off"
        invoice.write_off_reason = "Customer under insolvency proceedings - provision booked."

    # Scenario 4: dunning trail on the oldest overdue invoices.
    overdue = sorted(
        [i for i in unpaid if i.due_date < today and i.status != "written_off"],
        key=lambda i: i.due_date,
    )
    for idx, invoice in enumerate(overdue[:6]):
        performed = max(invoice.due_date + timedelta(days=5), today - timedelta(days=25))
        db.add(
            CollectionAction(
                invoice_id=invoice.id,
                action_type=ACTION_TYPES[idx % len(ACTION_TYPES)],
                note=(
                    "Payment reminder sent to the accounts payable contact."
                    if idx % 2 == 0
                    else "Call with customer finance team - commitment to review."
                ),
                performed_on=min(performed, today),
                next_action_on=today + timedelta(days=rnd.randint(3, 12)),
                created_by="Collections desk",
            )
        )

    db.flush()
    db.expire_all()

    for invoice in invoices:
        refresh_invoice_status(invoice)
        for plan in invoice.plans:
            refresh_plan_status(plan)

    db.commit()
