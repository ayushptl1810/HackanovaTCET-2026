"""
CSC Locator – find nearest Common Service Centres by pincode.

Strategy:
  1. Check Redis cache (key: csc:{pincode}, TTL: 7 days)
  2. If miss → scrape locator.csccloud.in via Selenium
  3. Cache result in Redis for next time

The Selenium scrape is SLOW (10-30s).  Never call this synchronously
inside a Twilio/Exotel webhook — always cache first.
"""

import json
import logging
import os
from typing import Dict, List, Optional

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

logger = logging.getLogger(__name__)

CSC_LOCATOR_URL = "https://locator.csccloud.in/"
CACHE_TTL = 7 * 86400  # 7 days in seconds


# ---------------------------------------------------------------------------
# Redis helpers
# ---------------------------------------------------------------------------

def _get_redis():
    """Return a Redis client or None if unavailable."""
    try:
        import redis
        return redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            decode_responses=True,
        )
    except Exception:
        return None


def _cache_get(pincode: str) -> Optional[List[Dict[str, str]]]:
    r = _get_redis()
    if r is None:
        return None
    try:
        cached = r.get(f"csc:{pincode}")
        if cached:
            logger.info("CSC cache HIT for pincode %s", pincode)
            return json.loads(cached)
    except Exception as exc:
        logger.debug("Redis cache read failed: %s", exc)
    return None


def _cache_set(pincode: str, centers: List[Dict[str, str]]) -> None:
    r = _get_redis()
    if r is None:
        return
    try:
        r.setex(f"csc:{pincode}", CACHE_TTL, json.dumps(centers))
        logger.info("CSC cache SET for pincode %s (TTL %dd)", pincode, CACHE_TTL // 86400)
    except Exception as exc:
        logger.debug("Redis cache write failed: %s", exc)


# ---------------------------------------------------------------------------
# Selenium scraper
# ---------------------------------------------------------------------------

def _setup_driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")

    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)


def _best_effort_extract(soup: BeautifulSoup) -> List[Dict[str, str]]:
    """Best-effort HTML parsing — portal markup may change."""
    candidates = []

    # Table rows
    rows = soup.select("table tbody tr")
    if rows:
        for row in rows[:3]:
            cols = [c.get_text(" ", strip=True) for c in row.find_all("td")]
            if not cols:
                continue
            candidates.append({
                "name":     cols[0] if len(cols) > 0 else "N/A",
                "address":  cols[1] if len(cols) > 1 else "N/A",
                "contact":  cols[2] if len(cols) > 2 else "N/A",
                "distance": cols[3] if len(cols) > 3 else "N/A",
            })

    if candidates:
        return candidates

    # Div cards fallback
    cards = soup.select(".card, .result-card, .csc-card, [class*='result']")
    for card in cards[:3]:
        text = [line.strip() for line in card.get_text("\n").split("\n") if line.strip()]
        if not text:
            continue
        candidates.append({
            "name":     text[0] if len(text) > 0 else "N/A",
            "address":  text[1] if len(text) > 1 else "N/A",
            "contact":  text[2] if len(text) > 2 else "N/A",
            "distance": text[3] if len(text) > 3 else "N/A",
        })

    return candidates


def _scrape_csc(pincode: str) -> List[Dict[str, str]]:
    """Scrape locator.csccloud.in with Selenium. Returns up to 3 centres."""
    driver = None
    try:
        driver = _setup_driver()
        driver.get(CSC_LOCATOR_URL)
        wait = WebDriverWait(driver, 20)

        pin_input = None
        for selector in [
            "input[name='pincode']",
            "input[id*='pin']",
            "input[placeholder*='PIN']",
            "input[placeholder*='Pin']",
            "input[type='text']",
        ]:
            try:
                pin_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
                if pin_input:
                    break
            except TimeoutException:
                continue

        if not pin_input:
            logger.warning("CSC locator: pincode input not found")
            return []

        pin_input.clear()
        pin_input.send_keys(pincode)

        # Click search
        clicked = False
        for selector in [
            "button[type='submit']",
            "button[id*='search']",
            "button[class*='search']",
            "input[type='submit']",
        ]:
            try:
                btn = driver.find_element(By.CSS_SELECTOR, selector)
                btn.click()
                clicked = True
                break
            except Exception:
                continue

        if not clicked:
            pin_input.submit()

        wait.until(EC.any_of(
            EC.presence_of_element_located((By.CSS_SELECTOR, "table tbody tr")),
            EC.presence_of_element_located((By.CSS_SELECTOR, ".card, .result-card, .csc-card")),
        ))

        soup = BeautifulSoup(driver.page_source, "html.parser")
        return _best_effort_extract(soup)

    except Exception as exc:
        logger.exception("CSC locator scraping failed: %s", exc)
        return []
    finally:
        if driver:
            driver.quit()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_csc_by_pincode(pincode: str) -> List[Dict[str, str]]:
    """
    Get up to 3 nearby CSC centres for a pincode.

    Checks Redis cache first. Falls back to Selenium scraping
    and caches the result for 7 days.
    """
    # 1. Check cache
    cached = _cache_get(pincode)
    if cached is not None:
        return cached

    # 2. Scrape (slow — never call inside a webhook with tight timeout)
    centers = _scrape_csc(pincode)

    # 3. Cache for next time
    if centers:
        _cache_set(pincode, centers)

    return centers
