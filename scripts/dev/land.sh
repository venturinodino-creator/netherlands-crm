#!/usr/bin/env bash
# Lands one ticket in all three regional repos.
#
#   scripts/dev/land.sh <nl-pr> <sibling-branch> <title> <msg-file> <dk-worktree> <be-worktree> -- <files...>
#
# Run from the netherlands-crm checkout once its pull request is open. The two
# sibling worktrees must already be on <sibling-branch> with the change applied
# and its tests green. The script then:
#   1. commits the listed files in each sibling and opens its pull request;
#   2. waits for the smoke check on all three pull requests;
#   3. squash-merges all three, only if every check passed;
#   4. removes the sibling worktrees and fast-forwards this checkout.
# See docs/agents/mirroring.md for the whole routine.
set -u
NLPR="$1"; BR="$2"; TITLE="$3"; MSG="$4"; DK="$5"; BE="$6"; shift 6
[ "${1:-}" = "--" ] && shift
[ $# -gt 0 ] || { echo "no files listed after --"; exit 1; }
NL_SLUG=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
declare -A PRN SLUG

for w in "$DK" "$BE"; do
  SLUG[$w]=$(cd "$w" && gh repo view --json nameWithOwner --jq .nameWithOwner)
  # an empty file at the root is a shell artefact and must never be committed
  find "$w" -maxdepth 1 -type f -size 0 ! -name '.*' -delete 2>/dev/null
  git -C "$w" add -- "$@" || { echo "add failed in ${SLUG[$w]}"; exit 1; }
  { cat "$MSG"; echo; echo "Mirrors $NL_SLUG#$NLPR."; } | git -C "$w" commit -q -F - || { echo "commit failed in ${SLUG[$w]}"; exit 1; }
  git -C "$w" push -q -u origin "$BR" 2>&1 | grep -v '^remote:' | tail -1
  url=$(cd "$w" && gh pr create --title "$TITLE" --body "Mirrors $NL_SLUG#$NLPR. Same change and same tests, run red before the fix and green after in this repo. Region data and wording are untouched.

**Door:** two-way." | tail -1)
  PRN[$w]=${url##*/}
  echo "${SLUG[$w]} pull request #${PRN[$w]}"
done

sleep 45
ok=1
res=$(gh pr checks "$NLPR" --watch --interval 15 2>&1 | tail -1); echo "$NL_SLUG #$NLPR: $res"; echo "$res" | grep -q pass || ok=0
for w in "$DK" "$BE"; do
  res=$(gh pr checks "${PRN[$w]}" -R "${SLUG[$w]}" --watch --interval 15 2>&1 | tail -1); echo "${SLUG[$w]} #${PRN[$w]}: $res"; echo "$res" | grep -q pass || ok=0
done
[ $ok = 1 ] || { echo "A CHECK DID NOT PASS: nothing merged"; exit 1; }

gh pr merge "$NLPR" --squash --delete-branch 2>&1 | tail -1
git checkout -q main 2>/dev/null; git pull -q --ff-only origin main
echo "$NL_SLUG main: $(git log --oneline -1 | cut -c1-76)"
for w in "$DK" "$BE"; do
  home=$(cd "$w" && cd "$(git rev-parse --git-common-dir)/.." && pwd)
  gh pr merge "${PRN[$w]}" -R "${SLUG[$w]}" --squash 2>&1 | tail -1
  git -C "$w" push -q origin --delete "$BR" 2>&1 | tail -1
  git -C "$home" worktree remove --force "$w"
  git -C "$home" branch -D "$BR" -q 2>/dev/null
  git -C "$home" fetch -q --prune origin
  echo "${SLUG[$w]} main: $(git -C "$home" log --oneline -1 origin/main | cut -c1-76)"
done
echo "MIRRORS: ${SLUG[$DK]}#${PRN[$DK]} ${SLUG[$BE]}#${PRN[$BE]}"
