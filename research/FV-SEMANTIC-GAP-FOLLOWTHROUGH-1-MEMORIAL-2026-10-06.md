# FV-SEMANTIC-GAP-FOLLOWTHROUGH-1 — MEMORIAL (plan + three rigorous reviews + external best-practices check)

**Status:** PLAN ARTIFACT — nothing staged, nothing edited outside this memorial. Execution pending operator go. This file is the SSOT for the plan; the conversation that produced it is not. Currently gitignored scratch like the two docs it concerns; step D can optionally whitelist+commit it with one extra `!` line.

**Origin:** Operator-directed session, 2026-10-06 (EDT). Chain: (1) assessment verdict on `research/FV-SEMANTIC-GAP-COMPOSITION-PLAN-RIGOROUS-REVIEW-2026-10-06.md` + `VERIFICATION-FV-SEMANTIC-GAP-COMPOSITION-PLAN-RIGOROUS-REVIEW-2026-10-06.md` — both genuinely useful, three real corrections (C1–C3), one actionable defect (F9), zero estate follow-through; (2) operator ordered a safe plan for the four follow-through items; (3) three rigorous review passes (orchestrator-consumers / red-GitHub / no-humans-SO#0); (4) external best-practices web check; (5) this memorial.

**Seat discipline statement:** Two target surfaces sit inside the 7F automation's write fence (`board/TIM-QUEUE.md`, `board/queued/` per `board/reference/7F-KICKOFF-SEAT-1.md` §2). Execution proceeds under recorded operator direction per estate precedent (TIM-QUEUE line filed by SIDE-1 "7F owns from here"; LANE-DRAFT-BOARDPATH-REWORD-1 Tim-directed memorial). Every artifact written records the directive.

---

## §1 The four items (operator's list)

1. Stage the F9 fix as its own small row now — independent of any ruling.
2. Apply the verifier's recommended edits — as an appended §10 (append-only; §1–§9 of the research doc stay frozen).
3. Append the three real §8 ruling requests to TIM-QUEUE.
4. Whitelist + commit the two FV docs (currently gitignored, invisible to version control).

## §2 Verified facts the plan stands on (freshness-proofed this session; re-derive at execution — G1)

- **F9 premise:** `origin/main @ 54b3ce56a355509ddddb89b3a5050d1b08f57903` — exactly 3 files carry `// human_sign_off: sonnet-2026-08-17` at line 4 each: `art-645-compute-index-weights` (blob 6d2fcb2c…), `art-646-compile-rebalance-evidence-pack` (5a6b5e5d…), `art-647-record-index-correction` (56497279…); 671 proptest files on main; reproducing command: `git grep -n "human_sign_off: sonnet" origin/main -- 'chaingraph/kernels/__proptests__/*'`.
- **No repo gate reads the field:** grep over `repo/scripts/` + `repo/.github/` finds `human_sign_off` only in the two kernel templates; `proptest.template.mjs:6` carries `// human_sign_off: PENDING` — the relabel restores the template-canonical value and reduces the existing 3-format header drift. Main is green today while carrying the drift and the sonnet values — the edit stays inside the observed-tolerated envelope.
- **S1–S8, F7, C1, C2 reproduced twice:** F7 = dangling rejection-log reference at `FORMALVERIF-BUILD-SPEC.md:106` ("format + reason-code vocabulary defined there" — file nonexistent outside repo/). C1 = 68 rows are 1 `FV-PROPFLOOR-INFRA-1` + 67 shards (9/28/30; the doc's own grep returns 67). C2 = two unsigned FLOOR-§4 manifests exist (`research/FV-PROPFLOOR-SHARD-A-TERNARY-1/-2-MANIFEST.md`, status `floor-files-built-pending-signoff`) — "manifests exist, none signed."
- **C3:** 383/671 proptest files (57%) declare metamorphic/round-trip/permutation/idempotence properties (verifier's 425 ≈ directory-wide 737-entry count 424; number loose, direction solid) — the ledger's marginal value is the adjudication record, not the properties.
- **rulings-lookup:** NONE ×3 — `dafny shipped kernel differential` / `human sign off floor` / `invariance ledger metamorphic` — escalation is instrument-mandated.
- **Root repo:** origin = PostOakLabs/ainumbers (**PUBLIC**); `master` = workspace/evidence bundle, **unprotected** (sole active ruleset `main-ci-anchor` 20721322 targets `~DEFAULT_BRANCH` = main only, required checks + merge queue); **zero CI runs ever on master** (no workflows in master's 60-file tree); FARM-WATCH pushes master routinely (today: `0f6ef64db`). Deny-by-default `.gitignore` with explicit `!` lines (EVIDENCE-GITIGNORE-1 doctrine).
- **Live automations (CronList instrument):** 7f-seat **every 12h at :00** (kickoff doc's "4h at :10" is STALE — glm-verifier-seat is :10/4h); orch-autoboot 1h; farm-watch 4h at :20; queue-author daily 05:00 (converts `research/lane-drafts/` only — a research/-root append is invisible to it).
- **TIM-QUEUE steady state:** 16 unanswered `[OPEN]` lines, oldest visible 2026-09-28 — unanswered accumulation is normal and non-breaking; `TIM-NOW-2026-09.ps1` is a September one-off runbook, NOT a queue parser.
- **Pre-existing lint red (not ours):** board-lint advisory ratchet `fence-path-ambiguous: 4 > 0` on CGMCP-BENCH-WT-REPOINT-1 / PR2273-LINEAGE-BINDING-REPAIR-1 / ART704-USAGE-SCHEMA-1 (+1) — do not touch rows or baseline.
- **RAM-pressure refusals are real, not theoretical:** TIM-QUEUE open line 2026-10-01 documents the checkoff guard refusing at 3.51 GB free — board-next's hard-refusal needs a retry-later path.
- Pending `M .claude/settings.json` diff = additive permission allows only (no hook changes); `M board/reference/LANE-DRAFT-BOARDPATH-REWORD-1.md` = other seat's work. Neither enters our commit. No secret patterns in either FV doc.

## §3 The plan (steps A–D, amendments folded in)

**Pre-flight gates — all steps blocked until green:**
- **G1** Freshness: re-derive §2's F9 premise against current origin/main; if drifted, STOP and re-stage the row premise before anything else.
- **G2** Snapshot `git status`; the two pending M files are excluded by pathspec throughout.
- **G3** Record board-lint baseline; zero new debt tolerated (`--only` gate, below).
- **G4** No appends within ±5 min of an `:00`/`:10` hourly boundary (7f-seat 12h/:00; glm-verifier 4h/:10).
- **G5** Enumeration by `git grep`/`git ls-tree` only — never `find`/globs (SO #52).
- **G6** Read `classOf` in `scripts/gen-board-index.mjs`; use a recognized class tag in the row header (no invented vocabulary).

**Step A — append-only records.**
- A1: Append `## §10 FOLLOW-THROUGH RECORD (operator-directed, 2026-10-06, <session id>)` to the research doc after §9 (§1–§9 byte-untouched). Contents: (a) pointer to the separate verification file + the §0.5 deviation note; (b) C1/C2/C3 condensed corrections; (c) second independent re-check results (S1–S8, F9, F7, V3a reproduce; C3 = 383/671 with method); (d) follow-through acts with artifacts (row id, TIM-QUEUE lines, commit sha — filled at execution); (e) the verification-chain-closed sentence (Am. 6). Constraints: dated-observation phrasing only — never "awaiting/pending approval" (Am. 5); avoid the literals `spec_digest`/`kernel_digest` and digest-shaped strings (staleness gate scans `research/FV-*`, Am. 2); single atomic write (Am. 10).
- A2: Short dated addendum to the verification doc: second re-check + C3 delta (383 vs 425, both methods stated) + §10 pointer. Same constraints.

**Step B — TIM-QUEUE lines (3, +1 optional).** Format exactly `- [OPEN] <UTC> <one yes/no question> — context: <files>; rulings-lookup NONE (<keywords>)`.
- Q1 (§8.1 / FVS-§6.C.6): adopt the Dafny-compiled JS as the shipped kernel for art-215 (middle link verified) vs keep the differential bridge (link stays empirical, stated on every surface) — yes/no.
- Q2 (§8.2 / step 0): adopt the two-depth invariance-ledger recommendation (full ledger on FVS-§3 spec files; minimal APPLIES/DOES-NOT-APPLY checklist for float_sensitive floor files) — yes/no/pick-one/reject.
- Q3 (§8.3 / FVS-§7a): does machine-mediated back-translation referent checking stay inside `human-reviewed-novel` — yes/no (no = own label; reconcile before the first post-adoption NOVEL signs).
- Q4 (**optional, operator confirms at go**, Am. 12): keep the workspace/evidence bundle on the public repo's master (prior-art timestamp value) vs move to a private repo (GitHub/Snyk/Check Point consensus for internal ops content); if kept, is a periodic leak-audit row wanted?
- Rollback: flip `[OPEN]` → `[WITHDRAWN <UTC> <reason>]`; never delete. §8.4 is a gate note (not filed); §8.5 is discharged by the step-C row itself.

**Step C — stage `FV-FLOORSIGN-MISLABEL-1`.**
- C1: Draft in `board/drafts/` modeled on `board/done/FV-C2-REMEDIATE-1.md` shape; recognized class tag (G6); FLASH model. Body: premise with the origin/main freshness quote + blob shas + reproducing command; the exact edit — line 4 of each of the three files `// human_sign_off: sonnet-2026-08-17` → `// human_sign_off: PENDING` plus ONE provenance comment line that PRESERVES the original value verbatim and names this row + date (Am. 11 — correct the claim, never erase the trace; Part 11 audit-trail discipline); `prove: NONE — no kernel bytes change (proptest header comments only)` (SO #62); explicit `SO #26 n/a — comment-only diff, no rendered surface` (Am. 8); alternative left open (FLOOR-§4 manifest re-cover); absolute-path fence (SO #3b; avoids fence-path-ambiguous); SO #8 one-liner (red-not-ours → stop, note, don't grind); done-items phrased as named gate results (SO #41): land-verify green + `git grep -c "human_sign_off: sonnet" origin/main -- 'chaingraph/kernels/__proptests__/*'` → 0 post-merge + fence respected (3 files in diff) + checkoff via `scripts/checkoff.mjs`.
- C2: `node scripts/board-lint.mjs --only FV-FLOORSIGN-MISLABEL-1` → clean, else fix the row, never the baseline.
- C3: Move `board/drafts/` → `board/queued/`; regenerate the index with the documented single-writer command `node scripts/board-next.mjs --index`; verify the row lists sanely. RAM-floor refusal → retry later, never force (Am. 4); instruments scan directories live, so a stale cache blocks nothing.
- C4: No channel post (SIDE-1 precedent). Rollback: pre-claim, delete + regen; post-claim it is the builder's row.

**Step D — whitelist + commit + push (after A).**
- D1: `!` lines in `.gitignore` — one for the research doc (research block, after line 27), one for the verification doc (root-md block); optional third for this memorial if the operator wants it in the same commit.
- D2: Verify blast radius: `git check-ignore` flips exactly the named files; `git status --porcelain` delta = exactly those entries, nothing else.
- D3: Commit by explicit pathspec (`.gitignore` + the doc(s) ONLY — never the pending M files); message `FV-SEMANTIC-GAP-FOLLOWTHROUGH-1 (2026-10-06): …` summarizing A–C.
- D4: `git fetch origin && git rebase origin/master`, then push. The farm-watch master-push race is real — on non-fast-forward rejection, ONE rebase-and-retry, then STOP-and-report (Am. 1); never force. Unattended default = push (FARM-WATCH precedent, Am. 7); if push fails twice, the next FARM-WATCH master push carries the local commit. No CI fires on master; master is unprotected; the repo is PUBLIC and the disclosure is accepted as ≤ existing master content. Hook denial = STOP-quote-report (SO #37).

**Order:** gates → A → B → C → D. Any unexpected red (lint, hook, check-ignore delta ≠ expected, push) = STOP-and-report, never route-around.

## §4 The twelve amendments (consolidated)

1. Fetch+rebase immediately before the master push; one retry, then stop (farm-watch race).
2. §10/addendum avoid `spec_digest`/`kernel_digest` literals and digest-shaped strings (staleness-gate visibility).
3. Row class tag from `classOf`'s recognized vocabulary, verified by lint + index regen.
4. board-next RAM-floor refusal → retry-later, never force.
5. All record phrasing as dated observations; never wait-state language.
6. §10 carries the verification-chain-closed sentence (prevents a future seat staging verification pass #3+).
7. Unattended push default = push; the hold option exists only when a human is present.
8. Row states SO #26 n/a explicitly (comment-only diff, no rendered surface).
9. Schedule facts corrected from the live instrument: 7f-seat 12h at :00 (kickoff doc stale); glm-verifier-seat :10/4h; farm-watch :20/4h.
10. All appends are single atomic writes.
11. The F9 provenance comment preserves the original `sonnet-2026-08-17` value verbatim — correct the claim, never erase the trace.
12. Optional fourth TIM-QUEUE line: public-master-vs-private-repo ruling (+ leak-audit row if kept).

## §5 Review passes, condensed

- **Pass 1 — orchestrator/estate consumers:** all four steps safe; seat-fence surfaces carry operator-direction precedent; QUEUE-INDEX is generated (regen is the only sanctioned edit); done-items must be gates (SO #41); every STOP condition named.
- **Pass 2 — red-GitHub:** zero runs ever on master; only ruleset targets the default branch; no repo gate reads `human_sign_off`; PENDING is template-canonical; TIM-NOW is not a queue parser; pending settings diff harmless; secrets clean; merge-time red-main is SO #8's case, not ours; known systemic red classes (trust-signals input-touch, art-596 expect-red, scripts-verify) are content-class-specific and inapplicable to a comment-only diff.
- **Pass 3 — no-humans (SO #0):** the estate is already a headless machine (18 automations; the row's full lifecycle ran unattended today); silence answers Q1–Q3 "NO" and every NO lands on a consistent estate; every stall endpoint is inert-by-design; both human branch points default non-blocking; schedule facts corrected; anti-make-work sentence added.
- **Pass 4 — external best practices:** 21 CFR Part 11 signature-attribution, NIST AI RMF / ISO 42001, EU AI Act Art. 14 validate F9 and the escalation design; in-toto/SLSA support a **named future row** (NOT this plan): one canonical machine-readable sign-off header (`sign_off: {state, actor_type, actor, date, meaning}`) + CI lint — retires the 3-format drift class and makes F9-class mislabels mechanically impossible; public-repo divergence flagged → optional Q4; escalation aging line (oldest-OPEN age in the 7F summary) = estate-level nicety, no action here.

## §6 Named residuals (accepted)

Three questions may go unanswered forever (status quo preserved — no step depends on a favorable answer). A parked builder leaves the mislabel in place (pre-existing state, no regression). The 383-vs-425 C3 discrepancy stays unadjudicated (both methods recorded). A RAM-refused index regen leaves a stale cache that self-heals on any later regen. Nobody ever reading §10 is fine — it exists for the next headless seat that touches the FV program.

## §7 Verification handoff (operator-sanctioned single pass)

The dispatch sentence, verbatim:

> Read `C:/dev/Claude/Projects/AINumbers/research/FV-SEMANTIC-GAP-FOLLOWTHROUGH-1-MEMORIAL-2026-10-06.md` and, in one bounded pass, independently re-derive its §2 facts against the live estate, attack §3's plan for anything the three recorded reviews missed (orchestrator breakage, red-CI vectors, or unattended-mode rot), and append a dated `## §8 VERIFIER FINDINGS` section here with corrections and any enhancements — staging nothing, editing nothing outside this file, and re-running nothing already twice-confirmed.

Stop rules for the verifier: append-only to this file; no staging; no re-verification of double-confirmed checks; enhancements requiring new machinery enter as named future rows, not plan growth; if §2's facts have drifted, record the drift first and stop before judging §3.

---

## §8 VERIFIER FINDINGS

**Provenance.** Independent single pass, 2026-10-06, by a verifier seat running the `ainumbers-memorial-claim-verification` discipline. Instruments used: `git` against `origin/main` (fetched, not the shared worktree), `gh api` (authed as `collectrix`), `scripts/board-lint.mjs`, `scripts/rulings-lookup.mjs`, `scripts/board-next.mjs`, direct `ls`/`git grep` on the workspace root. Nothing staged; nothing edited outside this file; no check that §2 already marks as twice-confirmed was re-run beyond the cheap exit-code confirmations needed to grade its dependent step. Scratch removed.

### §8.0 Drift ledger (recorded first, per §7 stop rule)

**D-a — the pinned F9 SHA has moved (§2 bullet 1).** §2 pins the premise at `origin/main @ 54b3ce56a355509ddddb89b3a5050d1b08f57903`. Live `origin/main` is now **`445e141bcac906de5d53b394720f2eb7652d10dd`** (`chore(derived): regenerate shared derived artifacts on main`). `54b3ce56` is a **direct ancestor** of `445e141b`; **12 commits** intervened, all unrelated to FV (prove `PROVE-X402-PERMIT2-1` #2299, `PROVE-ART704-AI-SPEND-1` #2295, heals `WEBMCP-CPARITY-ART557-1` #2298, `ART704-DEFAULT-SNAPSHOT-1` #2296, `SCENE-REQUIRED-GATE-1` #2294, plus 4 bot `chore(derived)` regens).

**Drift verdict: SHA-ONLY, substance intact.** The drift **does not invalidate** any §2 substantive fact — verified three ways:
- none of the 12 commits touches the three F9 files (`git log 54b3ce56..origin/main -- chaingraph/kernels/__proptests__/art-645* art-646* art-647*` → empty);
- the proptest population is **671 at both pins** (`git ls-tree … | grep -c '\.proptest\.mjs$'`);
- the three blob shas are **unchanged** (§8.1).

⇒ §3's gate **G1** (re-derive the F9 premise; STOP if drifted) fires, and its correct action is **re-pin the SHA in the C1 row premise to the then-current `origin/main` at claim time** — not a STOP. The plan's own freshness discipline is doing its job; the memorial simply could not freeze a moving `main`. Recorded as a §8 correction to §2 bullet 1's literal text, not as a plan defect.

### §8.1 §2 re-derivations — CONFIRMED

Each command below was run this pass; every number is the live re-derivation.

| §2 claim | Verified | Evidence |
|---|---|---|
| F9: exactly 3 files carry `// human_sign_off: sonnet-2026-08-17` at line 4 | ✅ | `git grep -n … origin/main -- 'chaingraph/kernels/__proptests__/*'` → art-645/646/647, all `:4` |
| blob shas 6d2fcb2c… / 5a6b5e5d… / 56497279… | ✅ exact | `git rev-parse origin/main:chaingraph/kernels/__proptests__/art-645-compute-index-weights.proptest.mjs` → `6d2fcb2cb1412a612668907812de11e2e4bdc47c` (and 646→`5a6b5e5dc3c83fd04e60052bc437bcb54e88612a`, 647→`564972799addcc0c721671fdc257d49e2a45f7d2`) |
| 671 proptest files on main | ✅ | `git ls-tree -r --name-only origin/main -- chaingraph/kernels/__proptests__/ \| grep -c '\.proptest\.mjs$'` → `671` (dir has 738 entries total) |
| No repo gate reads `human_sign_off` | ✅ | `git grep human_sign_off origin/main -- scripts/` → only `scripts/kernel-templates/proptest.template.mjs:6` + `scripts/kernel-templates/fixtures.template.json:3`; `.github/` → **zero** |
| `proptest.template.mjs` line 6 = `// human_sign_off: PENDING` | ✅ | `git show origin/main:scripts/kernel-templates/proptest.template.mjs \| sed -n 6p` |
| C1: 68 rows = 1 `FV-PROPFLOOR-INFRA-1` + 67 shards (9/28/30) | ✅ exact | `ls board/*/FV-PROPFLOOR-SHARD-A-*.md` = **9**, `-B*-1.md` = **28**, `-C*-1.md` = **30** ⇒ 67; `+1` INFRA-1 = **68**; all in `board/done/` (`queued`:0, `claimed`:0). The doc's own `grep -oiE "FV-PROPFLOOR-SHARD-[ABC]"` returning 67 also replicates. |
| C2: two unsigned FLOOR-§4 manifests exist in `research/` | ✅ | `research/FV-PROPFLOOR-SHARD-A-TERNARY-{1,2}-MANIFEST.md`; front-matter `status: floor-file(s)-built-pending-signoff`; both `"status": "PENDING"` under `## Signature`; name/date BLANK |
| C3: 383/671 (57%) declare metamorphic/round-trip/permutation/idempotence | ✅ **exact** | `git grep -liE 'metamorphic\|round-?trip\|permutation\|idempoten' origin/main -- 'chaingraph/kernels/__proptests__/*.proptest.mjs' \| wc -l` → **383** ⚠ **case-insensitive `-i` is required** — without it the same pattern returns **380**. Term histogram: metamorphic 302 · permutation 126 · round-trip 92 · idempoten 8 |
| F7: dangling rejection-log ref at `FORMALVERIF-BUILD-SPEC.md:106` | ✅ (see §8.2, upgraded) | line 106 = the "Send-back-to-step-1 appends one line to `research/FV-SPEC-REJECTION-LOG.md`" sentence |
| rulings-lookup NONE ×3 | ✅ | `scripts/rulings-lookup.mjs` with the three exact keyword sets → each `0 matching line(s) … NONE → answer is ESCALATE` |
| Root origin = PostOakLabs/ainumbers, **PUBLIC** | ✅ | `gh api repos/PostOakLabs/ainumbers --jq '.visibility'` → `public`; `.default_branch` → `main` |
| master **unprotected** | ✅ | `gh api …/branches/master/protection` → `Branch not protected` (HTTP 404) |
| sole active ruleset `main-ci-anchor` **20721322**, target `~DEFAULT_BRANCH` = main only | ✅ | `gh api …/rulesets` → 1 ruleset, id `20721322`; `conditions.ref_name.include = ["~DEFAULT_BRANCH"]`; rules = `required_status_checks` + `merge_queue` |
| **zero CI runs ever on master**; master tree = 60 files, no workflows | ✅ | `gh api '…/actions/runs?branch=master' --jq .total_count` → **0** (vs 30,894 all-branch); `git ls-tree -r master \| grep -c .github/workflows/` → **0**; `git ls-tree -r master \| wc -l` → **60** |
| FARM-WATCH pushes master routinely (today `0f6ef64db`) | ✅ | root `HEAD` = `0f6ef64db`; `git ls-remote --heads origin master` → `0f6ef64db` |
| live automations: glm-verifier-seat **:10/4h**; farm-watch **:20/4h**; orch-autoboot **1h**; 7f-seat kickoff doc "4h at :10" is **STALE** | ✅ | `GLM-VERIFIER-SEAT-PROMPT.md:1` "every 4 h at :10"; `FARM-WATCH-PROMPT.md:1` "every 4 h at :20"; `README-ZCODE-WAVE2…:42` orch-autoboot "1h"; `7F-KICKOFF-SEAT-1.md:8` still reads "`7f-seat (4h)`: cron `10 */4 * * *`" ⇒ kickoff doc genuinely stale |
| RAM-refusal real: 2026-10-01 line documents checkoff refusing at 3.51 GB free | ✅ | `board/TIM-QUEUE.md:75` — free RAM `3.51 GB < 5 GB floor` |
| `TIM-NOW-2026-09.ps1` is a Sept one-off runbook, not a queue parser | ✅ | `board/TIM-NOW-2026-09.ps1` — interactive y/n prompts for token-paste + countersigns; no TIM-QUEUE parsing |
| 7F seat-fence surfaces = `board/TIM-QUEUE.md` + `board/queued/` | ✅ | `7F-KICKOFF-SEAT-1.md:20-21` §2 Write fence names both |
| TIM-QUEUE appender precedent (SIDE-1 "7F owns from here"; LANE-DRAFT Tim-directed) | ✅ | `board/TIM-QUEUE.md:13-16` carry `recorded by SIDE-1` lines; `board/reference/LANE-DRAFT-BOARDPATH-REWORD-1.md:1` "(2026-10-06, Tim-directed)" |
| `classOf` tag = `gen-board-index.mjs` | ✅ (path exact) | `classOf` at `scripts/gen-board-index.mjs:32` |
| board-next RAM floor + `--index`; board-lint `--only`; checkoff `--message-file`/`--gate-receipt` | ✅ | `board-next.mjs:26` RAM-FLOOR GUARD / `:35` HARD-REFUSES / `:683` `--index`; `board-lint.mjs:2067` `--only`; `checkoff.mjs:23` flags, `:480` argv guard |
| FV-C2-REMEDIATE-1 template row exists | ✅ | `board/done/FV-C2-REMEDIATE-1.md`, header `- **FV-C2-REMEDIATE-1** [**R** — research only, **SONNET**]` |
| Staleness gate consults FV docs (§3 Am. 2 basis) | ✅ | `scripts/check-fv-attestation-staleness.mjs` reads `research/FV-*-ATTESTATION.md` + `research/FV-CHALLENGE-LOG.md`; `spec_digest`/`kernel_digest` literals live in ≥6 scripts |

### §8.2 §2 CORRECTIONS

**C-a — "16 unanswered `[OPEN]` lines" is a method artifact; the true count is 15.** §2 bullet "TIM-QUEUE steady state" says 16. Line-start `grep -c '^\- \[OPEN\]' board/TIM-QUEUE.md` = **15**. A substring `grep -c '\[OPEN\]'` returns **16 only because line 1 is the file's own header/format line** (`` - [OPEN] <UTC> …`` template). The 16th hit is not a blocker. Use the anchored count. (Adjacent, unchanged: oldest OPEN = line 70, `2026-09-28T23:10Z` — §2's date is right. Full stamp histogram: 42 `[ANSWERED-TIM`, 15 `[OPEN`, 11 `[ANSWERED`, 10 `[ANSWERED-`, 4 `[WITHDRAWN-`, 3 `[ANSWERED-BY-EVENTS-`, 1 `[SUPERSEDED-`, 1 `[PARTIALLY`.)

**C-b — the "3-format header drift" is an 8-format drift, and 3 proptests carry NO `human_sign_off` line at all.** §2 ("the relabel … reduces the existing 3-format header drift") understates the surface. Live `git grep -h 'human_sign_off' origin/main -- 'chaingraph/kernels/__proptests__/*.proptest.mjs'` yields **8 distinct line-4 values**:
- 402 × `// human_sign_off: PENDING`
- 249 × `// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec §4)`
- 7 × `// human_sign_off: PENDING — manifest-style signing per FV-PBT-FLOOR-BUILD-SPEC.md §4 (revised);`
- 4 × `// human_sign_off: PENDING (this row does not sign — manifest-level signature per spec).`
- **3 × `// human_sign_off: sonnet-2026-08-17`** ← the F9 rows
- 1 × `… per spec §5)` · 1 × `… per spec §3)` · 1 × `… per spec §4)` (double-dash variant)

That is **668 files carrying the field** — leaving **3 proptests with no `human_sign_off` line whatsoever**: `art-618-naic-clo-rbc-factor-calculator`, `art-621-summa-mst-liability-aggregator`, `art-677-whistleblowing-channel-clock`. **Consequence for step C:** the F9 row's claim that the relabel "restores the template-canonical value **and reduces the header drift**" is true but **much weaker than stated** — the relabel touches 3 of 668 fields and cannot be sold as drift reduction. Worse, the **genuinely canonical-deficient** cohort (the 3 missing-header files) is a *different* fix that the F9 row will not touch. Do **not** let C1 absorb that cohort (scope creep); name it as a separate future row (§8.5, R1) or leave it.

**C-c — the "pre-existing lint red" snapshot is stale in its named carriers, and the declared baseline row set has changed.** §2 names the fence-path-ambiguous carriers as CGMCP-BENCH-WT-REPOINT-1 / **PR2273-LINEAGE-BINDING-REPAIR-1** / ART704-USAGE-SCHEMA-1 (+1). Live `board-lint.mjs --json` carriers are **CGMCP-BENCH-WT-REPOINT-1, ART704-USAGE-SCHEMA-1, MUSE-SITE-COUNTS-1** (+1), with **T1-ALLOC-EVIDENCE-REPAIR-1** now a **`🛡 shielded`** entry (baseline `shielded[]`, since `2026-09-27T12:55:19Z`). **PR2273-LINEAGE-BINDING-REPAIR-1 no longer carries the class; MUSE-SITE-COUNTS-1 is new.** The **count is still `4 > 0`** (`[7 measured − 3 shielded]`), so §2's headline number is right and its "do not touch rows or baseline" instruction stands — but the **row names are wrong** and a future seat would hunt the wrong files. Also newly present and not in §2: `art-nn-reservation-mismatch` findings for **art-699** (row `ART699-LEAN-KECCAK-MEASURE-1` vs RESERVATIONS pr=2133) and **art-701** (row `ART701-EXEC-ANOMALY-1` vs RESERVATIONS pr=2177), and `art-nn-missing-reservation: 5`. None is ours; all are pre-existing.

**C-d — `queue-author` is currently DISABLED (2026-10-06), which §2 omits.** §2 states queue-author's schedule (daily 05:00) and source (`research/lane-drafts/` only) correctly, but omits that **its kill criterion tripped today**: `board/reference/LANE-DRAFT-BOARDPATH-REWORD-1.md:98-100` — *"Automation 1 (`queue-author (daily convert)`) kill criterion **TRIPPED 2026-10-06**: the tick had logged three REFUSED-by-leak-gate conversions … disable until this fix lands and one clean tick runs."* **Impact on §3: none** — no step depends on queue-author (A = manual append; B = manual TIM-QUEUE edit; C = `board-next.mjs --index`; D = manual commit). Recorded because a future headless seat reading §2 would wrongly assume lane-drafts still convert, and because the fact sits in the very file §2 dismisses as "other seat's work" (it is also one of the two pending root `M` files, §8.3 D-b).

**C-e — F7 upgraded from "stale prose" to "a ✅ DONE row whose named deliverable is absent."** §2's F7 says the spec's "format + reason-code vocabulary defined there" reference is dangling. True — **but the sharper fact is that `board/done/FV-REJECT-LOG-1.md` is marked ✅ DONE (claude, 2026-08-09): "log format+reason vocab @ research/FV-SPEC-REJECTION-LOG.md"**, and **`research/FV-SPEC-REJECTION-LOG.md` does not exist** — not on disk, not in root `git ls-files`, not in `repo/`'s tree (`git check-ignore` shows it caught by `.gitignore:6` `*`, i.e. it is a normal gitignored scratch path, *not* evidence it was tracked and deleted). This is a **Rule 14 inversion** (board DONE ≠ landed file). It is **not** a purge: the surrounding FV research artifacts survive (22 `research/FV-*` files including `FV-CHALLENGE-LOG.md`, both TERNARY manifests, and `research/clause-snapshots/`), so the absence is **targeted**. ⇒ The F9 row (step C) does **not** fix this and should not claim to; it is a **separate defect** worth its own row (§8.5, R2), because the §5 step-3 send-back path §2's own pipeline depends on points at a file that was never written.

**C-f — §2's dirty-tree inventory covers the root repo only.** §2 (and G2) name two pending `M` files — root `.claude/settings.json` + root `board/reference/LANE-DRAFT-BOARDPATH-REWORD-1.md` — which I confirm exactly. But the **`repo/` worktree is also dirty: ` M CONTRACT.md` + ` M CONTRACT-RATIONALE.md`** (`git -C repo status --porcelain` → 2 lines). G2/G5/D4 all *read* `repo/`, so a seat that trusts §2's "the two pending M files" as a global snapshot could mis-read a `repo/`-scoped `git status`. G2 is correct as written **for the root commit**; the finding is that §2's phrasing ("Snapshot `git status`") should be scoped to the root repo, and `repo/`'s two files named as out-of-scope too.

### §8.3 §3 attack — defects the three recorded reviews missed

**D1 (RED-CI VECTOR — plan-breaking). Step C2's verification command cannot go green as written.** §3 C2: *"`node scripts/board-lint.mjs --only FV-FLOORSIGN-MISLABEL-1` → clean, else fix the row, never the baseline."* `board-lint.mjs:2054` computes the **RATCHET from the FULL findings set, BEFORE `--only` filters**, and `:2063` notes `--only` *"still exits on any blocker."* **Measured this pass, on a row that does not yet exist:**
```
node scripts/board-lint.mjs --only FV-FLOORSIGN-MISLABEL-1                    → rc=1
node scripts/board-lint.mjs --only FV-FLOORSIGN-MISLABEL-1 --no-ratchet       → rc=0
node scripts/board-lint.mjs --only FV-FLOORSIGN-MISLABEL-1 --json → finalExit: 1
```
With the pre-existing `fence-path-ambiguous: 4 > 0` debt standing (C-c), **C2 as literally scripted returns exit-1 even when the new row is blameless** — the builder will read a false red and, per §3's own "STOP-and-report on unexpected red," **stall**. **Fix:** C2 must run `--only <ROW> --no-ratchet` (isolates the row's own classes) **and** separately confirm the ratchet head has not moved (`--json` → `exceeds` unchanged, carrying rows still ≠ FV-FLOORSIGN-MISLABEL-1). Do not "fix the row" to chase a red that is not the row's. This is precisely a red-CI vector; Pass 2's "systemic red classes … inapplicable to a comment-only diff" assessed the *diff*, not the *gate command*, and missed it.

**D2 (UNATTENDED ROT — silent false-clean). Step C3's regen check has no verifier for the exact failure it guards.** C3: regen via `node scripts/board-next.mjs --index`, and on RAM refusal "retry later, never force (Am. 4); instruments scan directories live, so a stale cache blocks nothing." But **the index file is GENERATED and marked `do not hand-edit` (`board-next.mjs:686`)** — and its freshness is not asserted by any gate in §3's step list. In unattended mode a RAM refusal is *invisible*: the seat waits, and if it ever returns, nothing distinguishes "regenerated" from "stale-but-identical-looking." ⇒ Add to C3 a one-line freshness assertion in the done-items (SO #41 style): regenerate then re-run `--index` with the RAM floor satisfied and diff the generated header timestamp, **or** record explicitly that the index was *not* regenerated and the queued row is visible only via directory listing. "Blocks nothing" is true for dispatch and false for a headless seat's confidence.

**D3 (ORCHESTRATOR/WRITE-FENCE — under-declared, currently inert). Step D writes `.gitignore`, which is inside `repo/`'s *sibling* space, not `repo/` — but D3's pathspec hygiene depends on a clean root.** D3 commits "by explicit pathspec (`.gitignore` + the doc(s) ONLY)." `.gitignore` is a **tracked** root file (whitelisted by its own `!.gitignore`), so the pathspec is valid **and** `git status --porcelain` delta is exactly 3-ish entries — **provided the two pending root `M` files are never added**. Confirmed: `git status --porcelain` root = exactly ` M .claude/settings.json` + ` M board/reference/LANE-DRAFT-BOARDPATH-REWORD-1.md` today. **The unmet guard is that D2's "delta = exactly those entries, nothing else" must be computed AFTER the `.gitignore` edit, and the edit itself makes `.gitignore` an entry** — so the expected delta is `{M .gitignore, ?? <the 1–3 newly-whitelisted docs>}`, **not zero and not the pre-edit set**. As phrased, D2's "exactly those entries" is unanchored and invites a false STOP. Name the expected post-edit delta explicitly.

**D4 (RED-CI VECTOR — not covered). Step D4's push can trip the `repo/`-side gates on the *root* commit's behalf — no, but it can trip on the memorial's own digest-shaped strings.** §3 Am. 2 forbids `spec_digest`/`kernel_digest` literals in §10/addendum because a staleness gate scans `research/FV-*`. **Verified the gate is narrower and the risk lower than §2 implies:** `check-fv-attestation-staleness.mjs` filters **`research/FV-*-ATTESTATION.md`** (a hardcoded `readdirSync` glob) and consults `research/FV-CHALLENGE-LOG.md`; the §10 append targets the *composition-plan* doc and the *memorial* — **neither is `*-ATTESTATION.md`** — so the literal prohibition is *probably* moot. **However** `spec_digest`/`kernel_digest` literals are read by **≥6 scripts** (`ci-red-digest.mjs`, `ci-red-triage.mjs`, `shadow-verify-receipt.mjs`, `fv-twin-harness.mjs`, …). Keep Am. 2's prohibition as **cheap insurance**, but correct its *stated reason*: it is a blast-radius hedge, not a single-gate avoidance. (No action change; rationale correction only.)

**D5 (UNATTENDED ROT — the plan's own STOP discipline can deadlock a headless seat).** §3's order ends: "Any unexpected red (lint, hook, check-ignore delta ≠ expected, push) = STOP-and-report, never route-around." Combined with **D1's guaranteed false red**, a headless seat has no path forward and no human reading the report — Pass 3's "silence answers every NO" reasoning did not consider that **a STOP triggered by the plan's own instrumentation defect is not a NO, it is a wedge.** ⇒ D1's fix removes the wedge; additionally, §3 should state that a STOP whose *cause is proven pre-existing* (as C-c documents the ratchet debt) is a **record-and-proceed**, not a halt. This is the one place where the plan's discipline and unattended operation conflict.

**D6 (minor — orchestrator breakage, bounded). The `--index` regenerator and the F9 row are serialized on nothing, but `board/queued/` is a 7F-fenced surface.** C3 moves `board/drafts/` → `board/queued/` and regens. `7F-KICKOFF-SEAT-1.md:20` puts `board/queued/` in the 7F fence. §2's seat-discipline statement covers this via recorded operator direction (SIDE-1 precedent, verified §8.1). **The residual risk the reviews did not name: the 7F automation runs every 12h at :00 and also writes `board/queued/` (new rows from drafts) and regenerates via its own path** — so a 7F tick interleaving between C3's move and D3's commit can produce a `board/queued/` diff outside our pathspec (harmless to the pathspec commit, but it will change D2's "delta" reading). G4's `±5 min of :00/:10` window is the right guard; §8 recommends widening it to **±10 min** for the step-C→D window specifically, since the regen itself is not instantaneous.

### §8.4 §2 facts NOT independently re-derived (out of the bounded pass / twice-confirmed)

Per §7's "no re-verification of double-confirmed checks," these were **accepted as-is**, not re-run: the F9 premise's "main is green today" state (I confirmed the *field is gate-free*, not a full green run); the external best-practice citations in §5 Pass 4 (21 CFR Part 11, NIST AI RMF/ISO 42001, EU AI Act Art. 14) — a source-fidelity review, not an estate review; the 7F automation's live registration state (I verified the *prompt docs*, not `Get-ScheduledTask` — the automation instrument was not exposed to this seat); the four `FV-PROPFLOOR` shard *contents* (counts verified, bodies not read). Also **unverifiable from here**: the 7f-seat's actual current cadence as *registered* (the estate's own kickoff doc is stale by §2's own finding, and only the registration instrument could settle it — §2 asserts `CronList` as the source; I could not reach it).

### §8.5 Named future rows / enhancements (NOT plan growth — per §7 stop rule)

- **R1 — `FV-PROPTEST-HEADER-NORMALIZE-1`** (future, FLASH): the **3 proptests with no `human_sign_off` line** (`art-618`, `art-621`, `art-677`) + the **8-format** field drift (C-b). One canonical header per the Pass-4 recommendation (single `sign_off: {state, actor_type, actor, date, meaning}`), mechanically enforced. This retires the drift class; it is *not* the F9 row and must not be folded into it.
- **R2 — `FV-REJECTION-LOG-MATERIALIZE-1`** (future): reconcile `FV-REJECT-LOG-1`'s ✅ DONE claim with the absent `research/FV-SPEC-REJECTION-LOG.md` (C-e). Either materialize the log+vocabulary the row says it shipped, or record the row as a **false-done** and re-scope. The §5 step-3 send-back path points at it; a gate cannot currently tell.
- **R3 — `BOARD-LINT-ONLY-EXIT-CONTRACT-1`** (future, cheap): document — in `board-lint.mjs`'s usage block and the 7F/builder preambles — that **`--only` does not suppress the ratchet exit**, and that per-row cleanliness must be read with `--no-ratchet` or via `--json`. Prevents every future seat from re-deriving D1's false red. (A one-paragraph docs fix, not a behaviour change.)
- **R4 — `RESERVATIONS-MISMATCH-ART699-701-1`** (future, if not already owned): the two live `art-nn-reservation-mismatch` findings (C-c) — rows `ART699-LEAN-KECCAK-MEASURE-1` / `ART701-EXEC-ANOMALY-1` vs `RESERVATIONS.json` pr-maps. Flagged, not claimed; may already be another seat's.

### §8.6 What survives untouched

§3's **architecture** is sound and needs no re-planning: the gate set (G1–G6) is correctly aimed; **G1 fires as designed and its remedy is a re-pin, not a STOP** (D-a); the four-step order (A append-only → B TIM-QUEUE → C stage row → D whitelist+commit) is the right decomposition; the **rollback** definitions (B: `[OPEN]`→`[WITHDRAWN …]`; C: pre-claim delete+regen) are correct and non-destructive; the **argv-trap dodge** (`--message-file`/`--gate-receipt`, checkoff.mjs:23) is real and correctly cited; the **branch/disclosure posture** (root master unprotected, PUBLIC, zero CI runs, push-default) is verified fact-for-fact. Every actionable defect above is a **localized fix to a command line or a named row**, not a change of direction. The plan does not need a fourth review pass; it needs **D1's `--no-ratchet`** plus the C-c/C-b corrections applied at execution.

**One-line verdict:** §2 is **substantively sound** — the F9 premise, C1/C2/C3, F7, rulings-lookup, root-repo facts and schedules all reproduce (the pinned SHA has drifted 12 commits, SHA-only, re-pin at claim); **§3 has one plan-breaking red-CI defect (C2's `--only` cannot exit 0 against standing ratchet debt), one under-declared write-fence delta (D2/D3), and one unattended-rot wedge (D5)** — all fixable without re-planning, and none caught by the three recorded reviews.

---

## §9 AUTHOR-SEAT ADJUDICATION of §8 (2026-10-06, late; the plan-author session)

**Provenance.** The operator handed §8 to the author seat. Instruments this pass: `board-lint.mjs` exit codes, `git grep`/`rev-parse` against current `origin/main`, anchored `grep` on TIM-QUEUE, and the live automation registration (CronList) — the one instrument §8.4 correctly flagged as unreachable from the verifier seat. Nothing staged; nothing edited above this section.

**Independent re-checks of §8's load-bearing claims:**
- **D1 REPRODUCED exactly** — `--only FV-FLOORSIGN-MISLABEL-1` → rc=1; `--only … --no-ratchet` → rc=0. The plan-breaking finding is real and its fix is adopted (Am. 13).
- **C-e CONFIRMED** — `board/done/FV-REJECT-LOG-1.md` terminal field reads "✅ DONE (claude, 2026-08-09): log format+reason vocab @ research/FV-SPEC-REJECTION-LOG.md" and that file does not exist. A done-row whose named deliverable is absent; R2 is endorsed.
- **C-b CONFIRMED file-for-file** — `git grep -L human_sign_off origin/main -- '…__proptests__/*.proptest.mjs'` returns exactly art-618 / art-621 / art-677. R1 is endorsed; the F9 row's drift-reduction claim is dropped (Am. 18).
- **C-d REFUTED by the registration instrument** — CronList shows queue-author `enabled: true, active` (ran today, 26 runs), with the LIVE-SMOKE-PUSH-RETRY-TRIPWIRE-1 tripwire **added to its prompt** rather than the automation disabled. The LANE-DRAFT memorial records the kill-criterion tripping and the disable instruction; the registration was not flipped. Correct state: **enabled + tripwire-armed; conversions refusing, automation alive.** No plan impact either way (no step depends on queue-author).
- **D-a CONFIRMED and superseded again** — `origin/main` is now `0a418db11e86758e256a446e325e5745287bf7f4` (14 commits past §2's pin; §8 saw 12). **F9 premise re-confirmed at this newest pin: exactly 3 files, line 4 each.** Main is a high-velocity surface today; G1's "re-pin at claim time" is not a formality — the executing seat MUST quote the pin it measured.
- **C-a superseded by velocity** — anchored `^- \[OPEN\]` is now **21** (was 15 at §8's pass, 16 at §2's). All TIM-QUEUE counts in this memorial are dated observations of a fast-moving surface; nothing in the plan gates on the count.

**Amendments ADOPTED from §8 (binding on execution, joining §4's twelve):**
13. **(D1)** C2's gate is `node scripts/board-lint.mjs --only FV-FLOORSIGN-MISLABEL-1 --no-ratchet` → rc 0, PLUS a `--json` ratchet-head check: `fence-path-ambiguous` carrying-rows unchanged and NOT containing our row. Never edit the row to chase a pre-existing ratchet red.
14. **(D3)** D2's expected delta is named and computed AFTER the `.gitignore` edit: exactly `{M .gitignore, ?? <newly whitelisted doc(s)>}` — the two pending root `M` files and `repo/`'s own dirt (`CONTRACT.md`, `CONTRACT-RATIONALE.md`, per §8 C-f) are out of scope and out of pathspec.
15. **(D2)** C3 gains an index-freshness done-item: after regen, re-run `--index` once and confirm the generated-at timestamp advanced — or record explicitly "index not regenerated; row visible via directory listing only."
16. **(D5)** A STOP whose cause is proven pre-existing (the §2/§8 C-c ratchet debt and only that class) is record-and-proceed; every other unexpected red remains a full STOP.
17. **(D6)** G4's window widens to ±10 min for the step-C→D window specifically.
18. **(C-b)** The F9 row's stated claim narrows to "restores the template-canonical value on the three files carrying a void human-review claim" — no drift-reduction claim (8 formats and 3 field-less files are R1's scope, not this row's).

**R1–R4 endorsed as named future rows** (not plan growth, per §7's stop rule): header normalization (absorbs the 3 field-less files + 8-format drift), rejection-log materialization (the false-done), the board-lint `--only` exit-contract doc fix, and the art-699/701 reservations mismatches (flagged, likely another seat's).

**Chain closed.** §8's "the plan does not need a fourth review pass" is accepted; this adjudication is the author seat accepting/rejecting findings, not a new pass. Verification chain: assessment (this session) → independent verifier (§8) → author adjudication (§9). The plan is execution-ready with amendments 1–18; the open operator decisions remain unchanged: go/no-go, and whether Q4 rides as the fourth TIM-QUEUE line.

---

## §10 MECHANICAL DRY-RUN + HOUSE-FORMAT COMPLIANCE (2026-10-06, operator-directed; execution rehearsal, not a review pass)

- **`.gitignore` whitelist edit simulated end-to-end** in a throwaway git repo (real `.gitignore` copied, real target paths created): before the edit both docs match `:6:*` (ignored); after appending exactly the two `!` lines both flip visible (check-ignore rc=1), a control file in `research/` stays ignored, `.claude/settings.json` stays governed by its own pre-existing negation, and the status delta is exactly the Am. 14 shape. Scratch removed. **D1/D2 are now mechanically proven, not just reasoned.**
- **Gate-blindness re-proven at the newest pin** (`origin/main @ 0a418db1`, 14 commits past §2's): `git grep human_sign_off origin/main -- scripts/ .github/` still returns only the two templates — no new parser appeared among the intervening commits. Pass 2's key evidence is current.
- **Push is pre-authorized mechanically**: `.claude/settings.json` allowlist carries `"Bash(git push *)"` (line 12), and the pending settings diff only adds allows — D4's unattended default has no permission surprise.
- **Known cosmetic transformation, accepted**: `core.autocrlf=true`, no `.gitattributes` — the D3 commit stores LF-normalized blobs, so committed bytes may differ from working-tree bytes in line endings. No gate diffs these files; recorded so a future byte-comparison isn't surprised.
- **Amendment 19 (house line grammar):** the TIM-QUEUE header demands "one yes/no question" and 28 live lines end `— yes/no? — context:` (8 end `— which? — context:`). Q2's drafted "yes/no/pick-one/reject" tail harmonizes to the house pattern: `(yes = adopt the two-depth recommendation; no = name one depth or reject the ledger) — yes/no?`. Q4 stays `which?`-shaped (8 live precedents).
- **Amendment 20 (append mechanics on the two target docs):** the A1/A2 appends use the same single-write append mechanism this memorial's §9/§10 edits used successfully — proven on this estate's filesystem this session.

---

## §11 FIFTH ITEM (operator-added, 2026-10-06): `FV-EXPLAINER-SVG-1` — visual explainer with SVG animations

**Operator direction:** "we need to add a visual explainer with SVG animations as another row." Integrated as a second row staged in step C (alongside FV-FLOORSIGN-MISLABEL-1); no change to steps A/B/D or the gate set — staging is the same additive, lint-gated, rollback-by-delete class.

**Row draft (stages at step C, same G3 lint shape):**
- **ID:** `FV-EXPLAINER-SVG-1` · **fence:** one new self-contained page `repo/chaingraph/fv-verification-explainer.html` (worktree per SO #3) · **prove: NONE** (page only, no kernel bytes) · **model/class:** per `classOf` conventions (G6); page + visual-quality work.
- **Build on the estate's existing kit, not new machinery:** SCENE-KIT v1 (`scripts/lib/scene-kit.mjs`) + EXPLAINER-KIT v1, inlined per the one-self-contained-file contract, with `anchors-explainer.html` as the named exemplar (scene-wrap + `sk-scene` SVGs with `role="img"` + full-sentence `aria-label`s, replay buttons, stair-map nav, presenter controls).
- **The kit's contract is the acceptance baseline (verified current at `origin/main`):** final state by default (no-JS/print/`prefers-reduced-motion` render complete and still), motion opt-in via `sk-js` + IntersectionObserver, no page overflow (`contain: inline-size` + scroll frames), scoped CSS, **deterministic bytes** (no randomness/clock — keeps `--check` gates green). This satisfies WCAG motion guidance and the zero-dep constraint natively; no JS animation library may be introduced (SO #0/#10).
- **⛔ Copy gate (FVS-§8, load-bearing):** all claims restricted to sentences already published on `methods.html` (the six mechanisms, the FV pilot, the existing honest concessions — "a proof over wrong logic still proves that wrong logic ran correctly"; specs "validated, not semantically true"). Any NEW vocabulary (ledger, mutation-adequacy, back-translation) requires Tim's ruling first; if the drafter drifts, the PR goes HELD-DRAFT (SO #63's sanctioned draft case) until the vocabulary ruling lands. The remediation plan itself is not public truth until ruled.
- **No drifting numbers:** qualitative scenes or dated observations only (SO #0b) — never a pinned live count (e.g. proptest-file totals) that a later session owes updates on; link the live surface instead.
- **Scene sketch (4, all kit-contract):** (1) the claim envelope — two evidence types attached to one claim (FV artifact + §18 zk receipt, the art-215 complementarity already public); (2) the spec pipeline — clause snapshot → spec → fixture oracle → human sign-off → proof; (3) the honest-gap frame — the already-published "verified is not safe" concession; (4) the property floor — every live kernel carries property tests with negative controls.
- **SO #26 ACTIVE (unlike the F9 row):** rendered-output change — screenshot duty at checkoff with the estate's headless-Chrome primary instrument; capture both the final-state default and one `sk-play` animated state.
- **Standard page-PR gates:** html-verify/land-verify class (well-trodden); sitemap is main-side single-writer (SO #19 — no in-PR regen); if `EXPLAINER-SCENE-GEOMETRY-LINT-1` has landed by build time, run it, else the screenshot is the visual gate.
- **Rollback:** pre-claim delete + regen (same as F9 row); post-claim, builder's row; PR unmerged until labelled.

**Safety of adding this row:** staging changes nothing in the plan's envelope; the eventual PR is the plan's only rendered-output change and carries the estate's established visual gates plus the FVS-§8 copy gate. The one genuine new-public-surface risk is vocabulary, and that gate is Tim's by standing doctrine.

---

## §12 EXECUTION RECORD (2026-10-06T23:40–23:50Z, operator-directed, both popup decisions taken as recommended: Q4 filed; memorial committed)

- **Gates:** G1 pass (origin/main `0a418db1`, 3 files, exemplar + kits present). G2 pass (root: 2 known pending `M` files; repo/: 2 contract docs — all pathspec-excluded throughout). G3 recorded drift in others' debt (`fence-path-ambiguous` now 6 > 0, carriers not ours) — record-and-proceed per Am. 16. G4 pass (appends at :43/:45, clear of boundaries). G6 resolved: class vocabulary surveyed live — both rows tagged `[**D** …]`.
- **Step A:** §10 follow-through record appended to the research doc; second re-check addendum appended to the verification doc. Both single atomic writes, dated-observation phrasing, no digest-shaped strings.
- **Step B:** four `[OPEN]` lines appended to TIM-QUEUE at 23:43:53Z (anchored OPEN count 21→25): shipped-kernel (6.C.6), invariance-ledger home, back-translation label, public-master-vs-private-repo. House grammar; `rulings-lookup NONE` quoted on each (×4, including the Q4 keyword set run at execution).
- **Step C:** both rows drafted in `board/drafts/`, linted clean (`--only --no-ratchet` rc=0 each; neither appears among ratchet carriers), moved to `board/queued/` (45 rows). **QUEUE-INDEX regen RAM-refused twice** (`board-next` hard-refusal: 3.47 GB free < 5 GB floor — the documented estate-wide transient, same class as the 2026-10-01 TIM-QUEUE line). Am. 15 fallback arm taken and recorded here: **index NOT regenerated (stamp still 17:23:41Z); both rows visible to every directory-scanning instrument via `board/queued/`; regen owed by whichever seat next runs `board-next --index` with memory above the floor.** Two attempts made, then stopped per the two-failure rule.
- **Step D:** three `!` lines appended to `.gitignore`; `git check-ignore` flipped exactly the three targets; status delta exactly the Am. 14 named shape. Commit `7f3f049bf` by explicit pathspec (`.gitignore` + the three docs; the two pending `M` files excluded). The defensive rebase refused on the other sessions' unstaged dirt (not stashed — not ours to move); the fast-forward check showed origin unmoved (0 ahead / 1 behind), so the push went directly: `0f6ef64db..7f3f049bf master -> master`, LF/CRLF warnings = the §10-recorded cosmetic transformation. Post-push: `actions/runs?branch=master` total = 0 (no CI fired, as predicted); working tree back to exactly the two pending `M` files.
- **State left behind:** rows queued and dispatchable by the orchestrator when instruments run (each row self-contained per SO #2); F9's builder re-pins origin/main at claim per its own premise instruction; four ruling requests await Tim; the estate owes one index regen when RAM frees. Nothing else outstanding from this session.

---

## §13 COMPANION ROWS + LINT CORRECTION (2026-10-07T02:0xZ, operator-directed)

**Companion rows staged:** `FV-METHODS-SCENES-1` (2–3 kit-contract scenes on `methods.html`, insertion-only, FVS-§8 copy gate at maximum) and `FV-ZKVM-SCENES-1` (same shape on `chaingraph/zkvm-compute-integrity.html`), per the operator's direction after the safe-targets classification (hand-authored source pages only; the ~595 per-kernel pages are rolled artifacts and were explicitly excluded). Both carry the SCENE-KIT marker-adoption recipe (sync gate auto-covers a page the moment the markers land), `prove: NONE`, SO #26 both-state screenshots, and copy-source tables.

**Correction to §12 (lint claim was wrong):** §12 recorded the first two rows as "neither appears among ratchet carriers" — that check was a defective grep over the `--json` output and missed that both rows carried three advisory classes: `fence-path-ambiguous` (bare `scripts/`/`research/` segments in row text), `missing-terminal-field` (no trailing `· **☐ QUEUED** · owner: —`), and `done-item-gate` (verify items phrased as "<gate> green" without a recognized gate token). Root cause of the miss: Am. 13's `--only --no-ratchet` proves only that a row carries no BLOCKING class — advisory debt still counts against the full-scan ratchet, and the carrier confirmation must read the actual `rows carrying it` lists, not a keyword grep. **All four rows were then fixed in place** (anchored paths per the scanner's tokenizer: `repo/…` prefixes and backslash-absolute workspace paths; terminal fields appended; gate tokens in done-items) and re-linted to **zero findings**; full-scan carriers are back to other seats' pre-existing debt only. Index regenerated with all four rows listed. Lesson for any future staging: the Am. 13 gate needs a third leg — full-scan `rows carrying it` lists must not contain the staged row id.

**§13b Post-staging rigorous review (2026-10-07T02:1xZ, operator-requested):** all four row files re-read whole after the mechanical edits (intact); board-next re-run exposed that the original Fence phrasing — "WRITE (in your worktree, branched off current `origin/main`) exactly …" — made the dispatcher extract `origin/main` as the fence token, putting all four rows on its COULD-NOT-PARSE list with fence-overlap coverage silently waived. All four fences reworded to the parseable house shape (paths immediately after WRITE, worktree qualifier after); index now resolves fence-root `repo` for all four. Second finding: `methods.html` is on the gen-root-chrome page list (generator-owned chrome between sentinels) — FV-METHODS-SCENES-1 gained a load-bearing sentinel constraint (insertions outside the sentinel block; never regen chrome in-PR) plus the expected-advisory note for the trust-signals PR warning (verified from check-trust-signals.mjs: commit-anchor is advisory on PRs by design, hard on main — the row is NOT in the #2290 required-red class, whose inputs are the chrome SSOT and regen outputs, not page HTML). After both fixes: lint zero findings on all four rows, board-next parse warnings gone, index regenerated 02:21:06Z.
