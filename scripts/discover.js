/**
 * discover.js — Daily contact discovery scan.
 * Free, zero-Claude-cost: scrapes OpenAlex for researchers at each enabled
 * institution and constructs a plausible institutional email per contact
 * (OpenAlex itself never provides one), flagging it for manual verification.
 * Writes new candidates straight into Supabase's pending_contacts table
 * (requires SUPABASE_SERVICE_ROLE_KEY — RLS restricts inserts to admins,
 * which the service key bypasses). Run: node scripts/discover.js
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const PENDING_FILE = 'data/pending-contacts.json'; // local audit trail only — the app no longer reads this
const STATE_FILE   = 'data/discovery-state.json';
const CONFIG_FILE  = 'data/scrape-config.json';
const TARGET       = 20;

const SUPA_URL = 'https://cfhljbexesdrabmadpcc.supabase.co';
const SUPA_KEY = 'sb_publishable_PE2Yc0ivOT4F4fE80CXJUw_kbch9TpZ'; // publishable key — read-only here, safe to embed
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // required to write pending_contacts (RLS: insert requires is_admin())

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

// Existing pending_contacts (any status) — used to dedup against what the
// service role key can see. RLS blocks the publishable key from reading this,
// so this always uses the service key.
async function fetchExistingPending() {
  if (!SUPA_SERVICE_KEY) return [];
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/pending_contacts?select=first,last,email`, {
      headers: { apikey: SUPA_SERVICE_KEY, Authorization: `Bearer ${SUPA_SERVICE_KEY}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('Could not fetch existing pending_contacts:', e.message);
    return [];
  }
}

async function insertPendingContacts(rows) {
  if (!rows.length) return 0;
  if (!SUPA_SERVICE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set — skipping Supabase insert (add it as a GitHub Actions secret).');
    return 0;
  }
  const res = await fetch(`${SUPA_URL}/rest/v1/pending_contacts`, {
    method: 'POST',
    headers: {
      apikey: SUPA_SERVICE_KEY,
      Authorization: `Bearer ${SUPA_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase insert failed: HTTP ${res.status} ${body}`);
  }
  return rows.length;
}

// ── Institution definitions by type ────────────────────────────────────────
// emailDomain is used to construct a plausible (unverified) email since
// OpenAlex never provides one — flagged in `notes` for the user to confirm.
const INSTITUTIONS = {
  research: [
    { key: 'cwi',      name: 'Centrum Wiskunde & Informatica',              instId: 'cwi',       dept: 'Mathematics & Computer Science', emailDomain: 'cwi.nl' },
    { key: 'esc',      name: 'Netherlands eScience Center',                 instId: 'esc',       dept: 'Research Software Engineering',  emailDomain: 'esciencecenter.nl' },
    { key: 'pbl',      name: 'PBL Netherlands Environmental Assessment Agency', instId: 'pbl',  dept: 'Environmental Assessment',        emailDomain: 'pbl.nl' },
    { key: 'rathenau', name: 'Rathenau Instituut',                          instId: 'rathenau',  dept: 'Science & Technology Studies',    emailDomain: 'rathenau.nl' },
    { key: 'tno',       name: 'TNO',                                        instId: 'tno',       dept: 'Applied Scientific Research',     emailDomain: 'tno.nl' },
    { key: 'hubrecht',  name: 'Hubrecht Institute',                         instId: 'hubrecht',  dept: 'Developmental & Stem Cell Biology', emailDomain: 'hubrecht.eu' },
    { key: 'nin',       name: 'Netherlands Institute for Neuroscience',     instId: 'nin',       dept: 'Neuroscience',                    emailDomain: 'nin.nl' },
    { key: 'rivm',      name: 'RIVM',                                       instId: 'rivm',      dept: 'Public Health & Environment',     emailDomain: 'rivm.nl' },
    { key: 'deltares',  name: 'Deltares',                                   instId: 'deltares',  dept: 'Water & Subsurface Research',     emailDomain: 'deltares.nl' },
    { key: 'sron',      name: 'SRON Netherlands Institute for Space Research', instId: 'sron',   dept: 'Space Research',                  emailDomain: 'sron.nl' },
    { key: 'nikhef',    name: 'Nikhef',                                     instId: 'nikhef',    dept: 'Subatomic Physics',               emailDomain: 'nikhef.nl' },
    { key: 'astron',    name: 'ASTRON — Netherlands Institute for Radio Astronomy', instId: 'astron', dept: 'Radio Astronomy',            emailDomain: 'astron.nl' },
    { key: 'nioz',      name: 'NIOZ Royal Netherlands Institute for Sea Research', instId: 'nioz', dept: 'Marine & Climate Research',      emailDomain: 'nioz.nl' },
    { key: 'knmi',      name: 'KNMI — Royal Netherlands Meteorological Institute', instId: 'knmi', dept: 'Climate & Seismology',           emailDomain: 'knmi.nl' },
    { key: 'naturalis', name: 'Naturalis Biodiversity Center',              instId: 'naturalis', dept: 'Biodiversity Science',            emailDomain: 'naturalis.nl' },
    { key: 'nlr',       name: 'NLR — Netherlands Aerospace Centre',         instId: 'nlr',       dept: 'Aerospace Research',              emailDomain: 'nlr.nl' },
    { key: 'cpb',       name: 'CPB Netherlands Bureau for Economic Policy Analysis', instId: 'cpb', dept: 'Economic Policy Analysis',      emailDomain: 'cpb.nl' },
    { key: 'scp',       name: 'SCP — Netherlands Institute for Social Research', instId: 'scp',   dept: 'Social & Cultural Research',      emailDomain: 'scp.nl' },
  ],
  university: [
    { key: 'uva',     name: 'University of Amsterdam',               instId: 'uva',     dept: 'Research', emailDomain: 'uva.nl' },
    { key: 'vu',      name: 'Vrije Universiteit Amsterdam',          instId: 'vu',      dept: 'Research', emailDomain: 'vu.nl' },
    { key: 'uu',      name: 'Utrecht University',                    instId: 'uu',      dept: 'Research', emailDomain: 'uu.nl' },
    { key: 'leiden',  name: 'Leiden University',                     instId: 'leiden',  dept: 'Research', emailDomain: 'leidenuniv.nl' },
    { key: 'eur',     name: 'Erasmus University Rotterdam',          instId: 'eur',     dept: 'Research', emailDomain: 'eur.nl' },
    { key: 'rug',     name: 'University of Groningen',               instId: 'rug',     dept: 'Research', emailDomain: 'rug.nl' },
    { key: 'ru',      name: 'Radboud University',                    instId: 'ru',      dept: 'Research', emailDomain: 'ru.nl' },
    { key: 'tudelft', name: 'Delft University of Technology',        instId: 'tudelft', dept: 'Research', emailDomain: 'tudelft.nl' },
    { key: 'tue',     name: 'Eindhoven University of Technology',    instId: 'tue',     dept: 'Research', emailDomain: 'tue.nl' },
    { key: 'ut',      name: 'University of Twente',                  instId: 'ut',      dept: 'Research', emailDomain: 'utwente.nl' },
    { key: 'wur',     name: 'Wageningen University',                 instId: 'wur',     dept: 'Research', emailDomain: 'wur.nl' },
    { key: 'um',      name: 'Maastricht University',                 instId: 'um',      dept: 'Research', emailDomain: 'maastrichtuniversity.nl' },
    { key: 'tiu',     name: 'Tilburg University',                    instId: 'tiu',     dept: 'Research', emailDomain: 'tilburguniversity.edu' },
    { key: 'ou',      name: 'Open Universiteit',                     instId: 'ou',      dept: 'Research', emailDomain: 'ou.nl' },
  ],
  medical: [
    { key: 'aumc',       name: 'Amsterdam UMC',                          instId: 'aumc',       dept: 'Medical Research', emailDomain: 'amsterdamumc.nl' },
    { key: 'erasmusmc',  name: 'Erasmus MC',                             instId: 'erasmusmc',  dept: 'Medical Research', emailDomain: 'erasmusmc.nl' },
    { key: 'umcutrecht', name: 'UMC Utrecht',                           instId: 'umcutrecht', dept: 'Medical Research', emailDomain: 'umcutrecht.nl' },
    { key: 'lumc',       name: 'Leiden University Medical Centre',       instId: 'lumc',       dept: 'Medical Research', emailDomain: 'lumc.nl' },
    { key: 'umcg',       name: 'University Medical Centre Groningen',    instId: 'umcg',       dept: 'Medical Research', emailDomain: 'umcg.nl' },
    { key: 'radboudumc', name: 'Radboud University Medical Center',      instId: 'radboudumc', dept: 'Medical Research', emailDomain: 'radboudumc.nl' },
    { key: 'mumc',       name: 'Maastricht UMC+',                        instId: 'mumc',       dept: 'Medical Research', emailDomain: 'mumc.nl' },
    { key: 'maxima',     name: 'Princess Máxima Center',                 instId: 'maxima',     dept: 'Medical Research', emailDomain: 'prinsesmaximacentrum.nl' },
    { key: 'nki',        name: 'Netherlands Cancer Institute',           instId: 'nki',        dept: 'Medical Research', emailDomain: 'nki.nl' },
    { key: 'mmc',        name: 'Máxima Medical Centre',                  instId: 'mmc',        dept: 'Medical Research', emailDomain: 'mmc.nl' },
    { key: 'sanquin',    name: 'Sanquin Research',                       instId: 'sanquin',    dept: 'Medical Research', emailDomain: 'sanquin.nl' },
    { key: 'aighd',      name: 'Amsterdam Institute for Global Health and Development', instId: 'aighd', dept: 'Medical Research', emailDomain: 'aighd.org' },
  ],
  ngo: [
    { key: 'knaw',   name: 'Royal Netherlands Academy of Arts and Sciences', instId: 'knaw',   dept: 'Scientific Research', emailDomain: 'knaw.nl' },
    { key: 'nwo',    name: 'Netherlands Organisation for Scientific Research', instId: 'nwo', dept: 'Research Funding',    emailDomain: 'nwo.nl' },
    { key: 'zonmw',  name: 'ZonMw',                                           instId: 'zonmw',  dept: 'Health Research',   emailDomain: 'zonmw.nl' },
    { key: 'clingendael', name: 'Clingendael Institute',                     instId: 'clingendael', dept: 'International Relations Research', emailDomain: 'clingendael.org' },
    { key: 'hiil',   name: 'HiiL — Hague Institute for Innovation of Law',    instId: 'hiil',   dept: 'Justice Sector Research', emailDomain: 'hiil.org' },
    { key: 'oxfamnovib', name: 'Oxfam Novib',                                 instId: 'oxfamnovib', dept: 'Development Research', emailDomain: 'oxfamnovib.nl' },
    { key: 'icj',    name: 'International Court of Justice',                  instId: 'icj',    dept: 'International Law', emailDomain: 'icj-cij.org' },
    { key: 'iiss',   name: 'Asser Institute',                                 instId: 'iiss',   dept: 'International Law Research', emailDomain: 'asser.nl' },
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
function slugifyNamePart(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase().replace(/[^a-z]/g, '');
}
function constructEmail(first, last, domain) {
  const f = slugifyNamePart(first), l = slugifyNamePart(last);
  if (!f || !l || !domain) return '';
  return `${f}.${l}@${domain}`;
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
      const email = constructEmail(first, last, inst.emailDomain);
      contacts.push({
        first, last, title: 'Researcher', dept: inst.dept, email,
        instId: inst.instId, instName: inst.name, source: author.id || url, research: orcid,
        constructed: !!email,
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

  const state = readJSON(STATE_FILE, { scraped: {}, lastRun: null });

  const existingPendingRemote = await fetchExistingPending();
  const localPending = readJSON(PENDING_FILE, []);
  const existingEmails = new Set(
    [...existingPendingRemote, ...localPending].map(c=>(c.email||'').toLowerCase().trim()).filter(Boolean)
  );
  const existingNames = new Set(
    [...existingPendingRemote, ...localPending].map(c=>((c.first||'')+' '+(c.last||'')).toLowerCase().trim())
  );

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

  // Dedup — email required (constructed emails count), matching the app's rule
  // that unverified contacts still need a starting point for outreach.
  const toInsert = [];
  const localPendingOut = [...localPending];
  let skippedNoEmail = 0;
  for (const c of contacts) {
    const el = (c.email||'').toLowerCase().trim();
    const nl = ((c.first||'')+' '+(c.last||'')).toLowerCase().trim();
    if (!el) { skippedNoEmail++; continue; }
    if (existingEmails.has(el)) continue;
    if (existingNames.has(nl)) continue;
    // id is local-only (audit trail): pending_contacts.id is a Postgres uuid
    // column with its own default, and this disc_<key>_<ts>_<rand> format
    // isn't a valid uuid — sending it as the row's id makes every insert
    // fail with 22P02 ("invalid input syntax for type uuid"). Let Postgres
    // generate the real id and keep this one only in the local JSON file.
    const id = makeId(c.instId || 'xx');
    toInsert.push({
      first: c.first, last: c.last, title: c.title, department: c.dept,
      institution_id: c.instId, institution_name: c.instName, email: c.email,
      research: c.research, source_url: c.source,
      notes: c.constructed ? 'Email constructed — please verify' : '',
      status: 'pending',
    });
    localPendingOut.push({ ...c, id });
    existingEmails.add(el); existingNames.add(nl);
  }
  if (skippedNoEmail) console.log(`Skipped ${skippedNoEmail} contact(s) with no email address`);

  let added = 0;
  try {
    added = await insertPendingContacts(toInsert);
  } catch (e) {
    console.error('Supabase insert error:', e.message);
  }

  state.scraped  = scraped;
  state.lastRun  = new Date().toISOString();
  state.lastTypes = [...enabledTypes];
  state.lastAddedCount = added;

  saveJSON(STATE_FILE, state);
  saveJSON(PENDING_FILE, localPendingOut); // local audit trail only
  console.log(`Done — added ${added} new contacts to Supabase pending_contacts (found ${toInsert.length} candidates)`);
}

main().catch(e => { console.error(e); process.exit(1); });
