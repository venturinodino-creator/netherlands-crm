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
from datetime import datetime, date, timedelta, timezone
from pathlib import Path

# ── Config ───────────────────────────────────────────────────────────────────

REPO_ROOT    = Path(__file__).parent.parent
TENDERS_FILE = REPO_ROOT / "data" / "tenders.json"
STATE_FILE   = REPO_ROOT / "data" / "tenders-scan-state.json"

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

def save_state(new_count: int) -> None:
    state = {
        "lastRun": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "lastNewCount": new_count,
    }
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")

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
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")[:300]
        except Exception:
            pass
        print(f"  HTTP {e.code} for {url} :: {body}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  Error fetching {url}: {e}", file=sys.stderr)
        return None

# ── TED Europa scraper ────────────────────────────────────────────────────────
# API v3 expert-query syntax: field~"value", combined with AND/OR/parens.
# Verified against the live API on 2026-08-13 — field names below match the
# current schema (the previous version of this script used a since-retired
# field set: title-text, notice-number, estimated-value, deadline-receipt-tenders).

TED_URL = "https://api.ted.europa.eu/v3/notices/search"
TED_FIELDS = [
    "publication-number", "notice-title", "buyer-name", "publication-date",
    "deadline", "estimated-value-lot", "contract-nature",
    "place-of-performance", "links",
]
TED_LOOKBACK_DAYS = 180  # only scan recent notices — avoids re-walking all TED history every run

def _ted_lookback_cutoff() -> str:
    return (date.today() - timedelta(days=TED_LOOKBACK_DAYS)).strftime("%Y%m%d")

def _pick_lang(obj, prefer: str = "eng") -> str:
    """TED v3 returns multilingual fields as {lang3: value_or_[value]}."""
    if not isinstance(obj, dict) or not obj:
        return ""
    v = obj.get(prefer)
    if v is None:
        v = next(iter(obj.values()), "")
    return v[0] if isinstance(v, list) else (v or "")

def build_ted_query(keywords: list) -> str:
    ors = " OR ".join(f'notice-title~"{k}"' for k in keywords)
    return f"({ors}) AND publication-date>={_ted_lookback_cutoff()}"

def search_ted(query: str, page: int = 1) -> list:
    """Search TED Europa notices. Returns list of raw notice dicts."""
    payload = json.dumps({
        "query": query,
        "onlyLatestVersions": True,
        "scope": "ALL",
        "fields": TED_FIELDS,
        "page": page,
        "limit": 50
    }).encode()
    result = fetch_json(TED_URL, data=payload)
    if not result or "notices" not in result:
        return []
    return result.get("notices", [])

def ted_to_tender(notice: dict, product: str, competitor: str) -> dict:
    """Convert a TED v3 notice dict to our tender schema."""
    pub_num = notice.get("publication-number", "") or ""
    tender_id = "ted_" + re.sub(r"[^a-z0-9_]", "_", pub_num.lower())

    title = _pick_lang(notice.get("notice-title") or {})
    buyer = _pick_lang(notice.get("buyer-name") or {})

    pub_date_raw = notice.get("publication-date") or ""
    published = pub_date_raw[:10] if pub_date_raw else ""

    deadline_raw = notice.get("deadline")
    deadline = deadline_raw[0][:10] if isinstance(deadline_raw, list) and deadline_raw else ""

    value_raw = notice.get("estimated-value-lot")
    value = ""
    if isinstance(value_raw, list) and value_raw:
        try:
            value = str(int(float(value_raw[0])))
        except (ValueError, TypeError):
            value = ""

    links = notice.get("links") or {}
    html_links = links.get("html") or {} if isinstance(links, dict) else {}
    url = html_links.get("ENG") or (next(iter(html_links.values()), "") if html_links else "")
    if not url and pub_num:
        url = f"https://ted.europa.eu/en/notice/-/detail/{pub_num}"

    return {
        "id": tender_id,
        "title": title or f"TED notice {pub_num}",
        "institution": buyer,
        "publishedDate": published,
        "deadline": deadline,
        "status": "identified",
        "value": value,
        "product": product or "Academic database",
        "competitor": competitor or "—",
        "url": url,
        "notes": f"TED Europa notice {pub_num}. Published: {published or '—'}.",
        "source": f"TED Europa {pub_num}",
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }

def scrape_ted(existing: list) -> list:
    """Scrape TED for all relevant keyword groups. Returns new tenders only."""
    ids    = existing_ids(existing)
    titles = existing_titles(existing)
    new    = []
    seen   = set()

    query_groups = [ELSEVIER_PRODUCTS, COMPETITOR_PRODUCTS, CATEGORY_KEYWORDS[:6]]

    for group in query_groups:
        query = build_ted_query(group)
        print(f"  TED query: {query[:90]}...")
        notices = search_ted(query)
        print(f"    → {len(notices)} notices")
        for n in notices:
            title = _pick_lang(n.get("notice-title") or {})
            rel, product, competitor = is_relevant(title)
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
# TenderNed's site is now an Angular SPA (tn-root) — the HTML has no results
# in it. Use the underlying public JSON API it calls instead.
# Verified against the live API on 2026-08-13.

TENDERNED_API = "https://www.tenderned.nl/papi/tenderned-rs-tns/v2/publicaties"

def scrape_tenderned(existing: list) -> list:
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
        url     = f"{TENDERNED_API}?zoekterm={encoded}"
        print(f"  TenderNed: {kw}")
        result = fetch_json(url, headers={"User-Agent": "Mozilla/5.0 (research-crm-scraper/1.0)"})
        if not result:
            continue
        for item in result.get("content", []) or []:
            title = (item.get("aanbestedingNaam") or "").strip()
            desc  = item.get("opdrachtBeschrijving") or ""
            rel, product, competitor = is_relevant(title, desc)
            if not rel:
                continue
            pub_id = str(item.get("publicatieId", ""))
            t_id = "tn_" + re.sub(r"[^a-z0-9]", "_", pub_id.lower())
            if t_id in ids or t_id in seen:
                continue
            if title.lower().strip() in titles:
                continue
            link = item.get("link") or {}
            t = {
                "id": t_id,
                "title": title,
                "institution": item.get("opdrachtgeverNaam") or "",
                "publishedDate": (item.get("publicatieDatum") or "")[:10],
                "deadline": (item.get("sluitingsDatum") or "")[:10],
                "status": "identified",
                "value": "",
                "product": product or kw,
                "competitor": competitor or "—",
                "url": link.get("href") or f"https://www.tenderned.nl/aankondigingen/overzicht/{pub_id}",
                "notes": f"TenderNed publicatie {pub_id}. Found via search for '{kw}'.",
                "source": f"TenderNed {pub_id}",
                "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            new.append(t)
            seen.add(t_id)
        time.sleep(0.5)

    return new

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    # Windows consoles default to cp1252, which can't encode the arrows/checkmarks
    # below. GitHub Actions runners are UTF-8 by default, but reconfigure defensively
    # so a print() never crashes the run after the actual scraping work is done.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
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

    save_state(len(new_tenders))
    return len(new_tenders)

if __name__ == "__main__":
    count = main()
    sys.exit(0)
