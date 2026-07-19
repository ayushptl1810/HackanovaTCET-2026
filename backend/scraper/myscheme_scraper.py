import requests
import json
import re
import os
import sys
from bs4 import BeautifulSoup
from urllib.parse import urlparse

# Add parent directory to path to import backend services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.extractor import enrich_scheme

def scrape_myscheme(limit=50):
    print("Fetching sitemap...")
    try:
        sitemap = requests.get('https://www.myscheme.gov.in/sitemap.xml', timeout=15).text
    except Exception as e:
        print(f"Failed to fetch sitemap: {e}")
        return

    # Extract all scheme URLs
    urls = re.findall(r'<loc>(https://www.myscheme.gov.in/schemes/[^<]+)</loc>', sitemap)
    # Remove duplicates and filter
    urls = list(set([u for u in urls if '/schemes/' in u]))
    print(f"Found {len(urls)} scheme URLs in sitemap.")
    
    print(f"Scraping the first {limit} schemes...")
    
    scraped_schemes = []
    
    for url in urls[:limit]:
        print(f"Scraping {url}...")
        try:
            html = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15).text
            soup = BeautifulSoup(html, 'html.parser')
            
            # Try to find the title
            title_el = soup.find('h1')
            title = title_el.text.strip() if title_el else url.split('/')[-1].replace('-', ' ').title()
            
            # Extract text content from main elements to feed to LLM
            main_content = soup.find('main')
            raw_text = main_content.get_text(separator=' ', strip=True) if main_content else soup.get_text(separator=' ', strip=True)
            
            scheme_id = url.split('/')[-1]
            
            # Base scheme dict
            scheme_dict = {
                "scheme_id": scheme_id,
                "name": title,
                "level": "Central",
                "official_portal_url": url,
            }
            
            # Enrich using the existing LLM extractor agent
            print(f"  -> Passing to LLM extractor for eligibility parsing...")
            enriched = enrich_scheme(scheme_dict, raw_text=raw_text[:4000]) # cap length to save tokens
            scraped_schemes.append(enriched)
            print(f"  -> Successfully extracted rules for {title}")
            
        except Exception as e:
            print(f"  -> Failed to scrape {url}: {e}")
            
    # Save to database
    out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'schemes_database.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(scraped_schemes, f, indent=2, ensure_ascii=False)
        
    print(f"Saved {len(scraped_schemes)} schemes to {out_path}")

if __name__ == "__main__":
    scrape_myscheme()
