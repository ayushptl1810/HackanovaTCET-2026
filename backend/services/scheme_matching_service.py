"""Fuzzy scheme matching service.

Bridges the voice/dashboard flows to the slab-based eligibility engine
(``services.fuzzy_match``) using the persisted citizen profile
(``services.auth_service``).
"""

import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


class SchemeMatchingService:
    """Matches government schemes to registered user profiles."""

    @staticmethod
    def get_matched_schemes(mobile_number: str, language_code: str = "en-IN") -> List[Dict[str, str]]:
        """
        Get schemes matched to a registered citizen's stored slab profile.

        Args:
            mobile_number: User's phone number (used to look up the profile).
            language_code: Language code (e.g., "en-IN", "hi-IN"). Currently
                unused for scoring; kept for interface stability.

        Returns:
            List of matching schemes as ``{"name": ..., "source": ...}`` dicts,
            or an empty list if the profile is unknown or matching fails.
        """
        try:
            from services.auth_service import get_profile_slabs
            from services.fuzzy_match import get_top_schemes

            slabs = get_profile_slabs(mobile_number)
            if not slabs:
                logger.info("No stored profile for caller; cannot fuzzy-match")
                return []

            results = get_top_schemes(slabs, limit=3)
            return [
                {"name": r.name, "source": "myScheme", "scheme_id": r.scheme_id}
                for r in results
            ]
        except Exception as exc:
            logger.exception("Fuzzy scheme matching failed: %s", exc)
            return []
