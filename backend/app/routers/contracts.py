from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..logic import contract_dict
from ..models import Contract, Customer
from ..schemas import ContractCreate

router = APIRouter(tags=["contracts"])


def _next_reference(db: Session) -> str:
    return f"CT-{2026}-{db.query(Contract).count() + 1:03d}"


@router.get("/contracts")
def list_contracts(customer_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Contract)
    if customer_id:
        query = query.filter(Contract.customer_id == customer_id)
    return [contract_dict(c) for c in query.order_by(Contract.reference).all()]


@router.post("/contracts", status_code=201)
def create_contract(payload: ContractCreate, db: Session = Depends(get_db)):
    customer = db.get(Customer, payload.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    reference = (payload.reference or "").strip() or _next_reference(db)
    if db.query(Contract).filter(Contract.reference == reference).first():
        raise HTTPException(
            status_code=409, detail=f"Contract reference {reference} already exists"
        )
    contract = Contract(
        reference=reference,
        **payload.model_dump(exclude={"reference"}),
        currency=payload.currency or customer.currency,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract_dict(contract, detailed=True)


@router.get("/contracts/{contract_id}")
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract_dict(contract, detailed=True)


@router.patch("/contracts/{contract_id}")
def update_contract_status(
    contract_id: int, status: str, db: Session = Depends(get_db)
):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if status not in ("active", "suspended", "terminated"):
        raise HTTPException(status_code=400, detail="Unsupported contract status")
    contract.status = status
    db.commit()
    db.refresh(contract)
    return contract_dict(contract, detailed=True)
