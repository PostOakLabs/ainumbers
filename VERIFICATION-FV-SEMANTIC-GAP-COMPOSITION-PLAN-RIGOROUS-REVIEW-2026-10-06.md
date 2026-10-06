# VERIFICATION — FV-SEMANTIC-GAP-COMPOSITION-PLAN-RIGOROUS-REVIEW-2026-10-06

**Verifier:** WorkBuddy session, 2026-10-06 EDT. **Scope:** is this document genuinely useful, or make-work?
**Method:** re-ran every §2 reproduce command; re-read the cited FVS/FLOOR sections; ran V3a/V3b/V3e falsification
searches. Nothing written to `repo/`; nothing edited in the doc under test.

---

## VERDICT

**Genuinely useful — not make-work.** It is one of the more honest and better-grounded research docs on this
estate. 7 of 8 current-state facts reproduce exactly; every one of the ~15 doctrine citations (§3b, §5, §6.C,
§7, §7a, §8, §12, FLOOR-§2/§3/§4/§6) checks out against the actual spec files; it contains one concrete,
verifiable, actionable defect (F9) and one real architectural finding (F3); and it corrects its own prior
reasoning twice in the open (F2, F10). **However**, three defects must be fixed before it is relied on, and its
central remediation claim (that the ledger "closes" a gap) is weaker than stated.

**Make-work risk that is real, and worth naming:** this is the **third** revision (v1→v2→v3) of a plan that
stages nothing, and it now asks for a **fourth** session to execute §7 and append §10. The deliverable's own
actionable surface today is small — **3 Tim rulings + 1 defect + 1 nuance** — and could be a one-page memo. The
process is defensible as estate discipline; it is not free.

---

## CONFIRMED (evidence line each)

| §2 row | Claim | Result |
|---|---|---|
| S1 | 5 pilot rows + 5 follow-ups in `board/done/` | ✅ **CONFIRMED** — `FV-A1/A2/B1/C1/C2` + `FV-B1-CLAUSE-RECHECK-1`, `FV-B1-DIGEST-SYNC-1`, `FV-B1-SCOPE-FIX-1`, `FV-C1-DIFFTEST-REFRESH-1`, `FV-C2-REMEDIATE-1` (10 files) |
| S2 | 68 `FV-PROPFLOOR-*` done, 0 queued/claimed | ✅ headline **CONFIRMED** (68 in `done/`, 0 elsewhere) — ⚠ decomposition wrong, see C1 |
| S3 | 671 `*.proptest.mjs`; 737 dir entries | ✅ **CONFIRMED** — 671 and 737 (66 non-proptest) |
| S5 | `run-proptests.mjs` wired into `land-verify.yml` | ✅ **CONFIRMED** — `:48` and `:367–369` (also `:382–388`, `:486`) |
| S6/F10 | staleness gate at **workspace-root** `scripts/` | ✅ **CONFIRMED** — `scripts/check-fv-attestation-staleness.mjs` (27,732 B) + `.test.mjs`, both present |
| S7/F7 | `FV-SPEC-REJECTION-LOG.md` absent outside `repo/` | ✅ **CONFIRMED** — `find` returns nothing; FVS-§5 step 3 (`FORMALVERIF-BUILD-SPEC.md:106`) references a file whose "format + reason-code vocabulary" is defined *in the file itself* ⇒ genuinely dangling |
| S8 | no prior research doc on Matt's feedback | ✅ **CONFIRMED** (only self-match) |
| F5 | no runtime cross-kernel dataflow edges | ✅ **CONFIRMED** — 0 of 668 kernels import a sibling; `art-335` imports only `./_hash.mjs` |
| F9 | exactly 3 files carry `human_sign_off: sonnet-2026-08-17` | ✅ **CONFIRMED exactly** — art-645/646/647, line 4 each; not covered by any FV shard manifest |
| V2 doctrine | FVS §3b non-retro, §5 step-3 log, §6.C art-215-only, §7 composition+grandfathering, §7a grade, §8 Tim-gated, §12 five-point/PROVISIONAL; FLOOR §2 zero-dep + detectors doctrine, §3 "where applicable", §4 manifest + template-REJECTED, §6 "50–70 shard PRs" | ✅ **ALL CONFIRMED** against `FORMALVERIF-BUILD-SPEC.md` and `FV-PBT-FLOOR-BUILD-SPEC.md` |

## CORRECTIONS (fix before relying)

- **C1 — §2 S2 arithmetic is internally inconsistent.** Stated: *"68 rows: 9 SHARD-A, 28 SHARD-B, 30 SHARD-C"*.
  9+28+30 = **67**. The 68th is `FV-PROPFLOOR-INFRA-1.md`, which the doc never mentions. Worse, the doc's own
  reproduce command `grep -oiE "FV-PROPFLOOR-SHARD-[ABC]"` returns **67**, so the table's value and its own
  command disagree. **Fix:** write *"68 `FV-PROPFLOOR-*` rows = 1 `INFRA-1` + 67 shard rows (9/28/30)"*, or
  change the grep to `FV-PROPFLOOR`.
- **C2 — §5.4 (and step 0(b)) state an absence that is not one.** §5.4: *"no shard manifests found"*; step 0(b):
  *"FLOOR-§4's manifest machinery is unproven"*. In fact **two shard manifests exist**, built to the FLOOR-§4
  manifest format, in `research/`: `FV-PROPFLOOR-SHARD-A-TERNARY-1-MANIFEST.md` and
  `FV-PROPFLOOR-SHARD-A-TERNARY-2-MANIFEST.md` (each `status: floor-files-built-pending-signoff`, signature
  `"status": "PENDING"`, each carrying the FLOOR-§4 independence sentence verbatim). S4's **narrower** claim
  ("no FV shard-manifest **row in `board/done/`**") is true; the broader wording is not. The honest statement is
  **"manifests exist, none is signed"** — which *strengthens* the doc's conclusion (§5.4) but means the
  machinery is **exercised, not unproven**. This matters because V3b explicitly told the verifier to search
  `research/` — the doc's own S4 search stopped at `board/done/`.
- **C3 — the ledger's marginal value is overstated (V3e, answered).** Step 1 claims the ledger "closes FLOOR-§3's
  'metamorphic identities where applicable' hand-wave mechanically". Measured: **425 of 671 floor files (63%)
  already declare metamorphic / round-trip / permutation / idempotence properties.** So the *properties* are not
  missing; what is missing is the **adjudication record** of why a relation APPLIES or not. That is still a real
  gap (the doc's asymmetric-DOES-NOT-APPLY argument is sound), but the doc should say *"adds the adjudication
  record over properties 63% of the population already carries"*, not *"closes the hand-wave"* — and it should
  measure this before costing a retrofit. No richer shared-invariance library exists beyond
  `research/FV-ROUNDING-PROPERTY-SUITE-BUILD-SPEC-2026-08-09.md`, so step 0's duplication risk is low.

## UNVERIFIABLE

- **Matt's two questions (§1)** — no artifact in the estate carries them; the restatement cannot be checked
  against a source, only judged internally coherent (it is).
- **The §9 web sources' specific claims** — external; not fetched here (out of scope for "is this useful").
- **"art-215 is the only composed artifact" (F6/step 4)** — consistent with FVS-§7 (`:178`: *"only `art-215` gets
  both in this pilot"*) but not exhaustively re-derived across the live surface.

## HAZARDS / NOTES

- The doc is **inert by construction** — status block says "NOT staged", stages no rows, edits nothing. Good.
- Minor: §2 S8's reproduce command is **self-referential** (the doc's own filename contains "semantic-gap" and
  "composition"), so the grep will always match itself. Cosmetic.
- Minor: F9's "3 different header formats" — confirmed **≥3** in the histogram (bare `PENDING`,
  `human_sign_off:** PENDING`, and the object form `human_sign_off": {`). Fine as stated.

## RECOMMENDED EDITS (author is the audience)

1. Fix C1 (state 67 shard + 1 infra, or fix the grep).
2. Rewrite C2 in §5.4 and step 0(b): "manifests exist (SHARD-A-TERNARY-1/-2, in `research/`), none signed" —
   and cite them, since they are direct evidence for the doc's own §5.4 conclusion.
3. Add the C3 measurement (425/671) to step 1 so the retrofit cost is argued, not assumed.
4. **F9 is the one item that is actionable now, independent of any Tim ruling** — three floor files
   (art-645/646/647) carry a model handle in `human_sign_off`. Worth its own small ORCH-staged row regardless of
   whether the rest of the plan ever proceeds. (Note the estate widely uses `sonnet` as an *owner/session*
   handle — e.g. the TERNARY manifests' `owner: sonnet` — so the fix is either "re-cover under FLOOR-§4" or
   "relabel to a non-human status"; either way it is not a human-review claim today.)
5. Consider collapsing §7's verification protocol — it is what makes the doc feel like make-work. The three
   genuinely load-bearing checks are V3a (cross-kernel edges), V3b (manifests), V3e (prior art); all three are
   answered above and none required the full protocol.

## WHAT SURVIVES UNTOUCHED

The plan's **dependency-corrected ordering** (F1), the **two-population fork** (F3) as the pivotal design
decision, the **Tim-gate discipline** (F4, §8), the **deferral of the entailment checker** (F5/F6), the honest
**residual-exposure list** (§5), and the **out-of-scope naming of the zk-circuit gap** (F11). The §8 questions
are real rulings, not busywork. **The document should proceed — with C1–C3 fixed and F9 extracted as a standalone
row.**

---

## SECOND RE-CHECK ADDENDUM (2026-10-06, later operator-directed session)

A second independent re-check reproduced this file's confirmations: the current-state table, F9 (exactly three
files, line 4 each — re-confirmed against two successively newer origin/main pins the same day), F7's dangling
log reference, and V3a (zero runtime sibling-kernel imports). One number above does not reproduce exactly: with
this file's stated vocabulary, case-insensitively, restricted to the 671 proptest files, the metamorphic-property
count is **383 (57%)**, not 425 — 425 corresponds to a directory-wide count that includes non-proptest entries.
Direction unchanged: a majority already carry such properties, so the ledger's marginal value is the adjudication
record. Full record, follow-through acts, and the execution plan (with this file's C1–C3 folded in):
`research/FV-SEMANTIC-GAP-FOLLOWTHROUGH-1-MEMORIAL-2026-10-06.md`, whose §10 incorporates this file by pointer.
