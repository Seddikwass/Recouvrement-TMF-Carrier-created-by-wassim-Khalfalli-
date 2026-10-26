import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.exc import OperationalError

from .db import SessionLocal, engine
from .models import Base
from .routers import contracts, customers, dashboard, disputes, invoices, plans
from .seed import seed


def init_database(attempts: int = 20) -> None:
    for attempt in range(1, attempts + 1):
        try:
            Base.metadata.create_all(bind=engine)
            with SessionLocal() as db:
                seed(db)
            return
        except OperationalError:
            if attempt == attempts:
                raise
            time.sleep(1.5)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    yield


app = FastAPI(
    title="Recouvrement TMF Carrier API",
    description="Accounts receivable and collections workflow for carrier interconnect billing.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

for module in (customers, contracts, invoices, disputes, plans, dashboard):
    app.include_router(module.router, prefix="/api")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
