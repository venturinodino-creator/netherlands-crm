/**
 * news-scan.js — Daily Netherlands research news scan
 * Calls the Claude API (web search tool) to find recent news specifically
 * naming the CRM's tracked Dutch institutions — AI development/adoption,
 * funding received, and Netherlands research policy — and writes findings
 * to data/news.json.
 *
 * Replaces the old client-side approach (scraping Google News RSS from the
 * browser via a public CORS proxy), which broke when news.google.com started
 * rate-limiting/blocking proxy traffic outright.
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 * Run: node scripts/news-scan.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const DATA_FILE = 'data/news.json';
const STATE_FILE = 'data/news-scan-state.json';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-opus-5';
const MAX_STORED_ARTICLES = 300;

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
  'Dutch Research Council (NWO)', 'TNO', 'Royal Netherlands Academy of Arts and Sciences (KNAW)',
  'Hubrecht Institute', 'Netherlands Institute for Neuroscience', 'RIVM',
  'Centrum Wiskunde & Informatica (CWI)', 'Netherlands eScience Center', 'Deltares',
  'SRON Netherlands Institute for Space Research', 'Nikhef',
  'ASTRON — Netherlands Institute for Radio Astronomy', 'NIOZ Royal Netherlands Institute for Sea Research',
  'KNMI', 'Naturalis Biodiversity Center', 'NLR — Netherlands Aerospace Centre',
  'PBL Netherlands Environmental Assessment Agency', 'CPB Netherlands Bureau for Economic Policy Analysis',
  'Rathenau Institute', 'SCP — Netherlands Institute for Social Research',
];
const ALL_INSTITUTIONS = [...NL_UNIVERSITIES, ...NL_MEDICAL, ...NL_RESEARCH];

const CATEGORIES = [
  {
    key: 'ai_adoption',
    label: 'AI Development & Adoption',
    instructions: `Search for recent (last ~14 days) news specifically about ONE of these named Dutch institutions developing, piloting, adopting, or announcing an AI system, tool, or AI-driven research initiative. The article MUST name one of these institutions specifically — do NOT include generic "Netherlands AI" stories that don't name one of them:\n${ALL_INSTITUTIONS.join(', ')}`,
  },
  {
    key: 'funding',
    label: 'Funding Received',
    instructions: `Search for recent (last ~14 days) news about ONE of these named Dutch institutions receiving a research grant, subsidy, or funding award — from NWO, ZonMw, the EU, a foundation, or any other funder. The article MUST name the specific institution, and should mention the amount if reported:\n${ALL_INSTITUTIONS.join(', ')}`,
  },
  {
    key: 'policy',
    label: 'Netherlands Research Policy',
    instructions: `Search for recent (last ~14 days) Netherlands national government or ministry (OCW) policy news affecting higher education and research institutions generally — research funding policy changes, open access/open science mandates, research assessment reform, science/immigration visa policy for researchers, or similar national-level policy affecting Dutch universities and research institutes. This category does not need to name one specific institution.`,
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
function extractText(response) {
  return (response.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}
function parseJSONL(text) {
  const items = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try { items.push(JSON.parse(trimmed)); } catch { /* skip malformed lines */ }
  }
  return items;
}

async function callClaude(category, existingUrls) {
  const prompt = `You are researching Netherlands academic/research institution news for a CRM used by an Elsevier sales team that tracks these institutions.

${category.instructions}

Already covered — do not repeat these URLs:
${[...existingUrls].slice(0, 80).join('\n') || '(none yet)'}

For each genuinely new, on-topic article you find, respond with one JSON object per line (JSONL), each with exactly these fields:
{"title": "...", "description": "one to two factual sentences summarizing the article", "institution": "the specific named institution this is about, or null if a general policy story", "url": "...", "sourceName": "...", "publishedDate": "YYYY-MM-DD if known, else null"}

Only report real articles with a verifiable source URL you found via search — never invent a title, institution, or URL. If you find nothing genuinely new and on-topic, output nothing at all.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 10 }],
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

async function main() {
  if (!API_KEY) {
    console.log('[news-scan] ANTHROPIC_API_KEY not set — skipping scan until it is configured.');
    saveJSON(STATE_FILE, { lastRun: new Date().toISOString(), lastAddedCount: 0, error: 'missing_api_key' });
    return;
  }

  const articles = readJSON(DATA_FILE, []);
  const existingUrls = new Set(articles.map(a => a.url));
  const candidateCounts = {};
  let totalAdded = 0;

  for (const category of CATEGORIES) {
    console.log(`[news-scan] Searching: ${category.label}...`);
    let response;
    try {
      response = await callClaude(category, existingUrls);
    } catch (e) {
      console.error(`[news-scan] ${category.label} failed:`, e.message);
      candidateCounts[category.key] = 0;
      continue;
    }

    if (response.stop_reason === 'refusal') {
      console.log(`[news-scan] ${category.label}: request declined by safety classifiers — no results this run.`);
      candidateCounts[category.key] = 0;
      continue;
    }

    const text = extractText(response);
    const found = parseJSONL(text);
    candidateCounts[category.key] = found.length;
    console.log(`[news-scan] ${category.label}: model returned ${found.length} candidate(s).`);

    for (const item of found) {
      if (!item.title || !item.url) continue;
      if (existingUrls.has(item.url)) continue;
      articles.unshift({
        id: makeId(item.url),
        title: String(item.title).slice(0, 200),
        description: String(item.description || '').slice(0, 400),
        institution: item.institution ? String(item.institution).slice(0, 150) : null,
        category: category.key,
        categoryLabel: category.label,
        url: String(item.url).slice(0, 500),
        sourceName: String(item.sourceName || '').slice(0, 150),
        publishedDate: item.publishedDate || null,
        foundDate: new Date().toISOString().slice(0, 10),
        autoDiscovered: true,
      });
      existingUrls.add(item.url);
      totalAdded++;
      console.log(`  + [${category.key}] ${item.title}`);
    }
  }

  const trimmed = articles.slice(0, MAX_STORED_ARTICLES);
  if (totalAdded > 0) saveJSON(DATA_FILE, trimmed);

  saveJSON(STATE_FILE, {
    lastRun: new Date().toISOString(),
    lastAddedCount: totalAdded,
    candidateCounts,
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
