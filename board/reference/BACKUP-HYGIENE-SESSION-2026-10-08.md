# BACKUP-HYGIENE-SESSION-2026-10-08 — memorial (GLM-5.3-Flash desktop session, Tim-directed)

Session record of the 2026-10-08 estate-hygiene follow-through: six-repo BACKUP-STALE triage,
plan review, and the three Tim-approved remediations. Written 2026-10-08T14:4xZ.

## 1. Origin

The nightly ESTATE-HYGIENE tick (05:40Z, `board/automations/ESTATE-HYGIENE-PROMPT.md`) reported
`BACKUP-STALE 6 repo(s)` and filed the STALE line to `farm/notes/OPUS-7F.md` (pushed, commit
"backup-freshness 2026-10-08"). Tim then asked for a remediation plan, a rigorous safety review of
that plan, and finally approved the least-risky subset via popup questions.

## 2. What the review established (corrected the original plan)

Measured with `scripts/backup-freshness.mjs` (REPOS table) + read-only git. Three plan assumptions
were refuted:

1. **Evidence root (`C:/dev/Claude/Projects/AINumbers`) is diverged, NOT "48 unpushed commits."**
   Local `master` vs `origin/main`: 48→51 ahead, **3485 behind**, and `git cherry` shows zero
   patch-equivalents. A plain push is rejected non-FF; force-push would destroy remote history.
   Decision: never push from this session; needs Tim's rebase/merge ruling. (Root `.gitignore` is
   whitelist-style — line 6 `*` — tracked files stay tracked; new files need explicit `add -f`,
   precedent FV-SEMANTIC-GAP-FOLLOWTHROUGH-1.)
2. **Several STALE verdicts were script/clone artifacts, not lost backups.** The script measures
   clones at `C:/dev/Claude/Projects/AINumbers/...` — the `/c/Users/Disco` copies of internal and
   mcp-apps-poc are different, clean checkouts (red herring).
   - ainumbers-internal: script checked `origin/main`; clone only has `origin/master` →
     `unpushed=?` forever. Its "dirty=4" were all untracked scratch (`.wt/`, `mirror/`, a memo,
     and `INTEGRITY-PROBE-KEY-2026-09-01.md` — **flagged as a probable secret, never commit it**).
   - ainumbers-helm: "dirty=1" was only untracked `.wt/`. Nothing to commit.
   - mcp-apps-poc: the "3 unpushed" were coherent WIP on feature branch `MCP-LITE-PROFILE-1`
     (vs `origin/master`), not strays; repo has 8 Actions workflows + a full pre-push gate.
   - farm: all dirty entries untracked, mostly other seats' live `_pending-opus-*` notes —
     committing them would hijack seat workflows. Never touched.
   - ASIC: 97 modified August-era planning docs = unfinished authorship. Report-only.
3. **CI exposure is real**: internal 2 workflows, helm 10, mcp-apps-poc 8 (workflows dirs).
   farm / ASIC / evidence root have none.

## 3. Approved and executed (popup answers, 2026-10-08 ~14:1xZ)

| # | Action | Result |
|---|--------|--------|
| 1 | `scripts/backup-freshness.mjs` internal branch `main`→`master` | committed evidence-root-local `6c4ed34ae` (force-add, whitelist style). **Deliberately NOT pushed** (divergence). |
| 2 | Push `mcp-apps-poc` branch `MCP-LITE-PROFILE-1` (3 commits) to its own remote branch | PUSH-OK; remote tip = local tip = `5e604116ba70`. Pre-push gate: 52 hard gates green. Branch CI: success (Dependabot auto-merge skipped). |
| 3a | helm `.gitignore` += `.wt/` | first push rejected non-FF (local 1 ahead / 19 behind origin/main) → `pull --rebase origin main` (no remote commit touched .gitignore), full pre-push suite green (1259 tests, compile-parity 733/733, vendored trees verified), pushed `fa2f2dc6507d`. main CI: CI + Live-net coverage + Scorecard all success. helm now reads **ok**. |
| 3b | internal: new `.gitignore` (`.wt/`, `.worktrees/`, `mirror/`) | local master FF'd 397 commits to origin first (0 local-only), commit `c72ad492c4`, pushed; remote = local. master CI: success. dirty 4 → 2 (remaining: the KEY file + PALMA memo, both deliberate holds). |

Safety invariants held: no force-push anywhere, no history rewrite (one rebase of a single
whitelisted commit onto a strictly-newer remote), every pushed ref verified byte-equal to local,
every CI run triggered by the pushes came back green.

## 4. Verdict after

`BACKUP-STALE 6 → 5`, and the remaining five are all real, owner-owned (no artifacts left):

- **mcp-apps-poc** `unpushed=3`: the feature-branch commits are now on the remote but keep counting
  vs `origin/master` until `MCP-LITE-PROFILE-1` merges. dirty=2 = `.worktrees/`+`.wt/` scratch
  (Tim chose NOT to gitignore mcp-apps).
- **internal** `dirty=2`: `INTEGRITY-PROBE-KEY-2026-09-01.md` (probable secret — decide: move out
  of repo or gitignore explicitly) + `strategy/PALMA-COOPETITION-MEMO-2026-10-01.md`.
- **farm** `unpushed=1 dirty=48`: other seats' pending notes (`_pending-opus-reaudit-*`, etc.).
- **ASIC** `dirty=97`: August-era in-progress work; owner triage.
- **evidence root**: diverged 3485 behind `origin/main`, ~51 local commits incl. `6c4ed34ae`;
  needs Tim's rebase-or-declare-canonical ruling before any push.

## 5. Reusable lessons

- `backup-freshness.mjs` compares against hard-coded branches; a clone whose default branch
  differs silently reports `unpushed=?` STALE forever. Check `git branch -r` before trusting it.
- "dirty" in the script counts untracked files — scratch dirs (`.wt/`, `.worktrees/`, `mirror/`)
  read as lost work. Gitignoring them per repo is the cheapest honest fix.
- This box has multiple clones of the same repos (Disco home dir vs `C:/dev/Claude/Projects`);
  always locate the clone the script measures before acting on its verdict.
- Helm and mcp-apps-poc run full gate suites as pre-push hooks (minutes, not seconds); a rejected
  push after gates pass means topology moved — rebase the single commit, never force.
