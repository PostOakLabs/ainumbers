# DISPATCH-REFUSAL-RETIRE-MEMORIAL — 2026-10-08

Session record: retirement of the constant `REFUSED-AT-AUTHORING` dispatch debt (11 → 1) and the
investigation that preceded it. Written for future reference; nothing here changed any bus
artifact, queue, inbox, or outbox.

## Provenance

Started as a FARM-WATCH tick (2026-10-08T02:20:44Z, all five buses OK on heartbeat; seat SILENT
line + GRADES-BACKLOG 60 line written to ORCH-TO-7F). Tim then asked which laptops are underused
and whether work could be moved to them, approved "reword the refused drafts" (option 1), then
approved retirement after the investigation falsified option 1. Two rounds of popup decisions
recorded in §5.

## 1. The finding that killed option 1 ("reword the refused drafts")

24-hour throughput at origin (REPORT commits): hp 10, ps 7, nitro 3, aspire 2, msi 2. aspire and
msi are the underused buses, but `queue-author.mjs --dry-run --bus aspire|msi` ends
`NOOP nothing converted` — the farm is SUPPLY-limited, not capacity-limited. All six buses carry
all seven harnesses (hermes, opencode, step, muse, cline, workbuddy, kilo), so lane enablement is
never the blocker. The 11 constant authoring refusals decompose into three groups, only one of
which was even mechanically fixable:

- **Group A — 7 lane drafts, workspace-lane BY DESIGN (not fixable, gate is right).**
  `DERIVED-DEPENDENCY-MAP-1`, `DECLARED-OUTPUTS-PARITY-1`, `DECLARATION-SWEEP-DRYRUN-1`,
  `DECLARATION-INDETERMINATE-RESOLVE-1`, `IMPLEMENTS-CONF-KERNEL-VERIFY-1`,
  `FIXTURE-PROPOSAL-SHAPE-1`, `LONGCAT-TASKING-38-LANE-REAUDIT-PART3`. All are Muse-lane /
  step-lane drafts whose headers say `cwd = C:/dev/Claude/Projects/AINumbers` and whose outputs go
  to `research/muse-out/` and `research/step-out/`. They run IN the workspace and read internal
  research/board context the leak gate exists to keep from free models. Rewording them into bus
  taskings would be path-stripping, which `authoringVerdict()` (queue-author.mjs ~line 381)
  explicitly forbids. Real work, wrong lane class — tracked in the drafts themselves.
- **Group B — `CONFORMANCE-VERDICT-RECLASS-1`, class (b), NOT carryable by design (left alone).**
  Inputs are a 9-file `farm/outbox/STANDARDS-DECLARATION-PREP-BATCH-*.d/prep.json` glob (globs
  refused), 2.85 MB total (over the 2 MB `INPUTS_MAX_BYTES` cap twice), 4 of 9 packs leak-dirty
  (email / build code / `board/` paths) — all measured and documented in queue-author's own
  comments. It remains the ONE honest `REFUSED-AT-AUTHORING` left after this session.
- **Group C — 3 stale library entries (retired).** `farm-workbuddy__HY4-DISPATCH-ART437-BUCKET-ORDER-2026-09-10`,
  `farm-workbuddy__HY4-DISPATCH-MANIFEST-TYPE-CENSUS-2026-09-10`,
  `research-top__LONGCAT-TASKING-26-WRONGFR-HYPOTHESES`. The HY4 pair depends on helper scripts
  (`_hy4_art437_run.mjs`, `_ctrl.mjs`) living only in workspace `farm/workbuddy/`; a safe fix
  would mean moving them to `farm/outbox/` AND rewriting their imports to relative paths (the
  public-surface verdict refuses any carried file containing an absolute drive path). All three
  are dated ~2026-09-10 (four weeks stale); LONGCAT-26's source was already in
  `research/archive/2026-09/`. Retired instead of reworked; sources left in place.

Key structural discovery: the dry-run refusals for all of Group A came from the LIBRARY source
(`farm/prompts/copies/lane-drafts__*.md` entries in `farm/prompts/index.json`), NOT from the draft
source — so the first fix attempted (EXCLUDE list) alone changed nothing. Both mechanisms were
needed. `farm/prompts/index.json` was generated once on 2026-09-11 and has no builder script;
`queue-author` treats `farm/prompts/` as read-only input ("the index is a cache, the gate is the
truth").

## 2. What changed

1. `scripts/lane-drafts-unrun.mjs` (workspace repo, **uncommitted working-tree change** — the file
   is untracked in the deny-by-default evidence repo; see §4 F6): the 7 Group A ids added to the
   designed `EXCLUDE` regex list, fully anchored `^(...)$`, with a comment naming the date and
   reason. Sibling ids verified unaffected (e.g. `LONGCAT-TASKING-38-LANE-REAUDIT-PART2`, which
   has a real outbox artifact, still scans).
2. `farm/prompts/index.json` (farm repo, commits `152f845a` + `02c06291`): 10 entries added to
   the designed `not_copied` list — the 7 Group A library copies + the 3 Group C entries —
   `pattern: "workspace-root-path"` (leak-gate vocabulary; F4 rename from the first attempt
   `"workspace-path"`). `counts.refused` 88 → 98. `CONFORMANCE-VERDICT-RECLASS-1` deliberately
   NOT retired. NOTE: the farm repo's own tick automation pushes commits to
   `github.com/PostOakLabs/ainumbers-farm` — both farm commits are live on origin without any
   manual push (observed: origin/main tip `44e7f699` deadman landed atop `152f845a`).
3. `scripts/queue-author.mjs` + `scripts/queue-author.test.mjs` (working-tree, comments only):
   "the 88" comments updated to "the 88 + 10 workspace-root-path retires, 2026-10-08". The runtime
   SKIP-reason string `source is in the index's leak-gate refusals (not_copied)` was left
   byte-for-byte intact because `queue-author.test.mjs:178` pins it.

## 3. Verification

- `node --test scripts/queue-author.test.mjs` — pass 1, fail 0 (after every change).
- `farm/prompts/index.json` JSON-parses after each edit.
- Full dry-run `--bus auto|aspire`: `AUTHORING-REFUSALS 11 → 1`; the 10 retired entries print
  `SKIP <id> source is in the index's leak-gate refusals (not_copied)`; dry-run still ends
  `NOOP nothing converted` (expected — this session removed false debt, created no supply).
- The 5 pre-existing library leak-gate `REFUSED` lines (outside-sandbox-path "C:\") were never in
  scope and remain untouched.

## 4. Adversarial review (2026-10-08, same session) — findings and dispositions

- **F1 stickiness (accepted, medium):** `not_copied` skips at cache level, so the gates never run
  on those 10 again; a future reword would stay invisible behind a SKIP line. Fail-safe direction
  verified: if the index is ever regenerated and the hand-added entries are wiped, all 10 fall
  back to being refused at the gates (their sources still carry workspace paths) — a regression
  returns NOISE, never wrongful dispatch.
- **F2 visibility loss (accepted, low):** the 7 excluded drafts vanish from
  `lane-drafts-unrun.mjs`'s direct CLI (line 153) that lists never-run work. The drafts remain in
  `research/lane-drafts/` and the EXCLUDE comment documents the situation. `DERIVED-DEPENDENCY-MAP-1`
  feeds `REGEN-COVERED-ORDER-FIX-2` (ORCH board) — that board row is now the only tracker.
- **F3 doc drift (fixed):** see §2.3.
- **F4 schema drift (fixed):** see §2.2.
- **F5 farm commits auto-pushed (observed, benign):** see §2.2 NOTE.
- **F6 durability (accepted):** the EXCLUDE change lives only in the working tree of an untracked
  file; a cleanup/reinstall would revert it. Revert direction is safe (refusals return). Whitelist
  + commit (FV-SEMANTIC-GAP precedent) was offered and declined for now.

## 5. Decision log (popup answers, 2026-10-08)

1. Group A method: **EXCLUDE list** in lane-drafts-unrun.mjs (over doc-only note or leave-alone).
2. Group C sources: **leave in place** (no archive moves in farm/workbuddy).
3. Adversarial follow-up: F3 **comments only** (SKIP-reason string + pinning test untouched);
   F4 **rename to `workspace-root-path`**; F6 **leave working-tree** (no whitelist).

## 6. Standing conclusions for future sessions

- aspire/msi idleness is a SUPPLY problem: the honest way to busy them is authoring NEW
  bus-shaped drafts (any lane; all buses carry all harnesses; `auto` picks the smallest effective
  queue), not defibrillating September's refusals.
- The remaining visible refusal debt is: `CONFORMANCE-VERDICT-RECLASS-1` (class b, inputs
  non-carryable) + 5 library leak-gate refusals + whatever `lane UNCLASSIFIED` lines exist. Do not
  "fix" these by path-stripping — `authoringVerdict()` refuses class (c) by design and the comment
  chain (FARM-TASKING-SANDBOX-PATHS-1, FARM-HARNESS-ENV-SCRUB-1) explains why.
- The gate-relevant reading order for anyone touching this again:
  `scripts/queue-author.mjs` §sandbox-path classes (~lines 285-400), `findWorkspacePaths` /
  `classifyPathTail` / `publicSurfaceVerdict` / `carryInputs` / `authoringVerdict`,
  `scripts/lane-drafts-unrun.mjs` `EXCLUDE` + `scanDrafts`, `farm/prompts/index.json`
  `not_copied` (98 rows as of this session).
