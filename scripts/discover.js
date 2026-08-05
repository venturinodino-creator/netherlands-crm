import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const PENDING_FILE = 'data/pending-contacts.json';
const STATE_FILE   = 'data/discovery-state.json';

function readJSON(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}
function saveJSON(path, data) {
  const dir = path.split('/').slice(0,-1).join('/');
  if (dir) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}
function makeId(inst) {
  return `disc_${inst}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
}
async function get(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NL-Research-CRM/1.0; +https://github.com/venturinodino-creator/netherlands-crm)' },
      signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) { console.warn(`HTTP ${r.status} for ${url}`); return null; }
    return await r.text();
  } catch(e) { console.warn(`Fetch failed ${url}: ${e.message}`); return null; }
}
async function getJSON(url) {
  try {
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'NL-Research-CRM/1.0 (mailto:venturino.dino@gmail.com)' },
      signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) { console.warn(`HTTP ${r.status} for ${url}`); return null; }
    return await r.json();
  } catch(e) { console.warn(`Fetch failed ${url}: ${e.message}`); return null; }
}

// ── CWI ──────────────────────────────────────────────────────────────────────
async function scrapeCWI(scraped, needed) {
  const contacts = [];
  const done = new Set(scraped.cwi || []);

  for (let page = 0; page <= 20 && contacts.length < needed; page++) {
    const listUrl = page === 0
      ? 'https://www.cwi.nl/en/people/'
      : `https://www.cwi.nl/en/people/?page=${page}`;
    if (done.has(listUrl)) continue;
    const html = await get(listUrl);
    if (!html || !html.includes('/en/people/')) break;

    // FIXED: no trailing slash — links are href="/en/people/slug" not "/en/people/slug/"
    const profiles = [...new Set(
      [...html.matchAll(/href="(\/en\/people\/[a-zA-Z0-9][a-zA-Z0-9-]+)"/g)]
        .map(m => 'https://www.cwi.nl' + m[1])
        .filter(u => !/\/people\/$/.test(u))
    )];
    if (profiles.length === 0) break;

    for (const profUrl of profiles) {
      if (contacts.length >= needed) break;
      if (done.has(profUrl)) continue;
      const p = await get(profUrl);
      done.add(profUrl);
      if (!p) continue;

      const nameM = p.match(/<h1[^>]*>([^<]+)<\/h1>/);
      if (!nameM) continue;
      const full = nameM[1].trim().replace(/\s+/g, ' ');
      const parts = full.split(' ');
      if (parts.length < 2) continue;
      const first = parts[0], last = parts.slice(1).join(' ');

      // Email shown as Firstname.Lastname@cwi.nl on profile page
      const emailM = p.match(/([a-zA-Z][a-zA-Z0-9._+-]*@cwi\.nl)/i);
      const email = emailM ? emailM[1].toLowerCase() : '';

      // Title: "Function(s)\nValue" in profile markdown
      const titleM = p.match(/Function[^\n]*\n([^\n]{3,60})/i);
      const title = titleM ? titleM[1].trim() : 'Researcher';

      const deptM = p.match(/Department[^\n]*\n([^\n]{3,80})/i);
      const dept = deptM ? deptM[1].trim() : 'Mathematics & Computer Science';

      contacts.push({ first, last, title, dept, email, instId: 'cwi', source: profUrl });
    }
    done.add(listUrl);
  }

  scraped.cwi = [...done];
  return contacts;
}

// ── PBL ──────────────────────────────────────────────────────────────────────
async function scrapePBL(scraped, needed) {
  const contacts = [];
  const done = new Set(scraped.pbl || []);

  // FIXED: correct URL is /en/about-pbl/staff (not /over-pbl/medewerkers)
  for (let page = 0; page <= 6 && contacts.length < needed; page++) {
    const listUrl = page === 0
      ? 'https://www.pbl.nl/en/about-pbl/staff'
      : `https://www.pbl.nl/en/about-pbl/staff?page=${page}`;
    if (done.has(listUrl)) continue;
    const html = await get(listUrl);
    done.add(listUrl);
    if (!html) continue;

    // Parse employee links: href="/en/about-pbl/employees/firstname-lastname"
    const matches = [...html.matchAll(/href="(\/en\/about-pbl\/employees\/([a-z0-9-]+))"[^>]*>([^<]+)<\/a>/gi)];
    for (const m of matches) {
      if (contacts.length >= needed) break;
      const [, path, slug, rawName] = m;
      if (done.has(slug)) continue;
      done.add(slug);
      const full = rawName.trim().replace(/\s+/g, ' ');
      const parts = full.split(' ');
      if (parts.length < 2) continue;
      const first = parts[0], last = parts.slice(1).join(' ');
      // Construct email from slug: firstname-lastname -> firstname.lastname@pbl.nl
      const email = slug.replace(/-/g, '.') + '@pbl.nl';
      contacts.push({ first, last, title: 'Researcher', dept: 'Environmental Assessment', email, instId: 'pbl', source: `https://www.pbl.nl${path}` });
    }
  }

  scraped.pbl = [...done];
  return contacts;
}

// ── OpenAlex helper (for JS-rendered sites) ───────────────────────────────────
async function scrapeOpenAlex(scraped, key, instName, instId, dept, needed) {
  const contacts = [];
  const done = new Set(scraped[key] || []);
  const page = scraped[`${key}_page`] || 1;
  const cacheKey = `p${page}`;
  if (done.has(cacheKey)) return contacts;

  const url = `https://api.openalex.org/authors?filter=last_known_institution.display_name.search:${encodeURIComponent(instName)}&per_page=10&page=${page}&mailto=venturino.dino@gmail.com`;
  const data = await getJSON(url);
  done.add(cacheKey);
  scraped[key] = [...done];

  if (data?.results?.length) {
    for (const author of data.results) {
      if (contacts.length >= needed) break;
      const full = (author.display_name || '').trim().replace(/\s+/g, ' ');
      const parts = full.split(' ');
      if (parts.length < 2) continue;
      const first = parts[0], last = parts.slice(1).join(' ');
      const orcid = author.orcid ? `ORCID: ${author.orcid}` : '';
      contacts.push({ first, last, title: 'Researcher', dept, email: '', instId, source: author.id || url, research: orcid });
    }
    scraped[`${key}_page`] = page + 1;
  }

  return contacts;
}

// ── eScience Center via OpenAlex ──────────────────────────────────────────────
async function scrapeEScience(scraped, needed) {
  // eScience website blocks GitHub Actions — use OpenAlex author search instead
  return scrapeOpenAlex(scraped, 'esc', 'Netherlands eScience Center', 'esc', 'Research Software Engineering', needed);
}

// ── Rathenau via OpenAlex ─────────────────────────────────────────────────────
async function scrapeRathenau(scraped, needed) {
  // Rathenau website is JS-rendered — use OpenAlex author search instead
  return scrapeOpenAlex(scraped, 'rathenau', 'Rathenau Instituut', 'rathenau', 'Science & Technology Studies', needed);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const state   = readJSON(STATE_FILE,   { scraped: {}, lastRun: null });
  const pending = readJSON(PENDING_FILE, []);
  const existEmails = new Set(pending.map(c => (c.email||'').toLowerCase()).filter(Boolean));
  const existNames  = new Set(pending.map(c => `${c.first} ${c.last}`.toLowerCase()).filter(Boolean));

  const s = state.scraped;
  const exhausted = (s.cwi?.length||0) > 80 && (s.esc_page||1) > 10 && (s.pbl?.length||0) > 12 && (s.rathenau_page||1) > 10;
  if (exhausted) {
    console.log('Full cycle done — resetting scrape state');
    state.scraped = {};
  }

  const cwi = await scrapeCWI(state.scraped, 12);    console.log(`CWI: ${cwi.length}`);
  const esc = await scrapeEScience(state.scraped, 4); console.log(`eScience: ${esc.length}`);
  const pbl = await scrapePBL(state.scraped, 2);      console.log(`PBL: ${pbl.length}`);
  const rat = await scrapeRathenau(state.scraped, 2); console.log(`Rathenau: ${rat.length}`);
  const raw = [...cwi, ...esc, ...pbl, ...rat];

  let added = 0;
  for (const c of raw) {
    const el = (c.email||'').toLowerCase();
    const nl = `${c.first} ${c.last}`.toLowerCase();
    if (el && existEmails.has(el)) continue;
    if (existNames.has(nl)) continue;
    pending.push({
      ...c,
      id: makeId(c.instId),
      status: 'prospect', priority: 'medium', quality: 'seed', lastContact: '',
      notes: `Discovered: ${new Date().toISOString().slice(0,10)} | Source: ${c.source}`
    });
    if (el) existEmails.add(el);
    existNames.add(nl);
    added++;
  }

  state.lastRun = new Date().toISOString();
  saveJSON(PENDING_FILE, pending);
  saveJSON(STATE_FILE, state);
  console.log(`\nDone: +${added} contacts. Total pending: ${pending.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
