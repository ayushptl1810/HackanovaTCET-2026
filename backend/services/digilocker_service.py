"""
DigiLocker Service for Sandbox API Integration

This service handles all interactions with the Sandbox API for fetching user data
from DigiLocker and related KYC endpoints. It provides a unified interface for:
- User authentication and token generation
- Document retrieval (Aadhaar, PAN, Driving License)
- User profile data aggregation
- Error handling and retry logic
"""

import os
import requests
import json
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class AccessToken:
    """Represents an access token with expiry information"""
    token: str
    issued_at: datetime
    expires_in_hours: int = 24

    def is_expired(self) -> bool:
        """Check if token has expired"""
        expiry_time = self.issued_at + timedelta(hours=self.expires_in_hours)
        return datetime.now() >= expiry_time


@dataclass
class UserDocument:
    """Represents a document fetched from DigiLocker"""
    doc_type: str  # e.g., 'aadhaar', 'pan', 'driving_license'
    file_url: str
    file_size: int
    content_type: str
    issuer: str
    issuer_id: str
    last_modified: str
    description: Optional[str] = None


@dataclass
class UserProfile:
    """Comprehensive user profile data aggregated from all sources"""
    user_id: str
    documents: Dict[str, UserDocument]
    pan_details: Optional[Dict[str, Any]] = None
    aadhaar_details: Optional[Dict[str, Any]] = None
    bank_account_details: Optional[Dict[str, Any]] = None
    additional_metadata: Optional[Dict[str, Any]] = None


class SandboxAPIException(Exception):
    """Custom exception for Sandbox API errors"""
    pass


class DigiLockerService:
    """
    Service for interacting with Sandbox API (DigiLocker and KYC endpoints)

    This service manages:
    - API authentication and token refresh
    - User document fetching
    - KYC data aggregation
    - Session management for DigiLocker workflows
    """

    BASE_URL = "https://api.sandbox.co.in"
    TEST_BASE_URL = "https://test-api.sandbox.co.in"

    def __init__(self, api_key: str, api_secret: str, use_test: bool = False):
        """
        Initialize DigiLocker service with credentials

        Args:
            api_key: Sandbox API key (from .env)
            api_secret: Sandbox API secret (from .env)
            use_test: Whether to use test environment (default: False)
        """
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = self.TEST_BASE_URL if use_test else self.BASE_URL
        self.access_token: Optional[AccessToken] = None
        self.session = requests.Session()

    def authenticate(self) -> str:
        """
        Authenticate with Sandbox API and get access token

        Returns:
            str: Access token for subsequent API calls

        Raises:
            SandboxAPIException: If authentication fails
        """
        if self.access_token and not self.access_token.is_expired():
            logger.info("Using cached access token")
            return self.access_token.token

        url = f"{self.base_url}/authenticate"
        headers = {
            "x-api-key": self.api_key,
            "x-api-secret": self.api_secret,
            "x-api-version": "1.0"
        }

        try:
            logger.info("Authenticating with Sandbox API...")
            response = requests.post(url, headers=headers)
            response.raise_for_status()

            data = response.json()
            if data.get("code") != 200:
                raise SandboxAPIException(f"Authentication failed: {data}")

            token = data["data"]["access_token"]
            self.access_token = AccessToken(
                token=token,
                issued_at=datetime.now()
            )
            logger.info("Successfully authenticated with Sandbox API")
            return token

        except requests.exceptions.RequestException as e:
            logger.error(f"Authentication request failed: {e}")
            raise SandboxAPIException(f"Failed to authenticate: {e}")

    def _get_headers(self, include_auth: bool = True) -> Dict[str, str]:
        """
        Get request headers with optional authentication

        Args:
            include_auth: Whether to include authorization header

        Returns:
            Dict of headers
        """
        headers = {
            "Content-Type": "application/json",
            "x-api-version": "1.0"
        }

        if include_auth:
            token = self.authenticate()
            headers["Authorization"] = token

        return headers

    def initiate_digilocker_session(
        self,
        flow: str = "signin",
        doc_types: Optional[List[str]] = None,
        redirect_url: str = "http://localhost:3000/digilocker/callback"
    ) -> Dict[str, Any]:
        """
        Initiate a DigiLocker session for user consent

        Args:
            flow: 'signin' or 'signup'
            doc_types: List of document types to request
                      (default: ['aadhaar', 'pan', 'driving_license'])
            redirect_url: URL to redirect after user consent

        Returns:
            Dict with session_id and authorization_url

        Raises:
            SandboxAPIException: If session initiation fails
        """
        if doc_types is None:
            doc_types = ["aadhaar", "pan", "driving_license"]

        url = f"{self.base_url}/kyc/digilocker/sessions/init"
        headers = self._get_headers()

        payload = {
            "@entity": "in.co.sandbox.kyc.digilocker.session.request",
            "flow": flow,
            "doc_types": doc_types,
            "redirect_url": redirect_url
        }

        try:
            logger.info(f"Initiating DigiLocker session for doc_types: {doc_types}")
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()

            data = response.json()
            if data.get("code") != 200:
                raise SandboxAPIException(f"Session initiation failed: {data}")

            result = {
                "session_id": data["data"]["session_id"],
                "authorization_url": data["data"]["authorization_url"],
                "transaction_id": data.get("transaction_id")
            }
            logger.info(f"Session initiated: {result['session_id']}")
            return result

        except requests.exceptions.RequestException as e:
            logger.error(f"Session initiation request failed: {e}")
            raise SandboxAPIException(f"Failed to initiate session: {e}")

    def fetch_document(
        self,
        session_id: str,
        doc_type: str
    ) -> UserDocument:
        """
        Fetch a specific document from DigiLocker

        Args:
            session_id: Session ID from initiate_digilocker_session
            doc_type: Document type (aadhaar, pan, driving_license)

        Returns:
            UserDocument with file URL and metadata

        Raises:
            SandboxAPIException: If document fetch fails
        """
        url = f"{self.base_url}/kyc/digilocker/sessions/{session_id}/documents/{doc_type}"
        headers = self._get_headers()

        try:
            logger.info(f"Fetching {doc_type} document for session {session_id}")
            response = requests.get(url, headers=headers)
            response.raise_for_status()

            data = response.json()
            if data.get("code") != 200:
                raise SandboxAPIException(f"Document fetch failed: {data}")

            # Extract first file from response
            files = data["data"].get("files", [])
            if not files:
                logger.warning(f"No files found for {doc_type}")
                return None

            file_data = files[0]
            doc = UserDocument(
                doc_type=doc_type,
                file_url=file_data.get("url"),
                file_size=file_data.get("size", 0),
                content_type=file_data.get("ContentType"),
                issuer=file_data.get("issuer"),
                issuer_id=file_data.get("issuer_id"),
                last_modified=file_data.get("LastModified"),
                description=file_data.get("description")
            )
            logger.info(f"Successfully fetched {doc_type} document")
            return doc

        except requests.exceptions.RequestException as e:
            logger.error(f"Document fetch request failed: {e}")
            raise SandboxAPIException(f"Failed to fetch document {doc_type}: {e}")

    def fetch_all_documents(
        self,
        session_id: str,
        doc_types: Optional[List[str]] = None
    ) -> Dict[str, UserDocument]:
        """
        Fetch all available documents for a session

        Args:
            session_id: Session ID from DigiLocker
            doc_types: List of document types to fetch
                      (default: all available types)

        Returns:
            Dictionary mapping doc_type to UserDocument
        """
        if doc_types is None:
            doc_types = ["aadhaar", "pan", "driving_license"]

        documents = {}
        for doc_type in doc_types:
            try:
                doc = self.fetch_document(session_id, doc_type)
                if doc:
                    documents[doc_type] = doc
            except SandboxAPIException as e:
                logger.warning(f"Failed to fetch {doc_type}: {e}")
                continue

        return documents

    def verify_pan(self, pan_number: str) -> Dict[str, Any]:
        """
        Verify PAN details through KYC API

        Args:
            pan_number: PAN number to verify

        Returns:
            Dictionary with PAN details from government database

        Raises:
            SandboxAPIException: If verification fails
        """
        url = f"{self.base_url}/kyc/pan/verify"
        headers = self._get_headers()

        payload = {
            "pan": pan_number
        }

        try:
            logger.info(f"Verifying PAN: {pan_number}")
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()

            data = response.json()
            if data.get("code") != 200:
                raise SandboxAPIException(f"PAN verification failed: {data}")

            logger.info(f"PAN verification successful for: {pan_number}")
            return data.get("data", {})

        except requests.exceptions.RequestException as e:
            logger.error(f"PAN verification request failed: {e}")
            raise SandboxAPIException(f"Failed to verify PAN: {e}")

    def get_user_profile(
        self,
        session_id: str,
        user_id: str,
        doc_types: Optional[List[str]] = None
    ) -> UserProfile:
        """
        Get comprehensive user profile by aggregating data from multiple sources

        Args:
            session_id: DigiLocker session ID
            user_id: Unique identifier for the user
            doc_types: Document types to fetch (default: all)

        Returns:
            UserProfile with aggregated data from DigiLocker and KYC
        """
        profile = UserProfile(
            user_id=user_id,
            documents={},
            additional_metadata={
                "fetch_timestamp": datetime.now().isoformat(),
                "session_id": session_id
            }
        )

        # Fetch all available documents
        try:
            documents = self.fetch_all_documents(session_id, doc_types)
            profile.documents = documents

            # Extract and verify PAN if available
            if "pan" in documents:
                # In a real scenario, extract PAN number from document
                # For now, store the document reference
                logger.info("PAN document available in profile")

            logger.info(f"User profile assembled for user_id: {user_id}")

        except Exception as e:
            logger.error(f"Error assembling user profile: {e}")

        return profile

    def download_document(self, file_url: str, save_path: str) -> bool:
        """
        Download a document file from the provided URL

        Args:
            file_url: URL of the document to download
            save_path: Local path to save the file

        Returns:
            True if download successful, False otherwise
        """
        try:
            logger.info(f"Downloading document from {file_url}")
            response = requests.get(file_url)
            response.raise_for_status()

            with open(save_path, 'wb') as f:
                f.write(response.content)

            logger.info(f"Document saved to {save_path}")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to download document: {e}")
            return False


def initialize_service() -> DigiLockerService:
    """
    Initialize DigiLocker service from environment variables

    Returns:
        Configured DigiLockerService instance

    Raises:
        ValueError: If required environment variables are missing
    """
    api_key = os.getenv("SANDBOX_API_KEY")
    api_secret = os.getenv("SANDBOX_API_SECRET")

    if not api_key or not api_secret:
        raise ValueError(
            "SANDBOX_API_KEY and SANDBOX_API_SECRET must be set in environment"
        )

    return DigiLockerService(api_key, api_secret, use_test=False)


def main():
    """Main execution for running service directly"""
    from dotenv import load_dotenv

    load_dotenv()

    try:
        print("🚀 Initializing DigiLocker Service...")
        service = initialize_service()

        print("✓ Service initialized successfully")
        print("\n📋 Available Operations:")
        print("  1. authenticate() - Get access token")
        print("  2. initiate_digilocker_session() - Start user consent flow")
        print("  3. fetch_document(session_id, doc_type) - Get document")
        print("  4. fetch_all_documents(session_id) - Get all documents")
        print("  5. verify_pan(pan_number) - Verify PAN")
        print("  6. get_user_profile(session_id, user_id) - Aggregate user data")
        print("  7. download_document(file_url, save_path) - Download file")

        print("\n🔑 Testing authentication...")
        token = service.authenticate()
        print(f"✓ Authentication successful")

        return service

    except ValueError as e:
        print(f"❌ Configuration Error: {e}")
        print("\nMake sure to set in .env file:")
        print("  SANDBOX_API_KEY=your_api_key")
        print("  SANDBOX_API_SECRET=your_api_secret")
        return None
    except SandboxAPIException as e:
        print(f"❌ API Error: {e}")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    service = main()
