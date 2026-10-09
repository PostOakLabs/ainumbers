# LANE-DRAFT-BOARDPATH-REWORD-1 — plan to unstick the three T1-MR rerun drafts (2026-10-06, Tim-directed)

## Problem

Every `queue-author` tick REFUSES the same three lane drafts on the leak gate and converts nothing:

- `research/lane-drafts/T1-MR-0AB4FB1B-RERUN.md`
- `research/lane-drafts/T1-MR-69EA7083-RERUN.md`
- `research/lane-drafts/T1-MR-E4D9BB86-RERUN.md`

Root cause (verified in code, not inferred): `queue-author.mjs:631` runs the full `leakScan`
over the converted body built from the ENTIRE draft file, and the `board-path` pattern
(`scripts/lib/bus-guards.mjs:65`, regex `/(^|[^A-Za-z0-9._-])board\//m`) hits each draft's
line-5 provenance sentence, which literally names `board/reference/SHADOW-WATCH-LOG.md`,
`board/reference/SHADOW-SESSION-KICKOFF-3.md` (and `board/reference/SHADOW-PROPOSALS.md` in
E4D9BB86). The board paths are authoring-time provenance only — the executable substance
(record verbatim + repro + report spec at `outbox/<id>-RERUN-REPORT.md`) is self-contained
elsewhere in each draft. The drafts therefore never convert, stay unrun forever, and pin
LANE-ORDER (`LANE-ORDER noop: newest line still names T1-MR-69EA7083-RERUN`).

## Remedy (the sanctioned one)

`queue-author.mjs` authoringVerdict's own contract: "the draft goes back to its author to be
reworded. Stripping a path is how a tasking arrives pointing at nothing." The drafts were
staged by ORCH-206 (this orchestrator seat), so the seat rewords them at the source. The gate,
LEAK_PATTERNS, and the conversion pipeline are NOT touched.

Each draft: edit ONLY the line-5 provenance sentence, replacing the two/three
`board/reference/<NAME>.md:NN` citations with non-path descriptions that keep the substance,
e.g. "the shadow-watch log entry and the shadow-session-kickoff record name the failed report".
The reworded sentence must contain NO `board/` substring. Everything else in the RERUN
sentence (RULINGS.md:211 pointer, Step 2c-rework, grade, wrong-pin/denominator rationale,
"twin re-measures fresh at origin/main only") stays verbatim.

### Pre-edit fingerprints (research/lane-drafts/ is fully gitignored — these are the only bytes-trail)

| draft | sha256 (pre-edit) | bytes |
|---|---|---|
| T1-MR-0AB4FB1B-RERUN.md | 90dd7c1248acb462a12a600c61f4a07a3c6e13431feb8ad5c56e72d28101e839 | 3911 |
| T1-MR-69EA7083-RERUN.md | 4c016b3df34610fdd24ca4e837eecf3282d41331c157a7b8b4b957eedc124326 | 3723 |
| T1-MR-E4D9BB86-RERUN.md | 5c9ef0d343ccb6b978fb1c23c4182f0f46e9553b7b8283c83da917afc4fe6b9c | 3931 |

A future verifier holding only the post-edit draft cannot reconstruct what changed (no git
history); the removed fragments are exactly the `board/reference/…` citations quoted in
"Problem" above, plus nothing else. Post-edit sha256 of each file is appended to the
Verification section below at execution time.

## Review verdicts (two independent passes, 2026-10-06)

Pass 1 — gate mechanics:
- `board-path` is the ONLY pattern class these bodies hit. `leakScan` returns the first class
  in LEAK_PATTERNS order; `board-path` firing proves email-address, credential-token,
  windows-user-path, workspace-root-path, profile-path, outside-sandbox-path and
  internal-surface are clean. The one class AFTER it (`build-code`: `/\bWave \d|\bW-[A-G]\b|\bD0\b/`)
  was grepped directly over all three drafts: zero hits.
- Each draft has exactly two `board/` occurrences, both on line 5. No other line of any of the
  three files trips any pattern.
- No byte-pinning: the `converted-from: … @ sha256(raw)` stamp is computed at conversion time
  (`queue-author.mjs:409`), so it records the post-reword hash. `queue-author.test.mjs` uses
  fixtures only. LANE-ORDER.md carries ids + timestamps, no shas.

Pass 2 — downstream / audit trail:
- The executor needs nothing from line 5: consumer and serves are restated by the conversion in
  the farm header (`consumer: shadow (farm/notes/GRADES.md)`, `serves: <id>`); the record and
  repro live in the body. The provenance sentence is staging context for the auditor, and the
  auditor reads this memorial for it.
- No report-name collision: all three drafts declare `outbox/<id>-RERUN-REPORT.md` (line 24),
  distinct from the graded-FAIL originals `farm/outbox/T1-MR-0AB4FB1B-REPORT.md` and
  `T1-MR-E4D9BB86-REPORT.md`, so unrun-detection stays correct after a rerun lands.
- RERUN ids appear in board channel files only as historical dispatch notes; nothing pins the
  pre-edit bytes.
- The drafts are gitignored (`git ls-files research/lane-drafts/` = empty), so the memorial
  itself carries the audit trail (fingerprints above + post-edit hashes below).

## Execution order (hard gates)

1. Reword line 5 of the three drafts as specified. No other byte changes.
2. `node scripts/queue-author.mjs --max 4 --bus auto --lane-order 2 --dry-run` — PASS requires
   three `PLAN` lines and ZERO lines starting `REFUSED T1-MR-`. Any REFUSED → stop, re-diagnose,
   do not reword further ad hoc.
3. `node scripts/queue-author.mjs --max 2 --bus msi --lane-order 2 --dry-run` then live, per the
   standing tick procedure (MSI targeted supply; a `NOOP nothing converted` there is fine).
4. `node scripts/queue-author.mjs --max 4 --bus auto --lane-order 2` (live).
5. Append post-edit sha256 lines + the actual PLAN lines to this file's Verification section.

## Verification

Executed 2026-10-06 (Tim-directed session, glm-S shadow seat seat):
- Pre-edit fingerprints re-verified byte-match before editing (all three sha256 + bytes identical to the table above); `git ls-files research/lane-drafts/` = 0 confirmed.
- Reword: line 5 only in each draft; `grep -c board/` → 0/0/0. Post-edit: T1-MR-0AB4FB1B-RERUN.md sha256 1d6a3af69d6c67c3… (3906 B) · T1-MR-69EA7083-RERUN.md 4cd150912935469c… (3718 B) · T1-MR-E4D9BB86-RERUN.md c48492d4912d2ef8… (3928 B). Only the two/three `board/reference/…` citations were replaced (with "the shadow-watch log entry (line NN)" etc.); no other bytes changed.
- Step 2 dry-run `--max 4 --bus auto --lane-order 2`: exactly three PLAN lines — T1-MR-0AB4FB1B-RERUN → hp queue/010, T1-MR-69EA7083-RERUN → nitro queue/011, T1-MR-E4D9BB86-RERUN → aspire queue/010 (harness=hermes) — and ZERO `REFUSED T1-MR-` lines.
- Step 3+4 live: all three converted and confirmed on the msi bus via `gh api repos/PostOakLabs/ainumbers-farm-msi/contents/queue` → 018-T1-MR-0AB4FB1B-RERUN.md, 028-T1-MR-69EA7083-RERUN.md, 038-T1-MR-E4D9BB86-RERUN.md. Post-conversion auto dry-run: no RERUN ids left in the plan set.
- mr-claim gate (standing): an mr/hermes worker must claim at least one RERUN within one worker cycle; if none claims, STOP converting further and escalate (do not let the unclaimed trio re-pin LANE-ORDER).
- Standing Flag follow-up: queue-author re-enable (with tripwire sentence) happens only after one clean conversion tick — see SHADOW-STAGED/LIVE-SMOKE-PUSH-RETRY-TRIPWIRE-1.md.

## Standing flags

- Automation 1 (`queue-author (daily convert)`) kill criterion TRIPPED 2026-10-06: the tick had
  logged three REFUSED-by-leak-gate conversions (the same three drafts, repeated ticks). Per
  ZCODE-AUTOMATIONS-QUEUE-2026-09-10.md, disable until this fix lands and one clean tick runs.
- The tick itself still must never edit files or author anything; this reword is a one-off
  Tim-directed repair, outside the automation.
