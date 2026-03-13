"""Fuzzy scheme matching service."""

from typing import Dict, List


class SchemeMatchingService:
    """Matches government schemes to user profiles using fuzzy matching."""

    @staticmethod
    def get_matched_schemes(mobile_number: str, language_code: str = "en-IN") -> List[Dict[str, str]]:
        """
        Get schemes matched to user profile based on mobile number and language.

        Args:
            mobile_number: User's phone number
            language_code: Language code (e.g., "en-IN", "hi-IN")

        Returns:
            List of matching schemes with name and source
        """
        # TODO: Implement fuzzy matching once user profile database is available
        # Current behavior: returns empty list and keeps integration contract stable
        return []
