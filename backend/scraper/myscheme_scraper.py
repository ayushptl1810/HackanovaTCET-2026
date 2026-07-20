import requests
import json
import re
import os
import sys
import random
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup

# Add parent directory to path to import backend services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.extractor import enrich_scheme

_OUT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'schemes_database.json')
_progress_lock = threading.Lock()
_progress = {"done": 0, "ok": 0}


def _fetch_scheme(url: str):
    html = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=20).text
    soup = BeautifulSoup(html, 'html.parser')

    title_el = soup.find('h1')
    title = title_el.text.strip() if title_el else url.split('/')[-1].replace('-', ' ').title()

    main_content = soup.find('main')
    raw_text = main_content.get_text(separator=' ', strip=True) if main_content else soup.get_text(separator=' ', strip=True)

    scheme_id = url.split('/')[-1]
    scheme_dict = {
        "scheme_id": scheme_id,
        "name": title,
        "level": "Central",
        "official_portal_url": url,
    }
    enriched = enrich_scheme(scheme_dict, raw_text=raw_text[:4000])  # cap length to save tokens
    return enriched


def scrape_myscheme(limit=400, workers=6, checkpoint_every=25):
    print("Fetching sitemap...")
    try:
        sitemap = requests.get('https://www.myscheme.gov.in/sitemap.xml', timeout=15).text
    except Exception as e:
        print(f"Failed to fetch sitemap: {e}")
        return

    urls = re.findall(r'<loc>(https://www.myscheme.gov.in/schemes/[^<]+)</loc>', sitemap)
    urls = list(set([u for u in urls if '/schemes/' in u]))
    print(f"Found {len(urls)} scheme URLs in sitemap.")

    random.seed(42)  # deterministic but shuffled sample -> broader category/state spread than alphabetical
    random.shuffle(urls)
    targets = urls[:limit]
    print(f"Scraping {len(targets)} schemes with {workers} workers...")

    scraped_schemes = []

    def _save():
        with open(_OUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(scraped_schemes, f, indent=2, ensure_ascii=False)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(_fetch_scheme, url): url for url in targets}
        for fut in as_completed(futures):
            url = futures[fut]
            with _progress_lock:
                _progress["done"] += 1
                n = _progress["done"]
            try:
                scheme = fut.result()
                scraped_schemes.append(scheme)
                with _progress_lock:
                    _progress["ok"] += 1
                print(f"[{n}/{len(targets)}] OK: {scheme.get('name', url)}")
            except Exception as e:
                print(f"[{n}/{len(targets)}] FAILED {url}: {e}")

            if n % checkpoint_every == 0:
                _save()
                print(f"  -> checkpoint saved ({len(scraped_schemes)} schemes so far)")

    _save()
    print(f"Saved {len(scraped_schemes)} schemes to {_OUT_PATH}")


if __name__ == "__main__":
    lim = int(sys.argv[1]) if len(sys.argv) > 1 else 400
    scrape_myscheme(limit=lim)
