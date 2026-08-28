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
// Board-facing views (the executive summary, "This Week's Read", the threat
// leaderboard) should only ever describe genuinely current competitive
// moves — never an old launch that just happens to look "recent" because
// of when this CRM's scan discovered it. eventDate carries the actual
// launch/update date so that distinction is possible at all; addedDate
// only ever means "when we started tracking this," which is not the same
// fact. Everything before the cutoff is still visible in the full
// tracked-solution list/matrix — it's just excluded from anything framed
// as current.
const RECENCY_CUTOFF = '2026-07-01';

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
{"company": "...", "product": "...", "elements": ["literatureSearch"|"authorSearch"|"fundingDiscovery"|"writingCoach"|"trustClaimRadar"|"deepResearchReports"|"readingAssistant"|"compareFeature", ...], "howItCompetes": "2-4 factual sentences on what it does and which LeapSpace tab(s) it challenges", "eventDate": "YYYY-MM-DD — the actual date this launched or shipped the update you're describing, not today's date; use the first of the month if only a month is known", "sourceUrl": "...", "sourceName": "..."}

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

// Recovers eventDate for entries tracked before that field existed (or a
// manual "+ Add Insight" entry, which never asks for one). Extraction only
// — no web search — reading the actual date out of text this script
// already has (product name, howItCompetes) via Haiku, so it's cheap
// enough to run over the whole backlog at once rather than backfilling
// gradually. A date the model can't find (or won't commit to) stays null;
// computeAutoThreat's caller falls back to addedDate in that case, and the
// entry just won't be treated as provably current.
async function backfillEventDates(competitors) {
  const needsDate = competitors.filter(c => !c.eventDate && !c.eventDateUnknown && (c.howItCompetes || c.product));
  if (!needsDate.length) return false;
  console.log(`[competitor-scan] Backfilling event dates for ${needsDate.length} competitor(s)...`);

  const byId = new Map(competitors.map(c => [c.id, c]));
  let changed = false;
  for (let i = 0; i < needsDate.length; i += CHUNK_SIZE) {
    const chunk = needsDate.slice(i, i + CHUNK_SIZE);
    const prompt = `Today's date is ${new Date().toISOString().slice(0, 10)}. For each AI research tool below, find the actual date it launched or shipped the specific update described — look for a date, month, or season mentioned in the text itself (e.g. "Dec 2025 update", "launched in November").

${chunk.map((c, idx) => `${idx + 1}. ${c.company} — ${c.product}\n   ${c.howItCompetes || '(no description)'}`).join('\n')}

Respond with ONLY a JSON array of exactly ${chunk.length} objects, one per item in the same order, each exactly:
{"eventDate": "YYYY-MM-DD if a date/month is clearly stated or strongly implied by the text (use the 1st of the month when only a month is known), or null if genuinely undeterminable — never guess"}`;

    const text = await callHaiku(prompt);
    if (text === null) continue;
    let parsed;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      console.warn('[competitor-scan] Could not parse event-date backfill response for a chunk — skipping it.');
      continue;
    }
    chunk.forEach((c, idx) => {
      const v = parsed && parsed[idx];
      const d = v && v.eventDate;
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        byId.get(c.id).eventDate = d;
        changed = true;
      } else {
        // Explicit false, not left undefined — so this entry isn't
        // re-sent to the model on every future run just because
        // eventDate is still null.
        byId.get(c.id).eventDateUnknown = true;
      }
    });
    if (i + CHUNK_SIZE < needsDate.length) await sleep(1500);
  }
  return changed;
}

function battleCardPrompt(batch) {
  return `${LEAPSPACE_CONTEXT}

For each competing solution below, write a short "battle card" entry for an Elsevier sales rep who needs to understand it in 10 seconds flat.

${batch.map((c, i) => `${i + 1}. ${c.company} — ${c.product} (matches: ${(c.elements || []).join(', ') || 'none tagged'})\n   ${c.howItCompetes}`).join('\n')}

Respond with ONLY a JSON array of exactly ${batch.length} objects, one per item in the same order, each exactly:
{"whatTheyDid": "1-2 punchy sentences restating the competitive move — what changed and why it matters, written for someone skimming fast", "counter": "1-2 sentences on how to position LeapSpace against this specific move — name the actual LeapSpace tab or strength to lead with (see the 8 tabs above), never a generic 'we're better' claim"}`;
}

// A competitor counts as "current" for anything framed as today's
// landscape (executive summary, This Week's Read, the threat leaderboard)
// only if its actual event — not our tracking date — falls on/after
// RECENCY_CUTOFF. See the RECENCY_CUTOFF comment up top for why addedDate
// alone can't answer this.
function isCurrent(c) {
  return (c.eventDate || c.addedDate || '0000-00-00') >= RECENCY_CUTOFF;
}

// One-paragraph board-ready read of the current competitive landscape,
// regenerated whenever the tracked set changes (a new competitor was
// written up this run) or the summary doesn't exist yet. Kept separate
// from the per-competitor entries so the page can render it standalone
// with a copy-to-clipboard button for sharing upward.
async function generateExecutiveSummary(competitors) {
  const current = competitors.filter(c => c.howItCompetes && isCurrent(c));
  const cutoffLabel = new Date(RECENCY_CUTOFF).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (!current.length) {
    return `No competitive moves have been confirmed since ${cutoffLabel} — nothing currently tracked meets the recency bar for a board-level update. ${competitors.length} older entries remain on file for reference but are excluded here as no longer current.`;
  }
  const facts = current.map(c =>
    `- ${c.company} — ${c.product} (overlaps ${(c.elements || []).length}/8 LeapSpace tabs: ${(c.elements || []).join(', ') || 'none tagged'}; dated ${c.eventDate || c.addedDate})\n  ${String(c.howItCompetes).slice(0, 300)}`
  ).join('\n');

  const prompt = `${LEAPSPACE_CONTEXT}

Below is every AI research tool with a confirmed competitive move dated ${cutoffLabel} or later — older entries have already been excluded, do not comment on or imply older history. Write an executive summary an Elsevier sales lead can paste into a board-of-directors update — quick, concise, factual.

${facts}

Structure it as exactly:
1. One sentence stating the tracking criteria (AI research tools found via web search that overlap one or more of LeapSpace's 8 tabs above, dated ${cutoffLabel} or later) and the headline number: how many are tracked and how many companies.
2. One sentence on where the pressure is concentrated (which LeapSpace tab(s) see the most overlap).
3. One sentence each for the most serious threats among these (up to three), naming the company and product and why it specifically threatens LeapSpace.
4. One closing sentence on LeapSpace's strongest defensible position against this field.

Plain text only, no headings, no bullets, no markdown — exactly 6 sentences, under 1300 characters. Respond with ONLY the summary text.`;

  const text = await callHaiku(prompt);
  if (text === null) return null;
  return String(text).trim().slice(0, 1400);
}

// Generates whatTheyDid/counter copy for any tracked competitor that
// doesn't have it yet. Only backfills what's missing (same philosophy as
// news-scan.js's backfillAnalysis) rather than regenerating everything
// every run — keeps this cheap and keeps hand-edited howItCompetes text
// from being silently overwritten by a stale cached write-up. Threat
// ranking and which entries actually surface on the page are computed
// client-side (see the file header comment) — this just makes sure the
// copy exists for whichever candidates the client picks.
async function generateBattleCard(competitors, datesJustBackfilled) {
  const existing = readJSON(BATTLECARD_FILE, { generatedAt: null, entries: {}, executiveSummary: null, executiveSummaryDate: null });
  const entries = existing.entries || {};

  const needsCard = competitors.filter(c => c.howItCompetes && !entries[c.id]);
  // A dates backfill can flip which entries count as "current" (see
  // isCurrent()) without adding a single new battle card, so it has to
  // force a summary refresh on its own — otherwise a stale-but-recently-
  // tracked entry (the NotebookLM "Dec 2025 update" case) keeps reading as
  // current in the board summary until something else happens to trigger
  // a regen.
  const trackedSetChanged = needsCard.length > 0 || !!datesJustBackfilled;
  if (!trackedSetChanged && existing.executiveSummary) {
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

  // Regenerated only when the tracked set actually changed this run (a new
  // competitor got written up above) or it's never existed — not every
  // run — so a quiet day doesn't burn an extra call for identical output.
  let executiveSummary = existing.executiveSummary || null;
  let executiveSummaryDate = existing.executiveSummaryDate || null;
  if (trackedSetChanged || !executiveSummary) {
    console.log('[competitor-scan] Writing executive summary...');
    const summary = await generateExecutiveSummary(competitors);
    if (summary) {
      executiveSummary = summary;
      executiveSummaryDate = new Date().toISOString();
    } else {
      console.warn('[competitor-scan] Executive summary generation failed — keeping previous summary in place.');
    }
  }

  saveJSON(BATTLECARD_FILE, { generatedAt: new Date().toISOString(), entries, executiveSummary, executiveSummaryDate });
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

  // Runs regardless of how discovery goes below — it only reads/extracts
  // from data already on disk, so it's worth doing even on a discovery
  // failure or refusal.
  async function backfillDatesAndSave() {
    const changed = await backfillEventDates(competitors);
    if (changed) saveJSON(DATA_FILE, competitors);
    return changed;
  }

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
    const datesChanged = await backfillDatesAndSave();
    await generateBattleCard(competitors, datesChanged);
    saveJSON(STATE_FILE, { lastRun: new Date().toISOString(), lastAddedCount: 0, error: `discovery: ${e.message}` });
    return;
  }

  if (response.stop_reason === 'refusal') {
    console.log('[competitor-scan] Request was declined by safety classifiers — no results this run.');
    // Still worth backfilling battle-card copy for whatever's already
    // tracked — the refusal only affects this run's discovery step.
    const datesChanged = await backfillDatesAndSave();
    await generateBattleCard(competitors, datesChanged);
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
      eventDate: /^\d{4}-\d{2}-\d{2}$/.test(item.eventDate) ? item.eventDate : null,
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
  const datesChanged = await backfillDatesAndSave();

  await generateBattleCard(competitors, datesChanged);

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
