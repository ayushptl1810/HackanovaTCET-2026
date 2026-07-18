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
from db.models import init_db
from services.auth_service import register_citizen, login_citizen


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create SQLite tables on startup (safe to call repeatedly).
    init_db()
    yield


app = FastAPI(title="Hacknova Backend API", lifespan=lifespan)

app.include_router(voice_router)
app.include_router(digilocker_router)
app.include_router(kyc_router)

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
    occupation: str = ""

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
    background_tasks.add_task(run_scraper_main, num_pages=num_pages, save_output=True)
    return {
        "message": f"Scraper started in background for {num_pages} pages (~{num_pages * 10} schemes)",
        "output_file": "backend/data/schemes_database.json"
    }


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
            occupation_choice=data.occupation,
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

    return {
        "success": True,
        "message": "Login successful",
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
