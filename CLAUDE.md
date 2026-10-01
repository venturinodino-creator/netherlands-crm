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
