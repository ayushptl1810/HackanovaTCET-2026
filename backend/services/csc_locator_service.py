import logging
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
    """
    Best-effort HTML parsing because portal markup may change.
    Returns at most 3 centers.
    """
    candidates = []

    # Most locator pages expose result cards in table rows/div cards.
    # We parse broad patterns and keep useful text lines.
    rows = soup.select("table tbody tr")
    if rows:
        for row in rows[:3]:
            cols = [c.get_text(" ", strip=True) for c in row.find_all("td")]
            if not cols:
                continue
            candidates.append(
                {
                    "name": cols[0] if len(cols) > 0 else "N/A",
                    "address": cols[1] if len(cols) > 1 else "N/A",
                    "contact": cols[2] if len(cols) > 2 else "N/A",
                    "distance": cols[3] if len(cols) > 3 else "N/A",
                }
            )

    if candidates:
        return candidates

    cards = soup.select(".card, .result-card, .csc-card, [class*='result']")
    for card in cards[:3]:
        text = [line.strip() for line in card.get_text("\n").split("\n") if line.strip()]
        if not text:
            continue
        candidates.append(
            {
                "name": text[0] if len(text) > 0 else "N/A",
                "address": text[1] if len(text) > 1 else "N/A",
                "contact": text[2] if len(text) > 2 else "N/A",
                "distance": text[3] if len(text) > 3 else "N/A",
            }
        )

    return candidates


def get_csc_by_pincode(pincode: str) -> List[Dict[str, str]]:
    """Scrape CSC locator by pin code and return up to 3 nearby centers."""
    driver = None
    try:
        driver = _setup_driver()
        driver.get(CSC_LOCATOR_URL)

        wait = WebDriverWait(driver, 20)

        # Try common pin code input selectors
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

        soup = BeautifulSoup(driver.page_source, "html.parser")
        return _best_effort_extract(soup)

    except Exception as exc:
        logger.exception("CSC locator scraping failed: %s", exc)
        return []
    finally:
        if driver:
            driver.quit()
