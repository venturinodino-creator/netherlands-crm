/**
 * openalex-subscription-scan.js — Daily OpenAlex subscription intelligence scan
 * Calls the xAI Grok API (web_search tool, via the /v1/responses endpoint) to
 * research public evidence — institution library pages, press releases, blog
 * posts, OpenAlex's own Community Advisory Board notes — that a Netherlands
 * research institution has subscribed to OpenAlex (Member / Member+ / Partner
 * tier), and critically, what it is paying and when the subscription was
 * announced/took effect. Genuinely new or updated findings are appended to
 * data/openalex-subscriptions.json, tagged autoDiscovered: true so the UI can
 * flag them as not yet manually reviewed.
 *
 * Requires XAI_API_KEY in the environment (a key from console.x.ai).
 * Run: node scripts/openalex-subscription-scan.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const DATA_FILE = 'data/openalex-subscriptions.json';
const STATE_FILE = 'data/openalex-scan-state.json';
const API_KEY = process.env.XAI_API_KEY;
const MODEL = process.env.XAI_MODEL || 'grok-4.6';

// The Netherlands institutions this CRM tracks — kept in sync with SEED_INSTITUTIONS
// in index.html. Used to focus the search and to let the model flag status changes
// for institutions we already have an opinion on, not just brand-new subscribers.
const NL_INSTITUTIONS = [
  'Eindhoven University of Technology (TU/e)', 'Erasmus University Rotterdam', 'Leiden University',
  'Maastricht University', 'Open Universiteit', 'Radboud University', 'Tilburg University', 'TU Delft',
  'University of Amsterdam (UvA)', 'University of Groningen', 'University of Twente', 'Utrecht University',
  'VU Amsterdam', 'Wageningen University & Research',
  'Amsterdam UMC', 'Erasmus MC', 'UMC Utrecht', 'University Medical Center Groningen (UMCG)',
  'Radboudumc', 'Maastricht UMC+', 'Leiden University Medical Centre (LUMC)',
  'Netherlands Cancer Institute (NKI)', 'Princess Máxima Center', 'Máxima Medical Centre',
  'Sanquin Research', 'Amsterdam Institute for Global Health and Development (AIGHD)',
  'Dutch Research Council (NWO)', 'Royal Netherlands Academy of Arts and Sciences (KNAW)',
  'TNO', 'Centrum Wiskunde & Informatica (CWI)', 'Netherlands eScience Center',
  'Netherlands Institute for Neuroscience', 'Nikhef', 'RIVM', 'ASTRON', 'NIOZ', 'KNMI',
  'Naturalis Biodiversity Center', 'NLR — Netherlands Aerospace Centre',
  'PBL Environmental Assessment Agency', 'CPB Bureau for Economic Policy Analysis',
  'Rathenau Institute', 'SCP', 'Clingendael Institute', 'HiiL',
];

function readJSON(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}
function saveJSON(path, data) {
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}
function slugify(s) {
  return String(s).toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}
function extractText(response) {
  // Prefer the Responses API convenience field if present.
  if (typeof response.output_text === 'string') return response.output_text;
  // Otherwise walk output[].content[] for output_text/text items — defensive
  // about minor shape differences since this is unofficial-doc-derived parsing.
  const chunks = [];
  for (const item of response.output || []) {
    for (const part of item.content || []) {
      if (typeof part.text === 'string') chunks.push(part.text);
    }
  }
  return chunks.join('\n');
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

async function callGrok(existing) {
  const known = existing.map(e => `- ${e.inst}: ${e.status}${e.tier ? ' (' + e.tier + (e.annualFee ? ', ' + e.annualFee : '') + ')' : ''}`).join('\n') || '(none tracked yet)';

  const prompt = `You are researching OpenAlex (the open scholarly metadata index run by OurResearch) subscription status for Netherlands research institutions, for a sales-intelligence CRM used by a competing publisher.

OpenAlex has four tiers: Free/API ($1/day rate-limited), Member ($5,000/yr — admin dashboard, affiliation editor, unsub access), Member+ ($20,000/yr — increased API quotas, consulting hours), and Partner (custom pricing — product roadmap influence, dedicated support).

Institutions this CRM tracks, with what we currently know:
${known}

Search the web (institution library pages and news sections, press releases, procurement/tender notices, OpenAlex's own blog and Community Advisory Board notes on GitHub, LinkedIn posts from library staff, relevant EU/NL open-science coverage) for CURRENT, VERIFIABLE evidence of:
1. Any of the above institutions confirming an OpenAlex Member/Member+/Partner subscription that we don't already have correctly recorded above (a new subscriber, a status upgrade, or a previously-unconfirmed price now disclosed).
2. Any Dutch university, medical centre, or research institute NOT in the list above that has confirmed an OpenAlex subscription.

The price/fee and the announcement or effective date are the most important facts to capture — always include them if the source states them, and say "not disclosed" if the source confirms a subscription but not the amount. Do not guess a price.

For each genuinely new or updated finding, respond with one JSON object per line (JSONL), each with exactly these fields:
{"inst": "institution name", "type": "University"|"Medical Centre"|"NGO / Funder"|"NGO / Research", "status": "subscriber"|"active", "tier": "Member"|"Member+"|"Partner"|null, "annualFee": "e.g. $5,000 USD / year, or Custom — price not disclosed, or null if status is not subscriber", "announceDate": "YYYY-MM-DD or null", "effectiveDate": "YYYY-MM-DD or null", "notes": "2-4 factual sentences: what was confirmed, by whom, and any related signal like a Scopus/Web of Science cancellation", "signal": "one short sentence for a table cell, e.g. 'CONFIRMED PAYING. Member tier at $5,000/yr, effective March 2026.'", "sourceUrl": "...", "sourceName": "..."}

Use status "active" only for an institution publicly and substantially engaging with OpenAlex (e.g. built a library guide on it, cancelled Scopus/WoS explicitly citing OpenAlex as the replacement) without a confirmed paid subscription. Only report what your search actually surfaces with a verifiable source URL — never invent a subscription, a price, or a source. If you find nothing genuinely new, output nothing at all.`;

  const res = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: [{ role: 'user', content: prompt }],
      tools: [{ type: 'web_search' }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`xAI API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

async function main() {
  if (!API_KEY) {
    console.log('[openalex-subscription-scan] XAI_API_KEY not set — skipping scan until it is configured.');
    saveJSON(STATE_FILE, { lastRun: new Date().toISOString(), lastAddedCount: 0, error: 'missing_api_key' });
    return;
  }

  const entries = readJSON(DATA_FILE, []);
  const byId = new Map(entries.map(e => [e.id, e]));

  console.log(`[openalex-subscription-scan] Calling Grok with web search across ${NL_INSTITUTIONS.length} tracked institutions...`);
  const response = await callGrok(entries);

  const text = extractText(response);
  if (!text) {
    console.log('[openalex-subscription-scan] No text in response — raw shape:', JSON.stringify(response).slice(0, 800));
  }
  const found = parseJSONL(text);
  console.log(`[openalex-subscription-scan] Model returned ${found.length} candidate(s).`);

  let added = 0, updated = 0;
  for (const item of found) {
    if (!item.inst || !item.status || !item.sourceUrl) continue;
    const id = slugify(item.inst);
    const record = {
      id,
      inst: String(item.inst).slice(0, 150),
      type: ['University', 'Medical Centre', 'NGO / Funder', 'NGO / Research'].includes(item.type) ? item.type : 'University',
      status: ['subscriber', 'active'].includes(item.status) ? item.status : 'active',
      tier: item.tier ? String(item.tier).slice(0, 60) : null,
      annualFee: item.annualFee ? String(item.annualFee).slice(0, 150) : null,
      announceDate: /^\d{4}-\d{2}-\d{2}$/.test(item.announceDate) ? item.announceDate : null,
      effectiveDate: /^\d{4}-\d{2}-\d{2}$/.test(item.effectiveDate) ? item.effectiveDate : null,
      notes: String(item.notes || '').slice(0, 800),
      signal: String(item.signal || item.notes || '').slice(0, 400),
      sources: [{ label: String(item.sourceName || item.inst).slice(0, 150), url: String(item.sourceUrl).slice(0, 500) }],
      autoDiscovered: true,
      foundDate: new Date().toISOString().slice(0, 10),
    };

    const prior = byId.get(id);
    if (!prior) {
      entries.push(record);
      byId.set(id, record);
      added++;
      console.log(`  + ${record.inst}: ${record.status}${record.tier ? ' (' + record.tier + ')' : ''}`);
    } else if (prior.status !== record.status || prior.annualFee !== record.annualFee || prior.tier !== record.tier) {
      // Keep manually-reviewed source history, but let a status/price upgrade through.
      Object.assign(prior, record, { sources: [...(prior.sources || []), ...record.sources] });
      updated++;
      console.log(`  ~ ${record.inst}: updated to ${record.status}${record.tier ? ' (' + record.tier + ')' : ''}`);
    }
  }

  if (added > 0 || updated > 0) saveJSON(DATA_FILE, entries);

  saveJSON(STATE_FILE, {
    lastRun: new Date().toISOString(),
    lastAddedCount: added,
    lastUpdatedCount: updated,
    lastCandidateCount: found.length,
  });
  console.log(`[openalex-subscription-scan] Done — ${added} new, ${updated} updated.`);
}

main().catch(e => {
  console.error('[openalex-subscription-scan] Failed:', e.message);
  try {
    saveJSON(STATE_FILE, { lastRun: new Date().toISOString(), lastAddedCount: 0, error: e.message });
  } catch { /* ignore */ }
  process.exit(1);
});
