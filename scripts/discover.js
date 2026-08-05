import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const PENDING_FILE = 'data/pending-contacts.json';
const STATE_FILE   = 'data/discovery-state.json';
const TARGET = 20;

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

// ── CWI ──────────────────────────────────────────────────────────────────────
async function scrapeCWI(scraped, needed) {
  const contacts = [];
  const done = scraped.cwi || [];
  for (let page = 1; page <= 30 && contacts.length < needed; page++) {
    const listUrl = `https://www.cwi.nl/en/people/?page=${page}`;
    if (done.includes(listUrl)) continue;
    const html = await get(listUrl);
    if (!html || !html.includes('/en/people/')) break;
    const profiles = [...new Set(
      [...html.matchAll(/href="(\/en\/people\/[a-z0-9-]+\/)"/g)].map(m => 'https://www.cwi.nl' + m[1])
    )];
    if (profiles.length === 0) break;
    for (const url of profiles) {
      if (contacts.length >= needed) break;
      if (done.includes(url)) continue;
      const p = await get(url);
      if (!p) { done.push(url); continue; }
      const nameM = p.match(/<h1[^>]*>([^<]+)<\/h1>/);
      if (!nameM) { done.push(url); continue; }
      const full = nameM[1].trim().replace(/\s+/g,' ');
      const parts = full.split(' ');
      if (parts.length < 2) { done.push(url); continue; }
      const first = parts[0], last = parts.slice(1).join(' ');
      const emailM = p.match(/([a-zA-Z][a-zA-Z0-9._+-]*@cwi\.nl)/i);
      const titleM = p.match(/class="[^"]*(?:position|function|title|role)[^"]*"[^>]*>([^<]{3,80})</i);
      done.push(url);
      contacts.push({ first, last, title: titleM?.[1]?.trim() || 'Researcher', dept: 'Mathematics & Computer Science', email: emailM?.[1]?.toLowerCase() || '', instId: 'cwi', source: url });
    }
    done.push(listUrl);
  }
  scraped.cwi = done;
  return contacts;
}

// ── eScience Center ───────────────────────────────────────────────────────────
async function scrapeEScience(scraped, needed) {
  const contacts = [];
  const done = scraped.esc || [];
  const url = 'https://www.esciencecenter.nl/team/';
  if (done.includes(url)) return contacts;
  const html = await get(url);
  if (!html) { done.push(url); scraped.esc = done; return contacts; }
  const cards = [...html.matchAll(/<(?:h[23]|div)[^>]*class="[^"]*(?:name|title)[^"]*"[^>]*>([^<]{4,60})<\/(?:h[23]|div)>/gi)];
  const seen = new Set();
  for (const m of cards) {
    if (contacts.length >= needed) break;
    const full = m[1].trim().replace(/\s+/g,' ');
    if (seen.has(full) || full.length < 5) continue;
    seen.add(full);
    const parts = full.split(' ');
    if (parts.length < 2) continue;
    const first = parts[0], last = parts.slice(1).join(' ');
    const slug = first.toLowerCase() + '.' + last.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z-]/g,'');
    contacts.push({ first, last, title: 'Research Software Engineer', dept: 'eScience Engineering', email: `${slug}@esciencecenter.nl`, instId: 'esc', source: url });
  }
  done.push(url);
  scraped.esc = done;
  return contacts;
}

// ── PBL ──────────────────────────────────────────────────────────────────────
async function scrapePBL(scraped, needed) {
  const contacts = [];
  const done = scraped.pbl || [];
  const urls = ['https://www.pbl.nl/en/about-pbl/staff', 'https://www.pbl.nl/over-pbl/medewerkers'];
  for (const url of urls) {
    if (done.includes(url) || contacts.length >= needed) continue;
    const html = await get(url);
    if (!html) { done.push(url); continue; }
    const emails = [...new Set([...html.matchAll(/([a-zA-Z][a-zA-Z0-9._+-]*@pbl\.nl)/gi)].map(m => m[1].toLowerCase()))];
    for (const email of emails) {
      if (contacts.length >= needed) break;
      const name = email.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      const parts = name.split(' ');
      if (parts.length < 2) continue;
      contacts.push({ first: parts[0], last: parts.slice(1).join(' '), title: 'Researcher', dept: 'Environmental Research', email, instId: 'pbl', source: url });
    }
    done.push(url);
  }
  scraped.pbl = done;
  return contacts;
}

// ── Rathenau ──────────────────────────────────────────────────────────────────
async function scrapeRathenau(scraped, needed) {
  const contacts = [];
  const done = scraped.rathenau || [];
  const urls = [
    'https://www.rathenau.nl/en/about-rathenau-instituut/people',
    'https://www.rathenau.nl/nl/over-rathenau/medewerkers'
  ];
  for (const url of urls) {
    if (done.includes(url) || contacts.length >= needed) continue;
    const html = await get(url);
    if (!html) { done.push(url); continue; }
    const emails = [...new Set([...html.matchAll(/([a-zA-Z][a-zA-Z0-9._+-]*@rathenau\.nl)/gi)].map(m => m[1].toLowerCase()))];
    for (const email of emails) {
      if (contacts.length >= needed) break;
      const name = email.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      const parts = name.split(' ');
      if (parts.length < 2) continue;
      contacts.push({ first: parts[0], last: parts.slice(1).join(' '), title: 'Researcher', dept: 'Science & Technology Studies', email, instId: 'rathenau', source: url });
    }
    done.push(url);
  }
  scraped.rathenau = done;
  return contacts;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const state   = readJSON(STATE_FILE,   { scraped: {}, lastRun: null });
  const pending = readJSON(PENDING_FILE, []);
  const existEmails = new Set(pending.map(c=>(c.email||'').toLowerCase()).filter(Boolean));
  const existNames  = new Set(pending.map(c=>`${c.first} ${c.last}`.toLowerCase()).filter(Boolean));

  // Reset scraped state if all sources exhausted
  const s = state.scraped;
  if ((s.cwi?.length||0)>60 && (s.esc?.length||0)>0 && (s.pbl?.length||0)>0 && (s.rathenau?.length||0)>0) {
    console.log('Full cycle done — resetting scrape state');
    state.scraped = {};
  }

  const raw = [];
  raw.push(...await scrapeCWI(state.scraped, 12));        console.log(`CWI: ${raw.length}`);
  const e = await scrapeEScience(state.scraped, 4);       raw.push(...e); console.log(`eScience: ${e.length}`);
  const p = await scrapePBL(state.scraped, 2);            raw.push(...p); console.log(`PBL: ${p.length}`);
  const r = await scrapeRathenau(state.scraped, 2);       raw.push(...r); console.log(`Rathenau: ${r.length}`);

  let added = 0;
  for (const c of raw) {
    const el = (c.email||'').toLowerCase();
    const nl = `${c.first} ${c.last}`.toLowerCase();
    if (el && existEmails.has(el)) continue;
    if (existNames.has(nl)) continue;
    pending.push({ ...c, id: makeId(c.instId), status:'prospect', priority:'medium', quality:'seed', lastContact:'',
      notes: `Source: ${c.source} | Discovered: ${new Date().toISOString().slice(0,10)}` });
    existEmails.add(el); existNames.add(nl); added++;
  }

  state.lastRun = new Date().toISOString();
  saveJSON(PENDING_FILE, pending);
  saveJSON(STATE_FILE,   state);
  console.log(`\nDone: +${added} contacts. Total pending: ${pending.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
