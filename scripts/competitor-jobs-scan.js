/**
 * competitor-jobs-scan.js — Daily scan of open roles, based in the
 * Netherlands or remote, at companies that sell a product directly competing
 * with one of Elsevier's named RI solutions (Scopus, SciVal, Pure, Insight
 * Graph, 4GU reports, Digital Commons), scoped to a Netherlands account
 * manager's specific interest: go-to-market and customer-facing hiring tied
 * to that competing product line — Strategic/Senior Account Management
 * (SAM), Sales Development (SDR/BDR), Channel/Partnerships, and the full
 * customer-lifecycle line (Customer Success, pre-sales/solution consulting,
 * implementation/onboarding, technical/product support, customer service &
 * licence admin, training & customer education, usage/reporting analytics,
 * product marketing) — not engineering, core product/eng management,
 * editorial, finance, HR, or an unrelated business line like a diversified
 * competitor's IP/patent or clinical-regulatory arm. See classifyRole()
 * below for the exact title patterns per category.
 *
 * Only 3 of the companies tracked elsewhere in this app (e.g. in
 * news-scan.js's Competitor Announcements) actually qualify — see SOURCES
 * below for the product-competitor mapping (Clarivate/Web of Science vs
 * Scopus, etc). Companies that are broadly "an Elsevier competitor" but
 * don't sell a Scopus/SciVal/Pure/Digital Commons-type product (OpenAI,
 * Anthropic, Elicit, SciSpace, Springer Nature, Wiley) are deliberately
 * excluded here even though they have a working ATS — see
 * NOT_PRODUCT_COMPETITOR below.
 *
 * Deliberately NOT LinkedIn: LinkedIn requires login for job search and
 * actively blocks automated access, so there is no reliable or
 * ToS-compliant way to scrape it from a script (and no free public API —
 * LinkedIn's Jobs/Talent API is enterprise/partnership-only). Instead this
 * pulls straight from each company's own careers-page ATS, whose public
 * JSON API is meant for exactly this kind of programmatic read — and since
 * a LinkedIn job post is near-always just a syndicated copy of the ATS
 * listing, this captures the same signal without the ToS problem.
 *
 * Per-company ATS coverage (verified by hand — see git history for the
 * research this was built from; do not guess new endpoints without
 * verifying the same way):
 *   - Greenhouse, Ashby, SmartRecruiters, Pinpoint: simple GET, no auth.
 *   - Workday (CXS API): requires a POST with a JSON search body — see
 *     fetchWorkday() below.
 *   - No usable public API found: scite (not hiring), Consensus (LinkedIn
 *     only), Paperguide (no formal ATS), IGI Global (email-only), IEEE
 *     (Taleo, session-based), Google (proprietary/internal API). These are
 *     listed in UNTRACKED_COMPANIES so the UI can be upfront about the gap
 *     instead of silently omitting them.
 *
 * Unlike news-scan.js, this does a full resync each run rather than an
 * accumulating feed: a role no longer returned by a company's ATS has
 * presumably closed, so it's dropped from the live list. foundDate is
 * preserved across runs for a role that's still open, so "open since" is
 * still visible.
 *
 * salary/applicationDeadline are best-effort text extraction (see
 * extractSalary/extractDeadline) from whatever description text is
 * available for a role that already passed the location/role filters —
 * most postings don't have a hard application deadline at all (rolling/
 * open-until-filled is the norm), and salary disclosure depends on the
 * company and jurisdiction, so both are frequently null. That's an honest
 * "not stated," not a bug.
 *
 * No ANTHROPIC_API_KEY needed — ATS results are already precise structured
 * data, no relevance judgement call required, just deterministic
 * location/title filtering.
 *
 * Run: node scripts/competitor-jobs-scan.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const DATA_FILE = 'data/competitor-jobs.json';
const STATE_FILE = 'data/competitor-jobs-scan-state.json';
const REQUEST_TIMEOUT_MS = 20000;

// Netherlands-or-remote location match. Briefly widened to match any
// European country/city, but that surfaced roles based in London, Berlin,
// Paris, etc that have nothing to do with the Netherlands specifically —
// reverted to the two things that actually matter for this feature: the
// role is based in the Netherlands, or it's remote (and therefore fillable
// from the Netherlands) — not "somewhere in Europe" generally. A bare
// "EMEA"/"Europe" location with no "remote" qualifier is deliberately NOT
// matched, since that names a whole region, not the Netherlands.
const NL_CITY_COUNTRY_RE = /netherlands|nederland|amsterdam|utrecht|rotterdam|the hague|den haag|eindhoven|groningen|delft|leiden|maastricht|\bnl\b/i;

// A bare "remote" match is not enough on its own: ATS location fields almost
// always pair "Remote" with a specific country ("Remote, United States of
// America", "Australia, Remote"), and the first live test run of this filter
// pulled in exactly those — a globally-remote US or Australian role has
// nothing to do with the Netherlands. Only exclude on an explicit
// non-European qualifier; a bare "Remote" with no country named, or one
// paired with the Netherlands/EMEA/Europe/another EU country, still passes.
const NON_EUROPE_REMOTE_RE = /united states|\bu\.?s\.?a?\.?\b|canada|australia|new zealand|\bapac\b|\blatam\b|brazil|mexico|argentina|colombia|\bindia\b|china|japan|singapore|hong kong|south korea|philippines|indonesia|vietnam|thailand|malaysia|south africa|nigeria|kenya|\buae\b|united arab emirates|saudi arabia|\bisrael\b/i;

function isTrackedLocation(location) {
  const loc = location || '';
  if (NL_CITY_COUNTRY_RE.test(loc)) return true;
  return /\bremote\b/i.test(loc) && !NON_EUROPE_REMOTE_RE.test(loc);
}

// Role families that get their own named category, for a sales agent
// tracking competitor go-to-market and customer-facing headcount:
// Strategic/Senior Account Management, Sales Development (SDR/BDR outbound
// prospecting), Channel/Partnerships, and the full customer-lifecycle line
// (Customer Success, pre-sales/solution consulting, implementation/
// onboarding, technical/product support, customer service & licence admin,
// training & customer education, usage/reporting analytics, and product
// marketing). A role that doesn't match one of these named categories is not
// shown — this list is deliberately the specific set of roles being tracked,
// not a general "any hiring at a competitor" feed.
// All of these match the bare noun phrase (or an explicit reversed-order
// alternative) rather than a fixed "noun + level-word" suffix — confirmed
// live that real titles put the level word before the department just as
// often as after ("Director, Field Marketing" vs "Field Marketing
// Director"), and a fixed-suffix-only regex was silently dropping real
// matches in every single category tested. Each bare phrase was checked
// against real non-GTM titles (engineering, research, finance, HR) pulled
// from live ATS data to confirm it doesn't over-match.
const SAM_TITLE_RE = /\b(strategic account(s)?|key account(s)?|enterprise account(s)?|senior account(s)?|regional sales|account (manager|executive|director))\b/i;
const SDR_TITLE_RE = /\b(sales development rep(resentative)?|business development rep(resentative)?|sdr|bdr)\b/i;
const CSM_TITLE_RE = /\b(customer success|client success)\b/i;
const CHANNEL_TITLE_RE = /\b(channel (manager|director|sales|partnerships?)|partnership(s)?|alliance(s)?|business development)\b/i;
const PRESALES_TITLE_RE = /\b(customer consultant|solutions? consult(ant|ing)|pre-?sales)\b/i;
const IMPLEMENTATION_TITLE_RE = /\b(implementation|onboarding)\b/i;
const SUPPORT_TITLE_RE = /\b(technical support|product support|support analyst)\b/i;
const SERVICE_TITLE_RE = /\b(customer service|licen[cs]e administrator|licen[cs]ing administrator)\b/i;
const TRAINING_TITLE_RE = /\b(training specialist|customer education|training (manager|lead|coordinator|director)|(manager|lead|coordinator|director)[,\s]+(of\s+)?training)\b/i;
const ANALYTICS_TITLE_RE = /\b(usage (&|and) reporting analyst|usage analyst|reporting analyst|usage \& reporting)\b/i;
const MARKETING_TITLE_RE = /\b(product marketing|market development manager|field marketing|customer marketing)\b/i;

// Once a title matches one of the role families above, exclude it if it's
// clearly scoped to a business line that doesn't compete with Elsevier's
// Research Intelligence / scholarly-publishing solutions — e.g. a
// diversified competitor's IP/patent, life-sciences-regulatory, or
// clinical-consulting arm. Title/department-only data means this is a
// best-effort keyword check, not a guarantee.
const NON_RESEARCH_VERTICAL_RE = /\b(patent|trademark|intellectual property|ip (services|management|licensing)|regulatory affairs|clinical trial|pharmacovigilance|drug safety|life sciences consulting)\b/i;

function classifyRole(title, department) {
  const text = `${title} ${department || ''}`;
  if (NON_RESEARCH_VERTICAL_RE.test(text)) return null;
  if (SAM_TITLE_RE.test(title)) return 'sam';
  // SDR/BDR checked before the broader CHANNEL "business development" match
  // so a "Business Development Representative" — an outbound prospecting
  // role, not a partnerships role — lands in sdr, not channel.
  if (SDR_TITLE_RE.test(title)) return 'sdr';
  if (CSM_TITLE_RE.test(title)) return 'csm';
  if (CHANNEL_TITLE_RE.test(title)) return 'channel';
  if (PRESALES_TITLE_RE.test(title)) return 'presales';
  if (IMPLEMENTATION_TITLE_RE.test(title)) return 'implementation';
  if (SUPPORT_TITLE_RE.test(title)) return 'support';
  if (SERVICE_TITLE_RE.test(title)) return 'service';
  if (TRAINING_TITLE_RE.test(title)) return 'training';
  if (ANALYTICS_TITLE_RE.test(title)) return 'analytics';
  if (MARKETING_TITLE_RE.test(title)) return 'marketing';
  return null;
}

function readJSON(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}
function saveJSON(path, data) {
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}
function makeId(company, url) {
  let hash = 0;
  const s = company + '|' + url;
  for (let i = 0; i < s.length; i++) { hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0; }
  return 'job-' + Math.abs(hash).toString(36);
}
function toISODate(d) {
  const dt = new Date(d);
  return isNaN(dt) ? null : dt.toISOString().slice(0, 10);
}

// Best-effort text extraction — most ATS postings simply don't carry
// structured salary/deadline fields, so this looks for common phrasing in
// whatever description text is available and returns null rather than
// guessing when nothing matches. Salary catches currency-amount ranges and
// "OTE" (on-target earnings — the standard way sales-role total comp,
// including commission, is quoted). Deadline catches explicit
// apply-by/closing-date phrasing; most tech-sales roles are "open until
// filled" with no deadline at all, so null here is the common, correct case.
function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
function extractSalary(html) {
  const text = stripHtml(html);
  if (!text) return null;
  const m = text.match(/(?:salary|compensation|base pay|OTE|on-target earnings)[^.\n]{0,40}?([€£$]\s?\d[\d.,]*\s?[kK]?(?:\s?(?:-|–|to)\s?[€£$]?\s?\d[\d.,]*\s?[kK]?)?(?:\s?(?:per|\/)\s?(?:year|annum|yr))?)/i)
    || text.match(/([€£$]\s?\d{2,3}[,.]\d{3}(?:\s?(?:-|–)\s?[€£$]?\s?\d{2,3}[,.]\d{3})?)/);
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 80) : null;
}
function extractDeadline(html) {
  const text = stripHtml(html);
  if (!text) return null;
  const m = text.match(/(?:apply by|application deadline|applications close|closing date|deadline for applications)[:\s]{0,10}(?:on |of )?([A-Za-z0-9,./ -]{4,30})/i);
  return m ? m[1].trim().replace(/[.,]$/, '').slice(0, 60) : null;
}

async function fetchJSON(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// -- Greenhouse: GET https://boards-api.greenhouse.io/v1/boards/<token>/jobs?content=true
async function fetchGreenhouse(company, boardToken) {
  const data = await fetchJSON(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`);
  return (data.jobs || []).map(j => ({
    company,
    title: String(j.title || '').trim(),
    location: (j.location && j.location.name) || '',
    department: (j.departments && j.departments[0] && j.departments[0].name) || '',
    url: j.absolute_url || '',
    postedDate: toISODate(j.updated_at || j.first_published),
    source: 'Greenhouse',
    descriptionHtml: j.content || '',
  }));
}

// -- Ashby: GET https://api.ashbyhq.com/posting-api/job-board/<boardName>
async function fetchAshby(company, boardName) {
  const data = await fetchJSON(`https://api.ashbyhq.com/posting-api/job-board/${boardName}`);
  return (data.jobs || []).map(j => ({
    company,
    title: String(j.title || '').trim(),
    location: j.location || (j.address && j.address.postalAddress && [j.address.postalAddress.addressLocality, j.address.postalAddress.addressCountry].filter(Boolean).join(', ')) || '',
    department: j.department || j.team || '',
    url: j.jobUrl || j.applyUrl || '',
    postedDate: toISODate(j.publishedAt || j.publishedDate),
    source: 'Ashby',
  }));
}

// -- SmartRecruiters: GET https://api.smartrecruiters.com/v1/companies/<id>/postings
async function fetchSmartRecruiters(company, companyId) {
  const data = await fetchJSON(`https://api.smartrecruiters.com/v1/companies/${companyId}/postings`);
  return (data.content || []).map(p => ({
    company,
    title: String(p.name || '').trim(),
    location: p.location ? [p.location.city, p.location.region, p.location.country].filter(Boolean).join(', ') : '',
    department: (p.department && p.department.label) || '',
    url: p.applyUrl || p.postingUrl || `https://jobs.smartrecruiters.com/${companyId}/${p.id}`,
    postedDate: toISODate(p.releasedDate),
    source: 'SmartRecruiters',
  }));
}

// -- Pinpoint: GET https://<slug>.pinpointhq.com/postings.json
async function fetchPinpoint(company, slug) {
  const data = await fetchJSON(`https://${slug}.pinpointhq.com/postings.json`);
  // Confirmed live shape (2026-09-02): { data: [...] }, not { postings }
  // or { jobs } — those two were guessed at build time and never actually
  // matched, so this fetch silently returned zero jobs on every run.
  const list = Array.isArray(data) ? data : (data.data || data.postings || data.jobs || []);
  return list.map(p => ({
    company,
    title: String(p.title || '').trim(),
    location: (p.location && (p.location.name || p.location)) || p.location_name || '',
    // Confirmed live shape: department lives at job.department.name, not a
    // top-level field — the old fallback always came back blank.
    department: (p.job && p.job.department && p.job.department.name) || (p.department && (p.department.name || p.department)) || '',
    url: p.url || p.absolute_url || '',
    postedDate: toISODate(p.published_at || p.created_at),
    source: 'Pinpoint',
    // Pinpoint's list endpoint doesn't document a guaranteed description
    // field — take whatever's present defensively rather than a second
    // per-posting fetch to an unconfirmed detail endpoint.
    descriptionHtml: p.description || p.content || p.description_html || '',
  }));
}

// -- Workday CXS API: POST https://<tenant>.wd<N>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs
// Paginates in pages of `limit`; loops until a page returns fewer than
// requested or a safety cap is hit. postedOn is a relative string ("Posted
// 3 Days Ago"), not a real date, so postedDate is left null — foundDate
// covers it. Wrapped defensively since this is POST-based and its exact
// response shape wasn't confirmed against live data before shipping.
async function fetchWorkday(company, host, tenant, site) {
  const base = `https://${tenant}.${host}.myworkdayjobs.com`;
  const jobs = [];
  const limit = 20;
  let offset = 0;
  for (let page = 0; page < 10; page++) {
    const data = await fetchJSON(`${base}/wday/cxs/${tenant}/${site}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ appliedFacets: {}, limit, offset, searchText: '' }),
    });
    const postings = data.jobPostings || [];
    for (const j of postings) {
      jobs.push({
        company,
        title: String(j.title || '').trim(),
        location: j.locationsText || '',
        department: '',
        url: j.externalPath ? `${base}/${site}${j.externalPath}` : '',
        postedDate: null,
        source: 'Workday',
        // No description in the list response — fetchWorkdayJobDescription()
        // fills this in later, but only for jobs that survive the
        // location/role filter, to avoid a detail fetch per posting.
        workdayDetail: j.externalPath ? { base, tenant, site, externalPath: j.externalPath } : null,
      });
    }
    if (postings.length < limit) break;
    offset += limit;
  }
  return jobs;
}

// Workday CXS job-detail endpoint — GET (not POST, unlike the list search)
// returns the full posting including its description HTML. Only called for
// jobs that already passed the location/role filter (typically 0-a handful
// per run), never for the full unfiltered list, since Workday's list
// response doesn't include description text. externalPath from the list
// response already starts with "/job/..." — confirmed live (2026-09-05) that
// prepending another literal "/job" segment double-nests the path and the
// endpoint 422s on every single request, silently leaving salary/deadline
// null for every Workday-sourced role. No extra segment needed.
async function fetchWorkdayJobDescription({ base, tenant, site, externalPath }) {
  const data = await fetchJSON(`${base}/wday/cxs/${tenant}/${site}${externalPath}`);
  return (data.jobPostingInfo && data.jobPostingInfo.jobDescription) || '';
}

// Only companies that actually sell a product directly competing with one
// of Elsevier's named RI solutions (Scopus, SciVal, Pure, Insight Graph,
// 4GU reports, Digital Commons) are scanned for hiring roles — a company
// being a broad "Elsevier competitor" (tracked elsewhere, e.g. in
// news-scan.js's Competitor Announcements) is not enough on its own:
//   - Clarivate: Web of Science (Scopus), InCites (SciVal), Converis (Pure)
//   - Digital Science: Dimensions (Scopus/SciVal), Figshare (Digital
//     Commons), Symplectic Elements (Pure)
//   - Allen Institute for AI: Semantic Scholar (Scopus's discovery/
//     citation-graph function)
// Companies deliberately excluded even though they have a working ATS —
// see NOT_PRODUCT_COMPETITOR below for why each one doesn't qualify.
const SOURCES = [
  { company: 'Digital Science', fetch: () => fetchPinpoint('Digital Science', 'digitalscience') },
  { company: 'Allen Institute for AI', fetch: () => fetchGreenhouse('Allen Institute for AI', 'thealleninstitute') },
  { company: 'Clarivate', fetch: () => fetchWorkday('Clarivate', 'wd3', 'clarivate', 'Clarivate_Careers') },
];

// Companies with no usable public API — surfaced in scan state so the UI
// can be upfront about the gap instead of silently omitting them.
const UNTRACKED_COMPANIES = [
  { company: 'scite', reason: 'Not currently hiring (applications by email)', url: 'https://scite.ai/jobs' },
  { company: 'Consensus', reason: 'Roles posted only to LinkedIn, no ATS board found', url: 'https://consensus.app/home/careers/' },
  { company: 'Paperguide', reason: 'No formal careers page/ATS (small team, hires ad hoc via LinkedIn)', url: 'https://linkedin.com/company/paperguideai' },
  { company: 'IGI Global Scientific Publishing', reason: 'Static list, applications by email', url: 'https://www.igi-global.com/about/staff/job-opportunities/' },
  { company: 'IEEE', reason: 'Oracle Taleo, session-based, no public JSON API', url: 'https://ieee.taleo.net/careersection/2/jobsearch.ftl' },
  { company: 'Google', reason: 'Proprietary/internal API, not public', url: 'https://careers.google.com/' },
];

// Companies that DO have a usable ATS but are excluded on purpose: nothing
// they sell directly competes with Scopus/SciVal/Pure/Digital Commons, so
// their tracked customer-facing hiring isn't a signal for this feature even though
// they're tracked elsewhere as broader Elsevier competitors.
const NOT_PRODUCT_COMPETITOR = [
  { company: 'OpenAI', reason: "General-purpose AI platform (Claude/GPT-style API) — no discrete product competing with Scopus/SciVal/Pure/Digital Commons", url: 'https://openai.com/careers/' },
  { company: 'Anthropic', reason: "General-purpose AI platform — no discrete product competing with Scopus/SciVal/Pure/Digital Commons", url: 'https://anthropic.com/careers' },
  { company: 'Elicit', reason: 'AI research-assistant tool, not a Scopus/SciVal/Pure/Digital Commons-type institutional platform', url: 'https://elicit.com/careers' },
  { company: 'SciSpace', reason: 'AI research-assistant tool, not a Scopus/SciVal/Pure/Digital Commons-type institutional platform', url: 'https://typeset.io/careers' },
  { company: 'Springer Nature', reason: 'Publisher — no discrete analytics/CRIS/repository product competing with Scopus/SciVal/Pure/Digital Commons', url: 'https://springernature.wd3.myworkdayjobs.com/SpringerNatureCareers' },
  { company: 'Wiley', reason: 'Publisher — no discrete analytics/CRIS/repository product competing with Scopus/SciVal/Pure/Digital Commons', url: 'https://wiley.wd1.myworkdayjobs.com/wiley_careers' },
];

async function main() {
  const existing = readJSON(DATA_FILE, []);
  const existingByKey = new Map(existing.map(j => [j.company + '|' + j.url, j]));

  const allJobs = [];
  const perCompanyCounts = {};
  const errors = {};

  for (const src of SOURCES) {
    try {
      const jobs = await src.fetch();
      perCompanyCounts[src.company] = { total: jobs.length, nlOrRemote: 0 };
      for (const j of jobs) {
        if (!j.title || !j.url) continue;
        if (!isTrackedLocation(j.location)) continue;
        const roleCategory = classifyRole(j.title, j.department);
        if (!roleCategory) continue; // excluded business vertical (patent/IP/clinical-regulatory etc) — see NON_RESEARCH_VERTICAL_RE
        perCompanyCounts[src.company].nlOrRemote++;
        const key = j.company + '|' + j.url;
        const prior = existingByKey.get(key);

        // Salary/deadline extraction only runs for jobs that already passed
        // the filters above (typically 0-a handful per run) — Greenhouse
        // and Pinpoint already carry description text from the list fetch;
        // Workday needs one extra per-job detail fetch since its list
        // response has no description at all.
        let descriptionHtml = j.descriptionHtml || '';
        if (!descriptionHtml && j.workdayDetail) {
          try {
            descriptionHtml = await fetchWorkdayJobDescription(j.workdayDetail);
          } catch (e) {
            console.warn(`[competitor-jobs] Could not fetch job description for "${j.title}" (${j.company}): ${e.message} — salary/deadline will be unavailable for this role.`);
          }
        }

        allJobs.push({
          id: makeId(j.company, j.url),
          company: j.company,
          title: j.title.slice(0, 200),
          location: String(j.location || '').slice(0, 150),
          department: String(j.department || '').slice(0, 100),
          roleCategory,
          url: j.url.slice(0, 500),
          postedDate: j.postedDate,
          foundDate: (prior && prior.foundDate) || new Date().toISOString().slice(0, 10),
          source: j.source,
          salary: extractSalary(descriptionHtml),
          applicationDeadline: extractDeadline(descriptionHtml),
        });
      }
      console.log(`[competitor-jobs] ${src.company}: ${jobs.length} open role(s), ${perCompanyCounts[src.company].nlOrRemote} Netherlands/remote tracked-role match(es)`);
    } catch (e) {
      errors[src.company] = e.message;
      console.warn(`[competitor-jobs] ${src.company} failed: ${e.message}`);
    }
  }

  allJobs.sort((a, b) => (b.postedDate || b.foundDate || '').localeCompare(a.postedDate || a.foundDate || ''));
  saveJSON(DATA_FILE, allJobs);

  saveJSON(STATE_FILE, {
    lastRun: new Date().toISOString(),
    totalOpenRoles: allJobs.length,
    perCompanyCounts,
    errors,
    untracked: [...UNTRACKED_COMPANIES, ...NOT_PRODUCT_COMPETITOR],
    source: 'Company career-page ATS APIs (Greenhouse/Ashby/SmartRecruiters/Pinpoint/Workday) — not LinkedIn, see file header',
  });
  console.log(`[competitor-jobs] Done — ${allJobs.length} Netherlands/remote tracked role(s) across ${SOURCES.length - Object.keys(errors).length}/${SOURCES.length} tracked companies.`);
}

main().catch(e => {
  console.error('[competitor-jobs] Failed:', e.message);
  try {
    saveJSON(STATE_FILE, { lastRun: new Date().toISOString(), totalOpenRoles: 0, error: e.message, untracked: [...UNTRACKED_COMPANIES, ...NOT_PRODUCT_COMPETITOR] });
  } catch { /* ignore */ }
  process.exit(1);
});
