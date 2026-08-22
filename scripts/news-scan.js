/**
 * news-scan.js — Daily Netherlands research news scan. Free, zero-API-key:
 * queries Google News RSS directly (per institution, per category) and
 * keyword-filters the results against tracked SEED_INSTITUTIONS. Runs
 * server-side (GitHub Actions) instead of client-side, since a browser can't
 * fetch news.google.com directly (CORS) without a proxy. No AI summarization
 * or relevance judgment — reports raw matching headlines, keyword-
 * categorized, for a human to skim.
 *
 * Run: node scripts/news-scan.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const DATA_FILE = 'data/news.json';
const STATE_FILE = 'data/news-scan-state.json';
const MAX_STORED_ARTICLES = 300;
const MAX_AGE_DAYS = 14;
const REQUEST_DELAY_MS = 350;

// Keep in sync with SEED_INSTITUTIONS in index.html
const NL_UNIVERSITIES = [
  'University of Amsterdam', 'VU Amsterdam', 'Erasmus University Rotterdam',
  'Utrecht University', 'Leiden University', 'University of Groningen',
  'Radboud University', 'TU Delft', 'Eindhoven University of Technology',
  'University of Twente', 'Tilburg University', 'Maastricht University',
  'Wageningen University & Research', 'Open Universiteit',
];
const NL_MEDICAL = [
  'Amsterdam UMC', 'Erasmus MC', 'UMC Utrecht', 'Leiden University Medical Centre',
  'University Medical Centre Groningen', 'Radboudumc', 'Maastricht UMC+',
  'Princess Máxima Center', 'Netherlands Cancer Institute', 'Máxima Medical Centre',
  'Sanquin Research', 'Amsterdam Institute for Global Health and Development',
];
const NL_RESEARCH = [
  'Dutch Research Council', 'TNO', 'Royal Netherlands Academy of Arts and Sciences',
  'Hubrecht Institute', 'Netherlands Institute for Neuroscience', 'RIVM',
  'Centrum Wiskunde & Informatica', 'Netherlands eScience Center', 'Deltares',
  'SRON Netherlands Institute for Space Research', 'Nikhef',
  'ASTRON', 'NIOZ Royal Netherlands Institute for Sea Research',
  'KNMI', 'Naturalis Biodiversity Center', 'NLR Netherlands Aerospace Centre',
  'PBL Netherlands Environmental Assessment Agency', 'CPB Netherlands Bureau for Economic Policy Analysis',
  'Rathenau Institute', 'SCP Netherlands Institute for Social Research',
];
const ALL_INSTITUTIONS = [...NL_UNIVERSITIES, ...NL_MEDICAL, ...NL_RESEARCH];

const CATEGORIES = [
  {
    key: 'ai_adoption',
    label: 'AI Development & Adoption',
    perInstitution: true,
    queryFor: (inst) => `"${inst}" (AI OR "artificial intelligence" OR "machine learning")`,
  },
  {
    key: 'funding',
    label: 'Funding Received',
    perInstitution: true,
    queryFor: (inst) => `"${inst}" (funding OR grant OR subsidy OR million OR investment)`,
  },
  {
    key: 'policy',
    label: 'Netherlands Research Policy',
    perInstitution: false,
    queries: [
      'Netherlands research funding policy OCW',
      'Netherlands universities "open access" OR "open science" policy',
      'Netherlands research assessment reform',
      'Netherlands science visa researchers immigration policy',
    ],
  },
];

function readJSON(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}
function saveJSON(path, data) {
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}
function makeId(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) { hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0; }
  return 'news-' + Math.abs(hash).toString(36);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function decodeEntities(s) {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
function stripCdata(s) {
  const m = String(s || '').match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return decodeEntities(m ? m[1] : s);
}

// Minimal RSS 2.0 <item> parser via regex — Google News RSS is well-formed
// enough that a full XML parser isn't worth the extra dependency.
function parseRssItems(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks) {
    const title = stripCdata((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const link = stripCdata((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
    const pubDate = stripCdata((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]);
    const source = stripCdata((block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1]);
    const description = stripCdata((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1]);
    if (title && link) items.push({ title, link, pubDate, source, description });
  }
  return items;
}

async function fetchGoogleNewsRss(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=NL&ceid=NL:en`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NL-CRM-NewsBot/1.0; +mailto:venturino.dino@gmail.com)' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseRssItems(xml);
  } catch (e) {
    clearTimeout(timer);
    console.warn(`  ! RSS fetch failed for "${query}": ${e.message}`);
    return [];
  }
}

function isRecent(pubDate) {
  if (!pubDate) return true; // don't drop items Google didn't date
  const d = new Date(pubDate);
  if (isNaN(d)) return true;
  return (Date.now() - d.getTime()) / 86400000 <= MAX_AGE_DAYS;
}

function toISODate(pubDate) {
  const d = new Date(pubDate);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

async function main() {
  const articles = readJSON(DATA_FILE, []);
  const existingUrls = new Set(articles.map(a => a.url));
  const candidateCounts = {};
  let totalAdded = 0;

  for (const category of CATEGORIES) {
    console.log(`[news-scan] Searching: ${category.label}...`);
    let categoryCandidates = 0;

    const jobs = category.perInstitution
      ? ALL_INSTITUTIONS.map(inst => ({ inst, query: category.queryFor(inst) }))
      : category.queries.map(q => ({ inst: null, query: q }));

    for (const job of jobs) {
      const items = await fetchGoogleNewsRss(job.query);
      await sleep(REQUEST_DELAY_MS);
      categoryCandidates += items.length;

      for (const item of items) {
        if (!isRecent(item.pubDate)) continue;
        if (existingUrls.has(item.link)) continue;
        // For per-institution queries, require the institution name to actually
        // appear in the title/description — Google News RSS relevance ranking is loose.
        if (job.inst && !new RegExp(job.inst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(item.title + ' ' + item.description)) {
          continue;
        }

        articles.unshift({
          id: makeId(item.link),
          title: String(item.title).slice(0, 200),
          description: String(item.description || '').replace(/<[^>]*>/g, '').slice(0, 400),
          institution: job.inst,
          category: category.key,
          categoryLabel: category.label,
          url: String(item.link).slice(0, 500),
          sourceName: String(item.source || '').slice(0, 150),
          publishedDate: toISODate(item.pubDate),
          foundDate: new Date().toISOString().slice(0, 10),
          autoDiscovered: true,
        });
        existingUrls.add(item.link);
        totalAdded++;
        console.log(`  + [${category.key}] ${item.title}`);
      }
    }
    candidateCounts[category.key] = categoryCandidates;
  }

  const trimmed = articles.slice(0, MAX_STORED_ARTICLES);
  if (totalAdded > 0) saveJSON(DATA_FILE, trimmed);

  saveJSON(STATE_FILE, {
    lastRun: new Date().toISOString(),
    lastAddedCount: totalAdded,
    candidateCounts,
    source: 'Google News RSS (free, no API key)',
  });
  console.log(`[news-scan] Done — ${totalAdded} new article(s) added.`);
}

main().catch(e => {
  console.error('[news-scan] Failed:', e.message);
  try {
    saveJSON(STATE_FILE, { lastRun: new Date().toISOString(), lastAddedCount: 0, error: e.message });
  } catch { /* ignore */ }
  process.exit(1);
});
