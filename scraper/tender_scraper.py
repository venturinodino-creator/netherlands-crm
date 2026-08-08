"""
tender_scraper.py — Daily scraper for Elsevier-relevant tenders
Sources: TED Europa (EU official journal), TenderNed (Dutch national)
Writes new tenders to data/tenders.json without duplicates.

Run: python scraper/tender_scraper.py
"""

import json
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, date
from pathlib import Path

# ── Config ───────────────────────────────────────────────────────────────────

REPO_ROOT    = Path(__file__).parent.parent
TENDERS_FILE = REPO_ROOT / "data" / "tenders.json"

# Keywords that make a tender Elsevier-relevant
ELSEVIER_PRODUCTS = [
    "ScienceDirect", "Scopus", "SciVal", "Elsevier Pure", "Mendeley",
    "Reaxys", "ClinicalKey", "Embase",
]
COMPETITOR_PRODUCTS = [
    "Web of Science", "InCites", "Journal Citation Reports",
    "Clarivate", "Springer Nature", "Wiley Online", "Taylor & Francis",
    "Vidatum", "Symplectic Elements",
]
CATEGORY_KEYWORDS = [
    "research information system", "CRIS", "current research information",
    "bibliometric", "academic database", "scientific database",
    "scientific literature", "scholarly database", "publication database",
    "library database", "elektronische tijdschriften",      # NL: electronic journals
    "wetenschappelijke databases", "onderzoeksinformatie",  # NL: research information
    "literatuurbestanden",                                   # NL: literature files
]

ALL_KEYWORDS = ELSEVIER_PRODUCTS + COMPETITOR_PRODUCTS + CATEGORY_KEYWORDS

# Status mapping
def guess_status(title: str, notes: str, deadline_str: str) -> str:
    text = (title + " " + notes).lower()
    if any(k.lower() in text for k in COMPETITOR_PRODUCTS):
        return "identified"   # monitoring competitor situation
    if deadline_str:
        try:
            dl = date.fromisoformat(deadline_str)
            if dl > date.today():
                return "identified"   # open tender
        except ValueError:
            pass
    return "identified"

# ── Helpers ──────────────────────────────────────────────────────────────────

def load_tenders() -> list:
    try:
        return json.loads(TENDERS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []

def save_tenders(tenders: list) -> None:
    TENDERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    TENDERS_FILE.write_text(
        json.dumps(tenders, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

def existing_ids(tenders: list) -> set:
    return {t["id"] for t in tenders}

def existing_titles(tenders: list) -> set:
    return {t["title"].lower().strip() for t in tenders}

def is_relevant(title: str, description: str = "") -> tuple[bool, str, str]:
    """Returns (relevant, matched_product, matched_competitor)."""
    text = (title + " " + description).lower()
    product    = next((k for k in ELSEVIER_PRODUCTS    if k.lower() in text), "")
    competitor = next((k for k in COMPETITOR_PRODUCTS  if k.lower() in text), "")
    category   = next((k for k in CATEGORY_KEYWORDS    if k.lower() in text), "")
    if product or competitor or category:
        return True, product or category, competitor
    return False, "", ""

def fetch_json(url: str, data: bytes = None, headers: dict = None) -> dict | None:
    """Simple HTTP GET/POST returning parsed JSON or None on error."""
    req = urllib.request.Request(url, data=data, headers=headers or {})
    req.add_header("Accept", "application/json")
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code} for {url}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  Error fetching {url}: {e}", file=sys.stderr)
        return None

# ── TED Europa scraper ────────────────────────────────────────────────────────

TED_URL = "https://api.ted.europa.eu/v3/notices/search"

def search_ted(query: str, page: int = 1) -> list:
    """Search TED Europa notices. Returns list of raw notice dicts."""
    payload = json.dumps({
        "query": query,
        "onlyLatestVersions": True,
        "scope": "ALL",
        "fields": [
            "notice-number", "title-text", "buyer-name",
            "publication-date", "deadline-receipt-tenders",
            "estimated-value", "contract-nature", "place-of-performance"
        ],
        "page": page,
        "limit": 50
    }).encode()
    result = fetch_json(TED_URL, data=payload)
    if not result:
        return []
    return result.get("notices", [])

def ted_to_tender(notice: dict, product: str, competitor: str) -> dict:
    """Convert a TED notice dict to our tender schema."""
    pub = notice.get("publication-date", "")
    deadline_raw = notice.get("deadline-receipt-tenders", "")
    deadline = deadline_raw[:10] if deadline_raw else ""
    value_raw = notice.get("estimated-value", {})
    value = ""
    if isinstance(value_raw, dict):
        value = str(int(value_raw.get("amount", 0))) if value_raw.get("amount") else ""
    elif isinstance(value_raw, (int, float)):
        value = str(int(value_raw))

    # Title: TED stores as list of lang objects [{lang, value}]
    title_list = notice.get("title-text", [])
    if isinstance(title_list, list) and title_list:
        title = next((t["value"] for t in title_list if t.get("lang") == "ENG"), title_list[0].get("value", ""))
    else:
        title = str(title_list)

    # Buyer
    buyer_list = notice.get("buyer-name", [])
    if isinstance(buyer_list, list) and buyer_list:
        buyer = buyer_list[0].get("value", "")
    else:
        buyer = str(buyer_list)

    notice_num = notice.get("notice-number", "").replace("/", "-")
    tender_id = "ted_" + re.sub(r"[^a-z0-9_]", "_", notice_num.lower())

    return {
        "id": tender_id,
        "title": title,
        "institution": buyer,
        "deadline": deadline,
        "status": "identified",
        "value": value,
        "product": product or "Academic database",
        "competitor": competitor or "—",
        "notes": f"TED Europa notice {notice_num}. Published: {pub[:10] if pub else '—'}.",
        "source": f"TED Europa {notice_num}",
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "updatedAt": datetime.utcnow().isoformat() + "Z",
    }

def scrape_ted(existing: list) -> list:
    """Scrape TED for all relevant keyword groups. Returns new tenders only."""
    ids    = existing_ids(existing)
    titles = existing_titles(existing)
    new    = []
    seen   = set()

    # Search in chunks so we don't blow the query length
    query_groups = [
        " OR ".join(f'"{k}"' for k in ELSEVIER_PRODUCTS),
        " OR ".join(f'"{k}"' for k in COMPETITOR_PRODUCTS),
        " OR ".join(f'"{k}"' for k in CATEGORY_KEYWORDS[:6]),
    ]

    for q in query_groups:
        print(f"  TED query: {q[:80]}...")
        notices = search_ted(q)
        print(f"    → {len(notices)} notices")
        for n in notices:
            rel, product, competitor = is_relevant(
                str(n.get("title-text", "")),
                str(n.get("short-description", ""))
            )
            if not rel:
                continue
            t = ted_to_tender(n, product, competitor)
            if t["id"] in ids or t["id"] in seen:
                continue
            if t["title"].lower().strip() in titles:
                continue
            new.append(t)
            seen.add(t["id"])
        time.sleep(1)   # be polite

    return new

# ── TenderNed scraper (Dutch national) ───────────────────────────────────────

TENDERNED_URL = "https://www.tenderned.nl/aankondigingen/overzicht?search={query}&page=1"

def scrape_tenderned(existing: list) -> list:
    """
    TenderNed has no public JSON API; scrape the search HTML.
    Returns new tenders only.
    """
    ids    = existing_ids(existing)
    titles = existing_titles(existing)
    new    = []
    seen   = set()

    keywords = [
        "ScienceDirect", "Scopus", "Web of Science",
        "CRIS onderzoek", "bibliometrisch", "wetenschappelijke databases",
    ]

    for kw in keywords:
        encoded = urllib.parse.quote(kw)
        url     = f"https://www.tenderned.nl/aankondigingen/overzicht?search={encoded}"
        print(f"  TenderNed: {kw}")
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (research-crm-scraper/1.0)"
        })
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                html = resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            print(f"    Error: {e}", file=sys.stderr)
            continue

        # Extract basic tender blocks from HTML
        # TenderNed renders cards with class-based structure
        blocks = re.findall(
            r'<article[^>]*class="[^"]*tender[^"]*"[^>]*>(.*?)</article>',
            html, re.DOTALL | re.IGNORECASE
        )
        if not blocks:
            # Fallback: look for h2/h3 links that contain the keyword
            links = re.findall(
                r'href="(/aankondigingen/[^"]+)"[^>]*>([^<]{10,120})</a>',
                html, re.IGNORECASE
            )
            for path, title in links:
                if kw.lower() not in title.lower() and kw.lower() not in html[max(0,html.find(title)-200):html.find(title)+200].lower():
                    continue
                t_id = "tn_" + re.sub(r"[^a-z0-9]", "_", path.split("/")[-1].lower())
                if t_id in ids or t_id in seen:
                    continue
                if title.lower().strip() in titles:
                    continue
                _, product, competitor = is_relevant(title)
                t = {
                    "id": t_id,
                    "title": title.strip(),
                    "institution": "",
                    "deadline": "",
                    "status": "identified",
                    "value": "",
                    "product": product or kw,
                    "competitor": competitor or "—",
                    "notes": f"Found via TenderNed search for '{kw}'.",
                    "source": f"TenderNed {path}",
                    "createdAt": datetime.utcnow().isoformat() + "Z",
                    "updatedAt": datetime.utcnow().isoformat() + "Z",
                }
                new.append(t)
                seen.add(t_id)

        time.sleep(0.5)

    return new

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print(f"[tender_scraper] {datetime.now().strftime('%Y-%m-%d %H:%M')} starting...")
    tenders = load_tenders()
    print(f"  Existing tenders: {len(tenders)}")

    new_tenders = []

    # 1. TED Europa
    print("Scraping TED Europa...")
    try:
        ted_new = scrape_ted(tenders)
        print(f"  New from TED: {len(ted_new)}")
        new_tenders.extend(ted_new)
    except Exception as e:
        print(f"  TED scrape failed: {e}", file=sys.stderr)

    # 2. TenderNed
    print("Scraping TenderNed...")
    try:
        tn_new = scrape_tenderned(tenders + new_tenders)
        print(f"  New from TenderNed: {len(tn_new)}")
        new_tenders.extend(tn_new)
    except Exception as e:
        print(f"  TenderNed scrape failed: {e}", file=sys.stderr)

    if new_tenders:
        # Prepend new tenders (most recent first)
        all_tenders = new_tenders + tenders
        save_tenders(all_tenders)
        print(f"[tender_scraper] ✓ Added {len(new_tenders)} new tender(s). Total: {len(all_tenders)}")
    else:
        print("[tender_scraper] ✓ No new relevant tenders found.")

    return len(new_tenders)

if __name__ == "__main__":
    count = main()
    sys.exit(0)
