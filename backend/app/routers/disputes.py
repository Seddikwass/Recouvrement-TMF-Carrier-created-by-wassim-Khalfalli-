from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..logic import dispute_dict, refresh_invoice_status
from ..models import Dispute
from ..schemas import DisputeUpdate

router = APIRouter(tags=["disputes"])

CLOSED = ("resolved", "rejected")


@router.get("/disputes")
def list_disputes(status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Dispute)
    if status:
        query = query.filter(Dispute.status == status)
    rows = query.order_by(Dispute.opened_on.desc()).all()
    return [dispute_dict(d) for d in rows]


@router.patch("/disputes/{dispute_id}")
def update_dispute(
    dispute_id: int, payload: DisputeUpdate, db: Session = Depends(get_db)
):
    dispute = db.get(Dispute, dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    if payload.status:
        if payload.status not in ("open", "investigating", "resolved", "rejected"):
            raise HTTPException(status_code=400, detail="Unsupported dispute status")
        dispute.status = payload.status
        if payload.status in CLOSED:
            dispute.resolved_on = date.today()
        else:
            dispute.resolved_on = None
    if payload.resolution_note is not None:
        dispute.resolution_note = payload.resolution_note

    db.flush()
    db.expire_all()
    invoice = dispute.invoice
    refresh_invoice_status(invoice)
    db.commit()
    return dispute_dict(dispute)
