"""
Services module for HackanovaTCET-2026 backend

Provides integrations with external APIs and services:
- DigiLocker Service: Fetch user data from government digital locker
- Scraper Service: Scrape government scheme information from myScheme.gov.in
"""

from .digilocker_service import (
    DigiLockerService,
    initialize_service,
    UserProfile,
    UserDocument,
    SandboxAPIException,
    AccessToken
)

from .scraper_service import (
    fetch_raw_schemes,
    transform_to_standard_schema,
    save_schemes_to_file,
    main as scraper_main
)

__all__ = [
    # DigiLocker Service
    "DigiLockerService",
    "initialize_service",
    "UserProfile",
    "UserDocument",
    "SandboxAPIException",
    "AccessToken",
    # Scraper Service
    "fetch_raw_schemes",
    "transform_to_standard_schema",
    "save_schemes_to_file",
    "scraper_main"
]
