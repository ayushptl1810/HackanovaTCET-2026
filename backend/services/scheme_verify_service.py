"""
Live scheme verification — cross-checks a single scheme's document/eligibility
requirements against its official myScheme.gov.in page at the moment a citizen
opens the Apply-Agent, instead of trusting only the offline-scraped cache.

myScheme.gov.in is a client-rendered Next.js SPA: a plain HTTP GET returns an
empty shell (content is fetched by client JS against an authenticated internal
API we don't have credentials for), so a real page render is required. We
reuse this project's existing Selenium pipeline (see ``scraper_service.py``)
but keep ONE headless browser alive across requests instead of launching one
per call — a fresh launch costs ~20s (driver install + browser start), which
is fine to pay once per server lifetime but not on every citizen's click.

This runs on a citizen's request path, so it must fail safe: any timeout,
missing/blocked page, or unparseable content returns ``verified: False`` with
a reason, and the caller (the Apply-Agent) falls back to its offline/heuristic
document checklist rather than blocking or erroring out.
"""

import logging
import threading
import time
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from services.extractor import extract_scheme_fields

logger = logging.getLogger(__name__)

_TRUSTED_HOST = "myscheme.gov.in"
_PAGE_LOAD_TIMEOUT = 15   # seconds — hard cap on a single page render
_WAIT_TIMEOUT = 10        # seconds — waiting for the scheme content to hydrate
_CACHE_TTL = 12 * 3600    # 12h; scheme requirements rarely change intraday

_browser_lock = threading.Lock()   # serializes navigations on the shared driver
_cache_lock = threading.Lock()
_cache: Dict[str, Dict[str, Any]] = {}  # scheme_id -> {_ts, result}
_driver = None  # lazily-launched, reused headless Chrome (see _get_driver)


def _is_trusted(url: str) -> bool:
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return False
    return host == _TRUSTED_HOST or host.endswith("." + _TRUSTED_HOST)


def _get_driver():
    """Return the shared headless Chrome instance, launching it on first use."""
    global _driver
    if _driver is not None:
        return _driver
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from webdriver_manager.chrome import ChromeDriverManager

    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1280,1600")
    opts.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=opts)
    driver.set_page_load_timeout(_PAGE_LOAD_TIMEOUT)
    _driver = driver
    logger.info("Live verify: headless browser launched")
    return _driver


def _kill_driver():
    """Drop the current driver so the next call relaunches a fresh one."""
    global _driver
    try:
        if _driver:
            _driver.quit()
    except Exception:
        pass
    _driver = None


def _fetch_page_text(url: str) -> Optional[str]:
    """Render the scheme page and return its visible body text (rendered
    Next.js content — a raw ``requests.get`` returns an empty shell here)."""
    from selenium.common.exceptions import TimeoutException, WebDriverException
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    with _browser_lock:
        try:
            driver = _get_driver()
            driver.get(url)
            WebDriverWait(driver, _WAIT_TIMEOUT).until(
                EC.presence_of_element_located((By.TAG_NAME, "h1"))
            )
            text = driver.find_element(By.TAG_NAME, "body").text
            return text[:4000] if text else None
        except TimeoutException:
            logger.info("Live verify: page did not hydrate in time for %s", url)
            return None
        except WebDriverException as exc:
            logger.info("Live verify: browser error for %s: %s — relaunching next time", url, exc)
            _kill_driver()
            return None
        except Exception as exc:
            logger.info("Live verify: unexpected error for %s: %s", url, exc)
            return None


def verify_scheme_live(scheme_id: str, name: str, official_portal_url: str) -> Dict[str, Any]:
    """
    Cross-verify a scheme's requirements against its live myScheme.gov.in page.

    Returns a dict that is always safe to render, even on failure:
      {verified, source_url, documents_required, eligibility_summary,
       application_process, fetched_at, cached, reason}
    ``verified`` is False (with ``reason``) when the scheme has no myScheme
    URL, the render failed/timed out, or the page couldn't be parsed into
    anything useful — callers fall back to their offline/heuristic checklist.

    Runs synchronously and can take several seconds (a real page render), so
    callers on an async request path should invoke this off the event loop
    (e.g. Starlette's ``run_in_threadpool``).
    """
    now = time.time()
    with _cache_lock:
        cached = _cache.get(scheme_id)
        if cached and (now - cached["_ts"]) < _CACHE_TTL:
            return {**cached["result"], "cached": True}

    def _fail(reason: str) -> Dict[str, Any]:
        return {
            "verified": False,
            "reason": reason,
            "source_url": official_portal_url or "",
            "documents_required": [],
            "eligibility_summary": "",
            "application_process": [],
            "fetched_at": None,
            "cached": False,
        }

    if not official_portal_url or not _is_trusted(official_portal_url):
        return _fail("not_myscheme_url")

    text = _fetch_page_text(official_portal_url)
    if not text:
        return _fail("fetch_failed")

    extracted = extract_scheme_fields(text, name=name)
    if not extracted or not extracted.get("documents_required"):
        return _fail("extraction_failed")

    fetched_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
    result = {
        "verified": True,
        "reason": None,
        "source_url": official_portal_url,
        "documents_required": extracted["documents_required"],
        "eligibility_summary": (extracted.get("benefits") or {}).get("description", "")[:280],
        "application_process": extracted.get("application_process", [])[:8],
        "fetched_at": fetched_at,
        "cached": False,
    }
    with _cache_lock:
        _cache[scheme_id] = {"_ts": now, "result": result}
    return result
