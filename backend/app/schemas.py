from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class CustomerCreate(BaseModel):
    name: str = Field(min_length=2)
    code: Optional[str] = None
    segment: str = "Carrier"
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    currency: str = "TND"
    credit_limit: float = 0
    payment_terms_days: int = 30
    status: str = "active"


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    segment: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    credit_limit: Optional[float] = None
    payment_terms_days: Optional[int] = None
    status: Optional[str] = None


class ContractCreate(BaseModel):
    customer_id: int
    title: str = Field(min_length=2)
    reference: Optional[str] = None
    status: str = "active"
    start_date: date
    end_date: Optional[date] = None
    currency: str = "TND"
    billing_cycle: str = "monthly"
    payment_terms_days: int = 30


class InvoiceCreate(BaseModel):
    customer_id: int
    contract_id: Optional[int] = None
    number: Optional[str] = None
    issue_date: date
    due_date: Optional[date] = None
    amount: float = Field(gt=0)
    tax_rate: float = 19
    currency: Optional[str] = None
    status: str = "issued"
    notes: Optional[str] = None


class PaymentCreate(BaseModel):
    amount: float = Field(gt=0)
    paid_on: Optional[date] = None
    method: str = "bank_transfer"
    reference: Optional[str] = None
    note: Optional[str] = None


class DisputeCreate(BaseModel):
    reason: str = "amount"
    description: str = Field(min_length=3)
    opened_on: Optional[date] = None


class DisputeUpdate(BaseModel):
    status: Optional[str] = None
    resolution_note: Optional[str] = None


class PaymentPlanCreate(BaseModel):
    installments: int = Field(default=3, ge=2, le=12)
    start_date: Optional[date] = None
    frequency: str = "monthly"
    note: Optional[str] = None


class CollectionActionCreate(BaseModel):
    action_type: str = "reminder"
    note: Optional[str] = None
    performed_on: Optional[date] = None
    next_action_on: Optional[date] = None


class WriteOffCreate(BaseModel):
    reason: Optional[str] = None
