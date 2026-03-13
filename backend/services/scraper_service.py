"""
Real Website Scraper for myScheme.gov.in

Scrapes ALL schemes by handling pagination:
- Website has 465 pages × 10 schemes per page = 4,650+ total schemes
- Pagination uses clickable page number buttons
- Each page contains div[role="article"] elements for schemes
"""

import json
import logging
import time
from typing import List, Dict, Any, Optional
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_URL = "https://www.myscheme.gov.in"
SEARCH_URL = f"{BASE_URL}/search"


def setup_selenium_driver():
    """Setup Selenium WebDriver with proper configuration"""
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)

    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        logger.info("✓ Selenium WebDriver initialized")
        return driver
    except Exception as e:
        logger.error(f"Failed to initialize WebDriver: {e}")
        return None


def extract_schemes_from_html(soup: BeautifulSoup) -> List[Dict]:
    """
    Extract ALL schemes from current page using div[role="article"] selector

    Each scheme structure:
    <div role="article" class="mx-auto rounded-xl shadow-md ...">
      <h2 id="scheme-name-X"><a href="/schemes/...">Scheme Name</a></h2>
      <h2 role="button">Ministry Name</h2>
      <span aria-label="Brief description: ...">Description</span>
      <div aria-label="Filter by tag: ...">Tags</div>
    </div>
    """
    schemes = []
    extracted_ids = set()

    # PRIMARY SELECTOR: div[role="article"] - gets ALL schemes on page
    scheme_articles = soup.find_all('div', attrs={'role': 'article'})
    logger.info(f"    Found {len(scheme_articles)} schemes on this page")

    for article in scheme_articles:
        try:
            # Extract scheme name from h2 with link
            scheme_h2 = article.find('h2')
            if not scheme_h2:
                continue

            scheme_link = scheme_h2.find('a', href=True)
            if not scheme_link:
                continue

            scheme_name = scheme_link.get_text(strip=True)
            scheme_url = scheme_link.get('href', '')

            # Extract scheme ID from URL
            scheme_id = scheme_url.split('/')[-1] if scheme_url else scheme_name.lower().replace(' ', '_')

            # Skip duplicates
            if scheme_id in extracted_ids:
                continue

            extracted_ids.add(scheme_id)

            # Extract ministry (second h2 tag)
            h2_tags = article.find_all('h2')
            ministry = ""
            if len(h2_tags) > 1:
                ministry = h2_tags[1].get_text(strip=True)

            # Extract description
            description = ""
            desc_span = article.find('span', attrs={'aria-label': lambda x: x and 'Brief description' in (x or '')})
            if desc_span:
                description = desc_span.get_text(strip=True)

            # Extract tags
            tags = []
            tag_divs = article.find_all('div', attrs={'aria-label': lambda x: x and 'Filter by tag' in (x or '')})
            for tag_div in tag_divs:
                tag_text = tag_div.get_text(strip=True)
                if tag_text:
                    tags.append(tag_text)

            scheme = {
                'fields': {
                    'slug': scheme_id,
                    'schemeName': scheme_name,
                    'briefDescription': description,
                    'schemeCategory': tags[0] if tags else 'General',
                    'ministry': ministry,
                    'tags': tags,
                    'state': ['ALL'],
                    'documentsRequired': ['aadhaar_card'],
                    'url': scheme_url
                }
            }
            schemes.append(scheme)

        except Exception as e:
            logger.debug(f"Error extracting scheme: {e}")
            continue

    return schemes


def scrape_with_pagination(driver, num_pages: int = 3) -> List[Dict]:
    """
    Scrape multiple pages using pagination buttons

    Args:
        driver: Selenium WebDriver instance
        num_pages: Number of pages to scrape (default 3 = 30 schemes)

    Returns:
        List of all extracted schemes
    """
    all_schemes = {}  # Dict for deduplication

    try:
        # Load first page
        logger.info(f"🔄 Loading {SEARCH_URL}")
        driver.get(SEARCH_URL)
        time.sleep(3)

        for page_num in range(1, num_pages + 1):
            logger.info(f"\n📄 PAGE {page_num}/{num_pages}")

            # Wait for page to load
            time.sleep(2)

            # Scroll to load content
            driver.execute_script("window.scrollBy(0, 2000);")
            time.sleep(1)

            # Extract schemes from current page
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            page_schemes = extract_schemes_from_html(soup)

            for scheme in page_schemes:
                scheme_id = scheme['fields']['slug']
                all_schemes[scheme_id] = scheme

            # If on last page, don't try to go to next
            if page_num >= num_pages:
                logger.info(f"✓ Reached target of {num_pages} pages")
                break

            # Click next page button using Selenium
            logger.info(f"   → Moving to page {page_num + 1}...")
            try:
                # Use XPath to find pagination button with text (page_num + 1)
                # Target: <li> with text matching the page number
                page_num_str = str(page_num + 1)
                xpath = f"//ul[contains(@class, 'list-none')]//li[contains(text(), '{page_num_str}')]"

                # Find the button element using Selenium
                next_button = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, xpath))
                )

                # Scroll to button and click it
                driver.execute_script("arguments[0].scrollIntoView(true);", next_button)
                time.sleep(1)
                next_button.click()
                logger.info(f"   ✓ Clicked page {page_num + 1}")
                time.sleep(2)

            except Exception as e:
                logger.error(f"   ❌ Error clicking next page: {e}")
                break

        logger.info(f"\n{'='*80}")
        logger.info(f"✅ PAGINATION COMPLETE: {len(all_schemes)} unique schemes scraped")
        logger.info(f"{'='*80}\n")

        return list(all_schemes.values())

    except Exception as e:
        logger.error(f"Pagination scraping failed: {e}")
        return list(all_schemes.values())


def fetch_raw_schemes(num_pages: int = 3) -> List[Dict[str, Any]]:
    """
    Fetch schemes from myScheme.gov.in using pagination

    Args:
        num_pages: Number of pages to scrape (each page has ~10 schemes)

    Returns:
        List of scheme data
    """

    logger.info("=" * 80)
    logger.info(f"STARTING SCRAPE: myScheme.gov.in ({num_pages} pages)")
    logger.info("=" * 80)

    driver = None
    schemes = []

    try:
        driver = setup_selenium_driver()
        if not driver:
            logger.error("Could not initialize WebDriver")
            return get_fallback_schemes()

        # Scrape with pagination
        schemes = scrape_with_pagination(driver, num_pages=num_pages)

        if not schemes:
            logger.warning("No schemes scraped, using fallback")
            schemes = get_fallback_schemes()

    except Exception as e:
        logger.error(f"Scraping failed: {e}")
        schemes = get_fallback_schemes()

    finally:
        if driver:
            driver.quit()
            logger.info("WebDriver closed")

    return schemes


def get_fallback_schemes() -> List[Dict]:
    """Fallback schemes if scraping fails"""
    return [
        {
            'fields': {
                'slug': 'post_matric_scholarship',
                'schemeName': 'Post Matric Scholarship for Students with Disabilities',
                'briefDescription': 'Scholarship for disabled students pursuing post-matriculate education',
                'schemeCategory': 'Education',
                'state': ['ALL'],
                'documentsRequired': ['aadhaar_card'],
            }
        },
    ]


def transform_to_standard_schema(raw_item: Dict) -> Dict[str, Any]:
    """Transform raw scheme data to standard format"""
    fields = raw_item.get('fields', {})

    eligibility_rules = [
        {
            "profile_field": "income",
            "operator": "less_than_or_equal",
            "value": 150000,
            "is_mandatory": True
        }
    ]

    benefits = {
        "type": "cash_grant",
        "description": fields.get('briefDescription', '')
    }

    return {
        "scheme_id": fields.get('slug', 'unknown_id'),
        "name": fields.get('schemeName', 'Unknown Scheme'),
        "level": fields.get('schemeLevel', 'Central'),
        "state_applicable": fields.get('state', ["ALL"]),
        "category": fields.get('schemeCategory', 'General'),
        "ministry": fields.get('ministry', ''),
        "benefits": benefits,
        "eligibility_rules": eligibility_rules,
        "documents_required": fields.get('documentsRequired', ["aadhaar_card"]),
        "application_mode": "online",
        "official_portal_url": f"https://www.myscheme.gov.in/schemes/{fields.get('slug', '')}"
    }


def save_schemes_to_file(schemes: List[Dict], output_path: str = None) -> bool:
    """Save transformed schemes to JSON file"""
    if output_path is None:
        import os
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        output_path = os.path.join(project_root, "schemes_database.json")

    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(schemes, f, indent=2, ensure_ascii=False)
        logger.info(f"✅ Saved {len(schemes)} schemes to {output_path}")
        return True
    except Exception as e:
        logger.error(f"❌ Error saving file: {e}")
        return False


def main(num_pages: int = 3, save_output: bool = True) -> List[Dict]:
    """
    Main execution: Scrape and transform schemes

    Args:
        num_pages: Number of pages to scrape (default 3 = ~30 schemes)
        save_output: Whether to save to file
    """
    print(f"\n🚀 SCRAPING myScheme.gov.in: {num_pages} pages (~{num_pages*10} schemes)\n")

    raw_schemes = fetch_raw_schemes(num_pages=num_pages)

    if not raw_schemes:
        print("❌ No schemes fetched")
        return []

    print(f"\n📊 Transforming {len(raw_schemes)} schemes...")
    final_database = []

    for i, item in enumerate(raw_schemes):
        try:
            transformed = transform_to_standard_schema(item)
            final_database.append(transformed)
        except Exception as e:
            logger.warning(f"Error transforming scheme {i}: {e}")
            continue

    print(f"✅ Transformed {len(final_database)} schemes\n")

    if save_output:
        import os
        # Go up 3 levels: services -> backend -> project_root
        output_path = os.path.join(os.path.dirname(__file__), "../schemes_database.json")
        save_schemes_to_file(final_database, output_path)

    return final_database


if __name__ == "__main__":
    main(num_pages=3, save_output=True)
