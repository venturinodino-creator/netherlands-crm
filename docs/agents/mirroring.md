# Mirroring a change into the Denmark and Belgium repos

`netherlands-crm` is the reference. `denmark-crm` and `belgium-crm` are near-copies of the same page with different Region data. A fix or cleanup lands here first and is then repeated in both, in the same ticket.

## What is never mirrored

Region data (each repo's `seed-data.js`), Region wording, localised title patterns and storage-key prefixes (`nl_crm_`, `dk_crm_`, `be_crm_`). These differ on purpose.

## The routine

1. **Land the change here** on a branch, with its test written first and the pull request open.
2. **Open a clean worktree of each sibling** at its `origin/main`, on a new branch. Another session may have uncommitted work in the sibling's main checkout, so never edit that.
3. **Copy the test files** across unchanged. Tests read Institution ids from the page at runtime, so one file serves every Region. Keep them that way.
4. **Run the new test red** in the sibling, before the change.
5. **Apply the change.** `git apply` of this repo's diff works when no nearby line carries Region wording. When it fails, apply the same edits with a small replacement script that asserts each target string occurs exactly once.
6. **Run the whole suite green** in the sibling, then `npm run check`.
7. **Land all three** with `scripts/dev/land.sh`, which opens the sibling pull requests, waits for every check and merges only if all pass.

## Running three suites on one machine

Each suite starts its own static server on the port in `playwright.config.js`. Run the repos one after another, or give each a different `PORT`. Never reuse a server already listening: it may be another project's.
