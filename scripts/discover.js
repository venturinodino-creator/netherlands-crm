/**
 * discover.js — NOT currently used by the cron. See .github/workflows/discover.yml,
 * which now runs contact discovery as a Claude Code agent that reads real
 * institution staff/library/research-office pages for a name+title+email
 * together. This script is structurally unable to do that: its only source,
 * the OpenAlex authors API, never returns an email address, and the CRM
 * requires one before a contact enters the review queue — so every run here
 * finds candidates and then discards all of them. Kept for reference only.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const PENDING_FILE = 'data/pending-contacts.json';
const STATE_FILE   = 'data/discovery-state.json';
const CONFIG_FILE  = 'data/scrape-config.json';
const TARGET       = 20;

const SUPA_URL = 'https://cfhljbexesdrabmadpcc.supabase.co';
const SUPA_KEY = 'sb_publishable_PE2Yc0ivOT4F4fE80CXJUw_kbch9TpZ'; // publishable key — read-only here, safe to embed

// The admin sets scrape targets from the CRM's "New Contacts" page, which
// writes to this table. Falls back to the local CONFIG_FILE if Supabase is
// unreachable, so a scan never silently fails from a transient network issue.
async function fetchScrapeConfig() {
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/scrape_config?select=types&id=eq.1`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    if (rows[0] && Array.isArray(rows[0].types) && rows[0].types.length) return rows[0].types;
  } catch (e) {
    console.warn('Could not fetch scrape_config from Supabase, falling back to local file:', e.message);
  }
  return null;
}

// ── Institution definitions by type ────────────────────────────────────────
const INSTITUTIONS = {
  research: [
    { key: 'cwi',      name: 'Centrum Wiskunde & Informatica',              instId: 'cwi',       dept: 'Mathematics & Computer Science' },
    { key: 'esc',      name: 'Netherlands eScience Center',                 instId: 'esc',       dept: 'Research Software Engineering' },
    { key: 'pbl',      name: 'PBL Netherlands Environmental Assessment Agency', instId: 'pbl',  dept: 'Environmental Assessment' },
    { key: 'rathenau', name: 'Rathenau Instituut',                          instId: 'rathenau',  dept: 'Science & Technology Studies' },
  ],
  university: [
    { key: 'uva',     name: 'University of Amsterdam',               instId: 'uva',     dept: 'Research' },
    { key: 'vu',      name: 'Vrije Universiteit Amsterdam',          instId: 'vu',      dept: 'Research' },
    { key: 'uu',      name: 'Utrecht University',                    instId: 'uu',      dept: 'Research' },
    { key: 'leiden',  name: 'Leiden University',                     instId: 'leiden',  dept: 'Research' },
    { key: 'eur',     name: 'Erasmus University Rotterdam',          instId: 'eur',     dept: 'Research' },
    { key: 'rug',     name: 'University of Groningen',               instId: 'rug',     dept: 'Research' },
    { key: 'ru',      name: 'Radboud University',                    instId: 'ru',      dept: 'Research' },
    { key: 'tudelft', name: 'Delft University of Technology',        instId: 'tudelft', dept: 'Research' },
    { key: 'tue',     name: 'Eindhoven University of Technology',    instId: 'tue',     dept: 'Research' },
    { key: 'ut',      name: 'University of Twente',                  instId: 'ut',      dept: 'Research' },
    { key: 'wur',     name: 'Wageningen University',                 instId: 'wur',     dept: 'Research' },
    { key: 'um',      name: 'Maastricht University',                 instId: 'um',      dept: 'Research' },
    { key: 'tiu',     name: 'Tilburg University',                    instId: 'tiu',     dept: 'Research' },
  ],
  medical: [
    { key: 'aumc',       name: 'Amsterdam UMC',                          instId: 'aumc',       dept: 'Medical Research' },
    { key: 'erasmusmc',  name: 'Erasmus MC',                             instId: 'erasmusmc',  dept: 'Medical Research' },
    { key: 'umcutrecht', name: 'UMC Utrecht',                           instId: 'umcutrecht', dept: 'Medical Research' },
    { key: 'lumc',       name: 'Leiden University Medical Centre',       instId: 'lumc',       dept: 'Medical Research' },
    { key: 'umcg',       name: 'University Medical Centre Groningen',    instId: 'umcg',       dept: 'Medical Research' },
    { key: 'radboudumc', name: 'Radboud University Medical Center',      instId: 'radboudumc', dept: 'Medical Research' },
    { key: 'mumc',       name: 'Maastricht UMC+',                        instId: 'mumc',       dept: 'Medical Research' },
  ],
  ngo: [
    { key: 'knaw',   name: 'Royal Netherlands Academy of Arts and Sciences', instId: 'knaw',   dept: 'Scientific Research' },
    { key: 'nwo',    name: 'Netherlands Organisation for Scientific Research', instId: 'nwo', dept: 'Research Funding' },
    { key: 'zonmw',  name: 'ZonMw',                                           instId: 'zonmw',  dept: 'Health Research' },
  ],
};

function readJSON(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}
function saveJSON(path, data) {
  const dir = path.split('/').slice(0,-1).join('/');
  if (dir) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}
function makeId(key) {
  return `disc_${key}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
}

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'NL-CRM-Bot/1.0 (mailto:venturino.dino@gmail.com)' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return r;
  } catch (e) { clearTimeout(timer); throw e; }
}

async function getJSON(url) {
  const r = await get(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.json();
}

async function getInstId(name) {
  const url = `https://api.openalex.org/institutions?search=${encodeURIComponent(name)}&per_page=1&mailto=venturino.dino@gmail.com`;
  const data = await getJSON(url);
  return data?.results?.[0]?.id || null;
}

async function scrapeOpenAlex(scraped, inst, needed) {
  const contacts = [];
  let oaId = scraped[`${inst.key}_oa_id`];
  if (!oaId) {
    oaId = await getInstId(inst.name);
    if (!oaId) { console.log(`  ⚠ Not found in OpenAlex: ${inst.name}`); return contacts; }
    scraped[`${inst.key}_oa_id`] = oaId;
  }
  const shortId = String(oaId).split('/').pop();
  const done = new Set(scraped[inst.key] || []);
  const page = scraped[`${inst.key}_page`] || 1;
  const cacheKey = `p${page}`;
  if (done.has(cacheKey)) { console.log(`  ↩ ${inst.name} page ${page} already done`); return contacts; }
  const url = `https://api.openalex.org/authors?filter=last_known_institutions.id:${shortId}&per_page=10&page=${page}&mailto=venturino.dino@gmail.com`;
  console.log(`  → ${inst.name} page ${page}`);
  const data = await getJSON(url);
  done.add(cacheKey);
  scraped[inst.key] = [...done];
  if (data?.results?.length) {
    for (const author of data.results) {
      if (contacts.length >= needed) break;
      const full = (author.display_name || '').trim().replace(/\s+/g, ' ');
      const parts = full.split(' ');
      if (parts.length < 2) continue;
      const first = parts[0], last = parts.slice(1).join(' ');
      const orcid = author.orcid ? `ORCID: ${author.orcid}` : '';
      contacts.push({
        first, last, title: 'Researcher', dept: inst.dept, email: '',
        instId: inst.instId, source: author.id || url, research: orcid,
      });
    }
    scraped[`${inst.key}_page`] = page + 1;
    console.log(`  ✓ ${contacts.length} contacts from ${inst.name}`);
  } else {
    console.log(`  ✗ No results for ${inst.name} page ${page} (resetting)`);
    scraped[`${inst.key}_page`] = 1;
    scraped[inst.key] = [];
  }
  return contacts;
}

async function main() {
  // Read config — Supabase first (set from the CRM UI), local file as fallback
  const remoteTypes = await fetchScrapeConfig();
  const config = remoteTypes ? { types: remoteTypes } : readJSON(CONFIG_FILE, { types: ['research'] });
  console.log(remoteTypes ? 'Using scrape target from Supabase' : 'Using scrape target from local config file');
  const enabledTypes = new Set(Array.isArray(config.types) ? config.types : ['research']);
  console.log('Enabled institution types:', [...enabledTypes].join(', '));

  // Build list of institutions to scrape (deduplicated)
  const seen = new Set();
  const toScrape = [];
  for (const type of ['research','university','medical','ngo']) {
    if (!enabledTypes.has(type)) continue;
    for (const inst of INSTITUTIONS[type] || []) {
      if (!seen.has(inst.key)) { seen.add(inst.key); toScrape.push(inst); }
    }
  }
  console.log(`Scraping ${toScrape.length} institutions: ${toScrape.map(i=>i.key).join(', ')}`);

  const state   = readJSON(STATE_FILE, { scraped: {}, lastRun: null });
  const pending = readJSON(PENDING_FILE, []);

  const existingEmails = new Set(pending.map(c=>(c.email||'').toLowerCase().trim()).filter(Boolean));
  const existingNames  = new Set(pending.map(c=>((c.first||'')+' '+(c.last||'')).toLowerCase().trim()));

  const scraped = state.scraped || {};
  const contacts = [];

  // Distribute target evenly across institutions
  const perInst = Math.max(3, Math.ceil(TARGET / toScrape.length));

  for (const inst of toScrape) {
    if (contacts.length >= TARGET) break;
    try {
      const newOnes = await scrapeOpenAlex(scraped, inst, perInst);
      contacts.push(...newOnes);
    } catch (e) {
      console.error(`  Error scraping ${inst.name}:`, e.message);
    }
  }

  // Dedup and push to pending — an email address is required, not optional.
  // OpenAlex (this scraper's only source) never provides one, so this will
  // filter out every result until a source that does is added.
  let added = 0, skippedNoEmail = 0;
  for (const c of contacts) {
    const el = (c.email||'').toLowerCase().trim();
    const nl = ((c.first||'')+' '+(c.last||'')).toLowerCase().trim();
    if (!el) { skippedNoEmail++; continue; }
    if (existingEmails.has(el)) continue;
    if (existingNames.has(nl)) continue;
    const id = makeId(c.instId || 'xx');
    pending.push({ ...c, id });
    existingEmails.add(el); existingNames.add(nl); added++;
  }
  if (skippedNoEmail) console.log(`Skipped ${skippedNoEmail} contact(s) with no email address`);

  state.scraped  = scraped;
  state.lastRun  = new Date().toISOString();
  state.lastTypes = [...enabledTypes];

  saveJSON(STATE_FILE, state);
  saveJSON(PENDING_FILE, pending);
  console.log(`Done — added ${added} new contacts (total pending: ${pending.length})`);
}

main().catch(e => { console.error(e); process.exit(1); });
