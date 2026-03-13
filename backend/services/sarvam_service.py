import base64
import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)


class SarvamTTSService:
    """Thin wrapper for Sarvam AI Text-to-Speech API."""

    def __init__(self) -> None:
        self.api_key = os.getenv("SARVAM_API_KEY")
        # Keep this configurable because API paths can change across plans/versions.
        self.tts_url = os.getenv("SARVAM_TTS_URL", "https://api.sarvam.ai/text-to-speech")

    def generate_tts_audio(self, text: str, language: str) -> Optional[bytes]:
        """
        Generate audio bytes from text using Sarvam AI TTS.

        Returns None if generation fails, so callers can gracefully fallback to Twilio.
        """
        if not text:
            return None

        if not self.api_key:
            logger.warning("SARVAM_API_KEY not found; skipping Sarvam TTS generation")
            return None

        payload = {
            "text": text,
            "target_language_code": language,
            "speaker": os.getenv("SARVAM_TTS_SPEAKER", "shubh"),
            "model": "bulbul:v3",
            "pace": 1.0,
            "output_audio_codec": "mp3",
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "api-subscription-key": self.api_key,
            "x-api-key": self.api_key,
        }

        try:
            response = requests.post(self.tts_url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()

            content_type = response.headers.get("Content-Type", "")
            if "audio" in content_type:
                return response.content

            # Handle JSON response with audios array (official format)
            data = response.json()

            # Official format: {"request_id": "...", "audios": ["base64_audio"]}
            audios = data.get("audios", [])

            if audios and isinstance(audios, list) and len(audios) > 0:
                audio_b64 = audios[0]
                if isinstance(audio_b64, str) and audio_b64.strip():
                    try:
                        return base64.b64decode(audio_b64)
                    except Exception as e:
                        logger.error("Failed to decode base64 audio: %s", e)
                        return None

            # Fallback for legacy response formats
            possible_fields = [
                data.get("audio"),
                data.get("audio_base64"),
                (data.get("data") or {}).get("audio"),
                (data.get("data") or {}).get("audio_base64"),
            ]

            for maybe_audio in possible_fields:
                if isinstance(maybe_audio, str) and maybe_audio.strip():
                    try:
                        return base64.b64decode(maybe_audio)
                    except Exception as e:
                        logger.error("Failed to decode base64 audio: %s", e)
                        continue

            logger.error("Sarvam TTS response did not contain audio payload")
            return None

        except Exception as exc:
            logger.exception("Sarvam TTS generation failed: %s", exc)
            return None
