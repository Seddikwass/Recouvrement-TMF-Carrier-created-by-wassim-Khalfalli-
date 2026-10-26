from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..logic import customer_dict
from ..models import Customer
from ..schemas import CustomerCreate, CustomerUpdate

router = APIRouter(tags=["customers"])


def _next_code(db: Session) -> str:
    return f"CAR-{1001 + db.query(Customer).count()}"


@router.get("/customers")
def list_customers(db: Session = Depends(get_db)):
    rows = db.query(Customer).order_by(Customer.name).all()
    return [customer_dict(c) for c in rows]


@router.post("/customers", status_code=201)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    code = (payload.code or "").strip() or _next_code(db)
    if db.query(Customer).filter(Customer.code == code).first():
        raise HTTPException(status_code=409, detail=f"Customer code {code} already exists")
    customer = Customer(code=code, **payload.model_dump(exclude={"code"}))
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer_dict(customer, detailed=True)


@router.get("/customers/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer_dict(customer, detailed=True)


@router.patch("/customers/{customer_id}")
def update_customer(
    customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)
):
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer_dict(customer, detailed=True)
