from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
import os
from utils.notifications import send_sms, send_whatsapp
from routes.voice_routes import voice_router

app = FastAPI(title="Hacknova Backend API")

app.include_router(voice_router)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the actual frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock databases
MOCK_CITIZENS = {
    "9876543210": {"pin": "123456", "name": "Rajesh Kumar"},
    "7208494565": {"pin": "000000", "name": "Ayush Patel"}
}

MOCK_CSC_USERS = {
    "CSC12345": {"password": "password123", "name": "Jan Seva Kendra - Mumbai"},
    "CSC67890": {"password": "csc_password", "name": "Digital Seva - Delhi"}
}

class CitizenLogin(BaseModel):
    mobile_number: str
    pin: str

class CSCLogin(BaseModel):
    csc_id: str
    password: str

@app.get("/")
async def root():
    return {"message": "Hacknova Backend is running"}

@app.post("/api/login/citizen")
async def citizen_login(data: CitizenLogin):
    user = MOCK_CITIZENS.get(data.mobile_number)
    if not user or user["pin"] != data.pin:
        raise HTTPException(status_code=401, detail="Invalid mobile number or PIN")
    
    # Optional: Send a notification on login
    # send_sms(data.mobile_number, f"Hello {user['name']}, you have successfully logged in to the portal.")
    
    return {
        "success": True,
        "message": "Login successful",
        "user": {
            "name": user["name"],
            "type": "citizen"
        }
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
