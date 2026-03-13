import logging
import time
from typing import Dict, List

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
CSC_CACHE = {}  # {pincode: (results, timestamp)}
CSC_CACHE_TTL = 3600  # Cache for 1 hour


def _setup_driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    logger.info("WebDriver initialized successfully")
    return driver


def _best_effort_extract(soup: BeautifulSoup) -> List[Dict[str, str]]:
    """
    Best-effort HTML parsing because portal markup may change.
    Returns at most 3 centers.
    """
    candidates = []

    # Most locator pages expose result cards in table rows/div cards.
    # We parse broad patterns and keep useful text lines.
    rows = soup.select("table tbody tr")
    logger.info(f"🔍 Found {len(rows)} table rows")
    if rows:
        for i, row in enumerate(rows[:3]):
            cols = [c.get_text(" ", strip=True) for c in row.find_all("td")]
            logger.info(f"  Row {i}: {len(cols)} columns: {cols}")
            if not cols:
                continue
            # CSC table structure: [0]=ID, [1]=Name, [2]=State, [3]=District, [4]=Region, [5]=Lat, [6]=Lng, [7]=Address, [8]=Pincode, [9]=Owner, [10]=Date
            center = {
                "name": cols[1] if len(cols) > 1 else "N/A",  # Owner/Center name
                "address": cols[7] if len(cols) > 7 else "N/A",  # Full address
                "contact": cols[9] if len(cols) > 9 else "N/A",  # Contact name or phone
                "distance": f"{cols[3]} District" if len(cols) > 3 else "N/A",  # District as distance proxy
            }
            logger.info(f"  Parsed center: {center}")
            candidates.append(center)

    if candidates:
        logger.info(f"✅ Extracted {len(candidates)} centers from table")
        return candidates

    logger.info("⚠️ No table found, trying card-based extraction...")
    cards = soup.select(".card, .result-card, .csc-card, [class*='result']")
    logger.info(f"🔍 Found {len(cards)} result cards")
    for i, card in enumerate(cards[:3]):
        text = [line.strip() for line in card.get_text("\n").split("\n") if line.strip()]
        logger.info(f"  Card {i}: {len(text)} lines: {text}")
        if not text:
            continue
        center = {
            "name": text[0] if len(text) > 0 else "N/A",
            "address": text[1] if len(text) > 1 else "N/A",
            "contact": text[2] if len(text) > 2 else "N/A",
            "distance": text[3] if len(text) > 3 else "N/A",
        }
        logger.info(f"  Parsed center: {center}")
        candidates.append(center)

    logger.info(f"✅ Extracted {len(candidates)} centers total")
    return candidates


def get_csc_by_pincode(pincode: str) -> List[Dict[str, str]]:
    """Scrape CSC locator by pin code and return up to 3 nearby centers."""
    # Check cache first
    if pincode in CSC_CACHE:
        results, timestamp = CSC_CACHE[pincode]
        if time.time() - timestamp < CSC_CACHE_TTL:
            logger.info(f"💾 Returning cached results for pincode {pincode}")
            return results
        else:
            del CSC_CACHE[pincode]  # Expired, remove from cache

    driver = None
    try:
        driver = _setup_driver()
        driver.get(CSC_LOCATOR_URL)

        wait = WebDriverWait(driver, 10)  # Reduced from 20s to fit within Twilio's 15s timeout

        # Try pin code input selectors - FIXED: correct case-sensitive selectors
        pin_input = None
        for selector in [
            "input#PinCode",                    # Exact ID match (was missing)
            "input[name='PinCode']",            # Exact name match (case-correct)
            "input[placeholder*='PIN']",       # Placeholder contains PIN
            "input[placeholder*='Pin']",       # Placeholder contains Pin
            "input[type='text']",              # Generic text input
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

        # Use JavaScript to set value (avoids interactability issues)
        driver.execute_script("arguments[0].value = arguments[1];", pin_input, pincode)
        driver.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", pin_input)

        # Click any likely search button
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

        # Wait for at least something to render after search.
        wait.until(
            EC.any_of(
                EC.presence_of_element_located((By.CSS_SELECTOR, "table tbody tr")),
                EC.presence_of_element_located((By.CSS_SELECTOR, ".card, .result-card, .csc-card")),
            )
        )

        logger.info("✅ Results page loaded, parsing HTML...")
        soup = BeautifulSoup(driver.page_source, "html.parser")
        results = _best_effort_extract(soup)
        logger.info(f"📋 Final results: {results}")

        # Cache the results
        CSC_CACHE[pincode] = (results, time.time())
        logger.info(f"💾 Cached results for pincode {pincode} (TTL: {CSC_CACHE_TTL}s)")
        return results

    except Exception as exc:
        logger.exception("CSC locator scraping failed: %s", exc)
        return []
    finally:
        if driver:
            driver.quit()
