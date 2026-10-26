from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    segment: Mapped[str] = mapped_column(String(40), default="Carrier")
    email: Mapped[str | None] = mapped_column(String(160))
    phone: Mapped[str | None] = mapped_column(String(40))
    country: Mapped[str | None] = mapped_column(String(60))
    currency: Mapped[str] = mapped_column(String(3), default="TND")
    credit_limit: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=30)
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    contracts: Mapped[list["Contract"]] = relationship(
        back_populates="customer", order_by="Contract.id"
    )
    invoices: Mapped[list["Invoice"]] = relationship(
        back_populates="customer", order_by="Invoice.id.desc()"
    )


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    title: Mapped[str] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(20), default="active")
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    currency: Mapped[str] = mapped_column(String(3), default="TND")
    billing_cycle: Mapped[str] = mapped_column(String(20), default="monthly")
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=30)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    customer: Mapped["Customer"] = relationship(back_populates="contracts")
    invoices: Mapped[list["Invoice"]] = relationship(
        back_populates="contract", order_by="Invoice.id.desc()"
    )


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    contract_id: Mapped[int | None] = mapped_column(ForeignKey("contracts.id"))
    issue_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=19)
    currency: Mapped[str] = mapped_column(String(3), default="TND")
    status: Mapped[str] = mapped_column(String(20), default="issued", index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    write_off_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    customer: Mapped["Customer"] = relationship(back_populates="invoices")
    contract: Mapped["Contract | None"] = relationship(back_populates="invoices")
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="invoice", order_by="Payment.paid_on", cascade="all, delete-orphan"
    )
    disputes: Mapped[list["Dispute"]] = relationship(
        back_populates="invoice", order_by="Dispute.id.desc()", cascade="all, delete-orphan"
    )
    plans: Mapped[list["PaymentPlan"]] = relationship(
        back_populates="invoice", order_by="PaymentPlan.id.desc()", cascade="all, delete-orphan"
    )
    actions: Mapped[list["CollectionAction"]] = relationship(
        back_populates="invoice",
        order_by="CollectionAction.id.desc()",
        cascade="all, delete-orphan",
    )

    @property
    def total(self) -> float:
        return round(float(self.amount) * (1 + float(self.tax_rate) / 100), 2)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"))
    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    paid_on: Mapped[date] = mapped_column(Date)
    method: Mapped[str] = mapped_column(String(30), default="bank_transfer")
    reference: Mapped[str | None] = mapped_column(String(80))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"))
    reference: Mapped[str] = mapped_column(String(40))
    reason: Mapped[str] = mapped_column(String(40), default="amount")
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open")
    opened_on: Mapped[date] = mapped_column(Date)
    resolved_on: Mapped[date | None] = mapped_column(Date)
    resolution_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    invoice: Mapped["Invoice"] = relationship(back_populates="disputes")


class PaymentPlan(Base):
    __tablename__ = "payment_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"))
    reference: Mapped[str] = mapped_column(String(40))
    installments: Mapped[int] = mapped_column(Integer, default=3)
    installment_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    start_date: Mapped[date] = mapped_column(Date)
    frequency: Mapped[str] = mapped_column(String(20), default="monthly")
    status: Mapped[str] = mapped_column(String(20), default="active")
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    invoice: Mapped["Invoice"] = relationship(back_populates="plans")
    schedule: Mapped[list["PlanInstallment"]] = relationship(
        back_populates="plan",
        order_by="PlanInstallment.number",
        cascade="all, delete-orphan",
    )


class PlanInstallment(Base):
    __tablename__ = "plan_installments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("payment_plans.id"))
    number: Mapped[int] = mapped_column(Integer)
    due_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    paid_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[str] = mapped_column(String(20), default="planned")

    plan: Mapped["PaymentPlan"] = relationship(back_populates="schedule")


class CollectionAction(Base):
    __tablename__ = "collection_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"))
    action_type: Mapped[str] = mapped_column(String(30), default="reminder")
    note: Mapped[str | None] = mapped_column(Text)
    performed_on: Mapped[date] = mapped_column(Date)
    next_action_on: Mapped[date | None] = mapped_column(Date)
    created_by: Mapped[str] = mapped_column(String(80), default="Collections desk")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    invoice: Mapped["Invoice"] = relationship(back_populates="actions")
