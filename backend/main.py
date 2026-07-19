from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Body, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
import os
from utils.notifications import send_sms, send_whatsapp
from routes.voice_routes import voice_router
from routes.digilocker_routes import digilocker_router
from routes.kyc_routes import kyc_router
from routes.citizen_routes import citizen_router
from routes.assistant_routes import assistant_router
from routes.locate_routes import locate_router
from routes.schemes_routes import schemes_router
from db.models import init_db
from services.auth_service import register_citizen, login_citizen


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create SQLite tables on startup (safe to call repeatedly).
    init_db()
    # Warm the scheme cache so the very first search is already fast.
    try:
        from services.scheme_cache import warm
        warm()
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Scheme cache warm failed: %s", exc)
    # Start the live ingestion scheduler (no-op unless INGESTION_ENABLED).
    try:
        from services.scheduler import start_scheduler
        start_scheduler()
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Scheduler start failed: %s", exc)
    yield
    try:
        from services.scheduler import stop_scheduler
        stop_scheduler()
    except Exception:
        pass


app = FastAPI(title="Hacknova Backend API", lifespan=lifespan)

app.include_router(voice_router)
app.include_router(digilocker_router)
app.include_router(kyc_router)
app.include_router(citizen_router)
app.include_router(assistant_router)
app.include_router(locate_router)
app.include_router(schemes_router)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the actual frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock CSC operator directory (kept until a real CSC dashboard/auth is built).
MOCK_CSC_USERS = {
    "CSC12345": {"password": "password123", "name": "Jan Seva Kendra - Mumbai"},
    "CSC67890": {"password": "csc_password", "name": "Digital Seva - Delhi"}
}

class CitizenRegister(BaseModel):
    mobile_number: str
    pin: str
    age_slab: str = ""
    gender: str = ""
    income_slab: str = ""
    annual_income: int = 0   # exact ₹/year (optional) → definitive eligibility
    occupation: str = ""
    state: str = ""          # unlocks State-specific schemes

class CitizenLogin(BaseModel):
    mobile_number: str
    pin: str

class CSCLogin(BaseModel):
    csc_id: str
    password: str

@app.get("/")
async def root():
    return {"message": "Hacknova Backend is running"}


@app.post("/api/scraper/run")
async def run_scraper(background_tasks: BackgroundTasks, num_pages: int = 3):
    """
    Trigger myScheme.gov.in scraper in background.
    Saves results to backend/data/schemes_database.json.
    num_pages: how many pages to scrape (each page ~10 schemes). Default 3.
    """
    from services.scraper_service import main as run_scraper_main

    def _scrape_then_refresh(pages: int):
        run_scraper_main(num_pages=pages, save_output=True)
        # Publish fresh data to the warm cache (atomic swap) so search is current.
        from services.scheme_cache import refresh
        refresh()

    background_tasks.add_task(_scrape_then_refresh, num_pages)
    return {
        "message": f"Scraper started in background for {num_pages} pages (~{num_pages * 10} schemes)",
        "output_file": "backend/data/schemes_database.json",
    }


@app.post("/api/schemes/ingest")
async def ingest_schemes(background_tasks: BackgroundTasks, pages: int = 3):
    """
    Run one live ingestion cycle now: crawl → diff → enrich new/changed →
    atomic cache swap. Runs in the background; poll /api/schemes/cache/status.
    """
    def _run():
        from services.ingestion import run_ingestion
        run_ingestion(pages=pages, enrich=True)

    background_tasks.add_task(_run)
    return {"message": f"Ingestion cycle started (pages={pages})"}


@app.get("/api/schemes/scheduler/status")
async def scheduler_status_route():
    """Ingestion scheduler status (enabled/running/interval)."""
    from services.scheduler import scheduler_status
    return scheduler_status()


@app.post("/api/schemes/enrich")
async def enrich_schemes(background_tasks: BackgroundTasks):
    """
    Run the agentic extractor over the current schemes to (re)build structured
    eligibility_rules, then publish the enriched set to the warm cache.
    Runs in the background (LLM calls per scheme); poll /api/schemes/cache/status.
    """
    def _enrich_all():
        from services.scheme_cache import get_schemes, set_schemes
        from services.extractor import enrich_scheme
        schemes = get_schemes(force=True)
        enriched = [enrich_scheme(s) for s in schemes]
        set_schemes(enriched)

    background_tasks.add_task(_enrich_all)
    return {"message": "Scheme enrichment started in background"}


@app.get("/api/schemes/cache/status")
async def scheme_cache_status():
    """Warm-cache status: scheme count, source (redis/file/ingest), and age."""
    from services.scheme_cache import cache_status
    return cache_status()


@app.post("/api/schemes/cache/refresh")
async def scheme_cache_refresh():
    """Force-reload the scheme cache from source (Redis/file)."""
    from services.scheme_cache import refresh
    return refresh()


@app.get("/api/scraper/schemes")
async def get_scraped_schemes():
    """Return all schemes currently stored in schemes_database.json."""
    import json
    schemes_path = os.path.join(os.path.dirname(__file__), "data", "schemes_database.json")
    if not os.path.exists(schemes_path):
        raise HTTPException(
            status_code=404,
            detail="schemes_database.json not found. Run /api/scraper/run first."
        )
    with open(schemes_path, encoding="utf-8") as f:
        schemes = json.load(f)
    return {"count": len(schemes), "schemes": schemes}

@app.post("/api/auth/register")
async def citizen_register(data: CitizenRegister):
    """Register a new citizen with a bcrypt-hashed PIN (SQLite-backed)."""
    try:
        profile = register_citizen(
            phone=data.mobile_number,
            pin=data.pin,
            age_choice=data.age_slab,
            gender_choice=data.gender,
            income_choice=data.income_slab,
            annual_income=data.annual_income,
            occupation_choice=data.occupation,
            state=data.state,
        )
        return {"success": True, "message": "Registration successful", "profile": profile}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.post("/api/login/citizen")
async def citizen_login(data: CitizenLogin):
    """PIN-based login with bcrypt verification against the citizen DB."""
    profile = login_citizen(data.mobile_number, data.pin)
    if profile is None:
        raise HTTPException(status_code=401, detail="Invalid mobile number or PIN")

    from core.security import create_access_token
    token = create_access_token(subject=data.mobile_number, role="citizen")
    return {
        "success": True,
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        "user": {**profile, "type": "citizen"},
    }

@app.post("/api/login/csc")
async def csc_login(data: CSCLogin):
    user = MOCK_CSC_USERS.get(data.csc_id)
    if not user or user["password"] != data.password:
        raise HTTPException(status_code=401, detail="Invalid CSC ID or password")
    
    return {
        "success": True,
        "message": "Login successful",
        "user": {
            "name": user["name"],
            "type": "csc"
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
