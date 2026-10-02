# netherlands-crm

## Agent skills

### Issue tracker

Issues, specs and tickets live in this repo's GitHub Issues, via the `gh` CLI. The scans' automated alert issues share the tracker and are not tickets. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, each named after its role: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.

## Product decisions

Settled with the owner. Do not undo these without asking.

- **The "Your Day" card lives on the Daily Digest page only.** It was added to the dashboard widget board and then removed again (2026-09-19 and 2026-09-20); the owner confirmed on 2026-10-01 that it stays off the dashboard.

## Working convention

- **Code changes go through a pull request.** One pull request per ticket, squash-merged, with the smoke check green. Do not push code straight to `main`.
- **Scan workflows push data straight to `main`.** They commit their own output under `data/` and must keep working unattended, so `main` is deliberately not protected: protection rules would break every scan.
- **Rebase before merging.** The scans and other sessions push to `main` many times a day, so cut each branch from the current `main` and rebase it before the merge.
- **The Denmark and Belgium repos are mirrors.** `denmark-crm` and `belgium-crm` are near-copies kept in step by hand. A fix or cleanup that lands here is mirrored there in the same ticket; Region data, Region wording, localised patterns and storage-key prefixes are intentionally different and are never mirrored.
- **Work on a sibling repo from a clean worktree.** Another session may have uncommitted work in its checkout. The routine, and the script that lands all three pull requests together, are in `docs/agents/mirroring.md`.
- **Review against `CODING_STANDARDS.md`.** It holds the judgement rules a check cannot decide; read it when reviewing a diff, not while building.

## Testing

The smoke check opens every page in a real browser with sign-in and the database stubbed at the network boundary, and fails on any console error.

- First time: `npm install`, then `npx playwright install chromium`.
- Every time: `npm test`. One file or one test: `npx playwright test tests/smoke.spec.js -g "<name>"`.
- Nothing in `index.html` knows it is under test. Keep it that way: stub at the network (`tests/support/stubs.js`), never add a test flag to the page.
- New behaviour and bug fixes start with a failing test at this seam.
- Before every commit: `npm run check`. It takes seconds, needs no browser, and fails on a script that does not parse, a function nothing references, an unused style class or an empty file at the repo root. A function kept unreferenced on purpose is listed with its reason in `scripts/check/run.js`.

## Database

The three Regions share one Supabase project, `cfhljbexesdrabmadpcc`, split by a `region` column. The page only shows what the database accepted, so when a save is refused, read the table's foreign keys and access rules before changing the page: the Supabase connector answers that read-only (`list_tables`, or a `select` on `pg_policies`). Never write to the database from a session.
