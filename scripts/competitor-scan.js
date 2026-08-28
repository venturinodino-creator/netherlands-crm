/**
 * competitor-scan.js — Daily LeapSpace competitor scan
 * Calls the Claude API (web search tool) to research new AI solutions that
 * compete with Elsevier LeapSpace, and appends genuinely new findings to
 * data/leapspace-competitors.json. Entries are marked autoDiscovered: true
 * so the UI can flag them as not yet manually reviewed.
 *
 * Also writes data/leapspace-battlecard.json — a short "what they did" /
 * "how LeapSpace counters" write-up per tracked competitor, generated from
 * each entry's howItCompetes text (see generateBattleCard below). The
 * LeapSpace Insights page reads both files: this one supplies the AI copy,
 * the client decides which entries to actually surface (and in what order)
 * based on a threat score it computes itself — see index.html's
 * computeAutoThreat()/effectiveThreat(). Threat ranking isn't done here
 * because a user's manual threat overrides live in that browser's
 * localStorage, which this script has no access to.
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 * Run: node scripts/competitor-scan.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const DATA_FILE = 'data/leapspace-competitors.json';
const STATE_FILE = 'data/competitor-scan-state.json';
const BATTLECARD_FILE = 'data/leapspace-battlecard.json';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-opus-5';
const SYNTHESIS_MODEL = 'claude-haiku-4-5';
const CHUNK_SIZE = 8;

const VALID_ELEMENTS = new Set([
  'literatureSearch', 'authorSearch', 'fundingDiscovery', 'writingCoach',
  'trustClaimRadar', 'deepResearchReports', 'readingAssistant', 'compareFeature',
]);

const LEAPSPACE_CONTEXT = `LeapSpace is Elsevier's AI-assisted research workspace (launched Nov 2025), combining agentic AI, generative AI and retrieval-augmented generation over ScienceDirect/Scopus content. It has 8 named tabs/features:
1. Literature Search & Discovery — AI search returning structured, referenced answers
2. Author Search — finds collaborators, mentors, topic contributors
3. Funding Discovery — active/recurring funding opportunities from government/private funders
4. Writing Coach — private drafting workspace that pressure-tests claims and arguments
5. Trust Cards & Claim Radar — checks how a claim aligns with its sources and the wider research landscape
6. Deep Research Reports — longer-form analyses surfacing patterns, contradictions and evidence gaps
7. Reading Assistant — conversational Q&A grounded in one specific article or book chapter
8. Compare — side-by-side tables breaking down papers by goals, methods and results`;

function readJSON(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}
function saveJSON(path, data) {
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}
function makeId(company, product) {
  const slug = (company + '-' + product).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
  return 'auto-' + slug;
}
function extractText(response) {
  return (response.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function parseJSONL(text) {
  const items = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try { items.push(JSON.parse(trimmed)); } catch { /* skip malformed lines */ }
  }
  return items;
}

async function callClaude(existingProducts) {
  const prompt = `${LEAPSPACE_CONTEXT}

Search the web for AI-powered research tools/products (launched, updated, or newly relevant in roughly the last 30 days) that compete with one or more of LeapSpace's tabs above. Real competitors only — established companies or credible new launches, not speculative or unrelated tools.

Already-tracked products (do not repeat these unless reporting a significant new feature under a distinct product name):
${existingProducts.map(p => `- ${p.company}: ${p.product}`).join('\n') || '(none yet)'}

For each new competing solution you find, respond with one JSON object per line (JSONL), each with exactly these fields:
{"company": "...", "product": "...", "elements": ["literatureSearch"|"authorSearch"|"fundingDiscovery"|"writingCoach"|"trustClaimRadar"|"deepResearchReports"|"readingAssistant"|"compareFeature", ...], "howItCompetes": "2-4 factual sentences on what it does and which LeapSpace tab(s) it challenges", "sourceUrl": "...", "sourceName": "..."}

If you find nothing genuinely new and relevant, output nothing at all. Only report what your search actually surfaces with a verifiable source URL — never invent a product or a source.`;

  // A stalled connection here can otherwise hang the whole workflow run
  // indefinitely instead of failing fast — exactly what happened to
  // news-scan.js's relevance-filter call before it got the same guard (a
  // real ~20min hang in production, masked on some other repos only by an
  // invalid API key failing fast instead). 300s, not the 120s this guard
  // originally shipped with: an agentic Opus call making up to 8 web
  // searches legitimately runs past 2 minutes (a production run was
  // aborted at exactly 120s on 2026-08-28), and the timeout's job is to
  // catch a hung connection, not to race a healthy long call.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 300000);
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

// Pure synthesis over text this script already has — no web search needed,
// so this uses the cheaper/faster Haiku model rather than Opus (same split
// news-scan.js uses between discovery and its relevance-filter/overview
// calls).
async function callHaiku(prompt) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: SYNTHESIS_MODEL, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
      signal: ctrl.signal,
    });
  } catch (e) {
    console.warn(`[competitor-scan] Battle card request failed (${e.message}).`);
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    console.warn(`[competitor-scan] Battle card API call failed (HTTP ${res.status}).`);
    return null;
  }
  return extractText(await res.json());
}

function battleCardPrompt(batch) {
  return `${LEAPSPACE_CONTEXT}

For each competing solution below, write a short "battle card" entry for an Elsevier sales rep who needs to understand it in 10 seconds flat.

${batch.map((c, i) => `${i + 1}. ${c.company} — ${c.product} (matches: ${(c.elements || []).join(', ') || 'none tagged'})\n   ${c.howItCompetes}`).join('\n')}

Respond with ONLY a JSON array of exactly ${batch.length} objects, one per item in the same order, each exactly:
{"whatTheyDid": "1-2 punchy sentences restating the competitive move — what changed and why it matters, written for someone skimming fast", "counter": "1-2 sentences on how to position LeapSpace against this specific move — name the actual LeapSpace tab or strength to lead with (see the 8 tabs above), never a generic 'we're better' claim"}`;
}

// Generates whatTheyDid/counter copy for any tracked competitor that
// doesn't have it yet. Only backfills what's missing (same philosophy as
// news-scan.js's backfillAnalysis) rather than regenerating everything
// every run — keeps this cheap and keeps hand-edited howItCompetes text
// from being silently overwritten by a stale cached write-up. Threat
// ranking and which entries actually surface on the page are computed
// client-side (see the file header comment) — this just makes sure the
// copy exists for whichever candidates the client picks.
async function generateBattleCard(competitors) {
  const existing = readJSON(BATTLECARD_FILE, { generatedAt: null, entries: {} });
  const entries = existing.entries || {};

  const needsCard = competitors.filter(c => c.howItCompetes && !entries[c.id]);
  if (!needsCard.length) {
    console.log('[competitor-scan] Battle card up to date — nothing new to write up.');
    return;
  }
  console.log(`[competitor-scan] Writing battle card copy for ${needsCard.length} competitor(s)...`);

  for (let i = 0; i < needsCard.length; i += CHUNK_SIZE) {
    const chunk = needsCard.slice(i, i + CHUNK_SIZE);
    const text = await callHaiku(battleCardPrompt(chunk));
    if (text === null) continue;
    let parsed;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      console.warn('[competitor-scan] Could not parse battle card response for a chunk — skipping it.');
      continue;
    }
    if (!Array.isArray(parsed) || parsed.length < chunk.length) {
      console.warn(`[competitor-scan] Battle card call returned ${Array.isArray(parsed) ? parsed.length : 0}/${chunk.length} for a chunk — the rest will retry next run.`);
    }
    chunk.forEach((c, idx) => {
      const v = parsed && parsed[idx];
      if (v && v.whatTheyDid && v.counter) {
        entries[c.id] = {
          whatTheyDid: String(v.whatTheyDid).slice(0, 400),
          counter: String(v.counter).slice(0, 400),
        };
      }
    });
    if (i + CHUNK_SIZE < needsCard.length) await sleep(1500);
  }

  saveJSON(BATTLECARD_FILE, { generatedAt: new Date().toISOString(), entries });
}

async function main() {
  if (!API_KEY) {
    // Not configured yet — log clearly but don't fail the workflow run over it.
    console.log('[competitor-scan] ANTHROPIC_API_KEY not set — skipping scan until it is configured.');
    saveJSON(STATE_FILE, { lastRun: new Date().toISOString(), lastAddedCount: 0, error: 'missing_api_key' });
    return;
  }

  const competitors = readJSON(DATA_FILE, []);
  const existingIds = new Set(competitors.map(c => c.id));

  console.log('[competitor-scan] Calling Claude with web search...');
  // Discovery failing (timeout, transient API error) shouldn't kill the
  // whole run: battle-card generation is a separate, much cheaper call
  // that can and should still complete and be committed — discovery
  // self-heals on tomorrow's scheduled run anyway. The error is still
  // recorded in the state file and surfaced as a workflow warning.
  let response = null;
  try {
    response = await callClaude(competitors);
  } catch (e) {
    console.warn(`[competitor-scan] Discovery call failed (${e.message}) — skipping discovery this run, continuing to battle-card generation.`);
    console.log(`::warning::competitor-scan discovery call failed (${e.message}); no new competitors this run, battle-card copy still refreshed.`);
    await generateBattleCard(competitors);
    saveJSON(STATE_FILE, { lastRun: new Date().toISOString(), lastAddedCount: 0, error: `discovery: ${e.message}` });
    return;
  }

  if (response.stop_reason === 'refusal') {
    console.log('[competitor-scan] Request was declined by safety classifiers — no results this run.');
    // Still worth backfilling battle-card copy for whatever's already
    // tracked — the refusal only affects this run's discovery step.
    await generateBattleCard(competitors);
    saveJSON(STATE_FILE, { lastRun: new Date().toISOString(), lastAddedCount: 0, refused: true });
    return;
  }

  const text = extractText(response);
  const found = parseJSONL(text);
  console.log(`[competitor-scan] Model returned ${found.length} candidate(s).`);

  let added = 0;
  for (const item of found) {
    if (!item.company || !item.product || !item.sourceUrl) continue;
    const id = makeId(item.company, item.product);
    if (existingIds.has(id)) continue;
    const elements = Array.isArray(item.elements) ? item.elements.filter(e => VALID_ELEMENTS.has(e)) : [];
    competitors.push({
      id,
      company: String(item.company).slice(0, 120),
      product: String(item.product).slice(0, 200),
      addedDate: new Date().toISOString().slice(0, 10),
      elements,
      howItCompetes: String(item.howItCompetes || '').slice(0, 800),
      sourceUrl: String(item.sourceUrl).slice(0, 500),
      sourceName: String(item.sourceName || item.company).slice(0, 150),
      autoDiscovered: true,
    });
    existingIds.add(id);
    added++;
    console.log(`  + ${item.company}: ${item.product}`);
  }

  if (added > 0) saveJSON(DATA_FILE, competitors);

  await generateBattleCard(competitors);

  saveJSON(STATE_FILE, {
    lastRun: new Date().toISOString(),
    lastAddedCount: added,
    lastCandidateCount: found.length,
  });
  console.log(`[competitor-scan] Done — ${added} new competitor(s) added.`);
}

main().catch(e => {
  console.error('[competitor-scan] Failed:', e.message);
  try {
    saveJSON(STATE_FILE, { lastRun: new Date().toISOString(), lastAddedCount: 0, error: e.message });
  } catch { /* ignore */ }
  process.exit(1);
});
