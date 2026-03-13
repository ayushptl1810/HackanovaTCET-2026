"""
HaqSe – Citizen Welfare Agent API

Entrypoint for the FastAPI backend.
Initialises the SQLite database on startup and registers all route modules.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from db.models import init_db
from routes.voice_routes import voice_router
from services.auth_service import register_citizen, login_citizen, is_registered


# ---------------------------------------------------------------------------
# Lifespan — run once on startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="HaqSe — Citizen Welfare Agent API", lifespan=lifespan)

# Register routers
app.include_router(voice_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Lock down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {"message": "HaqSe Backend is running"}


@app.post("/api/auth/register")
async def api_register(data: CitizenRegister):
    """Register a new citizen with bcrypt-hashed PIN."""
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


@app.post("/api/auth/login")
async def api_login(data: CitizenLogin):
    """PIN-based login with bcrypt verification."""
    profile = login_citizen(data.mobile_number, data.pin)
    if profile is None:
        raise HTTPException(status_code=401, detail="Invalid mobile number or PIN")
    return {"success": True, "message": "Login successful", "user": profile}


@app.post("/api/login/csc")
async def csc_login(data: CSCLogin):
    """CSC operator login (mock for prototype)."""
    # TODO: Replace with proper CSC auth when CSC dashboard is built
    MOCK_CSC_USERS = {
        "CSC12345": {"password": "password123", "name": "Jan Seva Kendra - Mumbai"},
        "CSC67890": {"password": "csc_password", "name": "Digital Seva - Delhi"},
    }
    user = MOCK_CSC_USERS.get(data.csc_id)
    if not user or user["password"] != data.password:
        raise HTTPException(status_code=401, detail="Invalid CSC ID or password")
    return {
        "success": True,
        "message": "Login successful",
        "user": {"name": user["name"], "type": "csc"},
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
