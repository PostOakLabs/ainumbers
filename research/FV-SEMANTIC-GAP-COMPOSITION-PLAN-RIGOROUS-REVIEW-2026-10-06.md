# FV-SEMANTIC-GAP-COMPOSITION-PLAN-RIGOROUS-REVIEW-2026-10-06

**Status:** REVIEW ARTIFACT — the plan in §3 is **NOT staged**. No board rows are created or implied by this document. Nothing here edits `repo/`, `SPEC.md`, or any signed artifact. It exists so an independent session can verify it (§7) before anything is staged, and so the four Tim-gated questions (§8) are answered by a ruling, not by a session's judgment call.

**Origin:** Matt's feedback on the FV programme (two questions, restated §1), relayed 2026-10-06. This session did: web research on both questions against the public methods page; a first-pass remediation plan; an adversarial pass on that plan; then this rigorous pass, which verified every load-bearing factual claim against the estate (§2 — with commands to reproduce) and corrected the plan twice on the way (§6 trace).

**Anchors:**
- `https://ainumbers.co/methods.html` (public description of the six mechanisms + FV pilot)
- `FORMALVERIF-BUILD-SPEC.md` (workspace root; cited below as **FVS-§**)
- `FV-PBT-FLOOR-BUILD-SPEC.md` (workspace root; cited below as **FLOOR-§**)
- `board/done/` FV rows (pilot + floor shards, verified §2)
- `scripts/check-fv-attestation-staleness.mjs` + `.test.mjs` (workspace root)

---

## §0 How to use this document

You are the verification session. Your job, in order:

1. Re-derive §2's current-state facts with the given commands. If any expected value has drifted, stop and record the drift before reading further — three of the plan's steps (§3 steps 0–2) are sensitive to rollout state.
2. Re-read the cited ranges of FVS and FLOOR and confirm or refute each finding in §4. The findings carry my reading; your job is to break it.
3. Run the falsification challenges (§7 V3). Two of them can materially change the plan: the cross-kernel-edge search (V3a) and the manifest-signing search (V3b).
4. Attack the plan itself (§7 V4). The three decisions most worth attacking are marked **[ATTACK-WORTHY]** in §3.
5. Write your verdict as an appended `## §10 VERIFICATION SESSION FINDINGS` section in this file (dated, signed by session id). Do not edit §1–§9 — append only, same discipline as the FV rejection log.

---

## §1 The two questions being remediated

Restated in full so this document does not depend on the conversation:

**Q1 — semantic/referential adequacy.** How do we know a proof (and the spec it proves) expresses what we think it expresses? Do all boundary conditions express what they claim — the edges of the value domains, and how the computation behaves on interactions of one, two, three or more values? Is the referent of each formal claim — the concept/notion/fact/claim/value about the formula or operation — exactly the human's understanding of it?

**Q2 — composability.** The invariances and boundary conditions must compose: the formal verification of the *composition* of proofs is a different problem from the individual proofs. Can proofs be composed automatically? Is there shared invariance across composed proofs?

The methods page already concedes both gaps in its own words ("A proof over wrong logic still proves that wrong logic ran correctly"; specs are "validated, not semantically true"). The plan exists to add machinery, not to relabel.

---

## §2 Verified current state (2026-10-06, this session)

Every row below was executed this session. Reproduce before trusting.

| # | Fact | Value | Reproduce |
|---|---|---|---|
| S1 | FV pilot complete | `FV-A1-EMIR-LIFECYCLE`, `FV-A2-AGENTIC-READINESS`, `FV-B1-DTI-RATIOS` (+3 follow-up rows), `FV-C1-REGZ-APR-DAFNY` (+1), `FV-C2-PAYEE-MATCH` (+1) all in `board/done/` | `ls board/done \| grep -E "FV-(A1\|A2\|B1\|C1\|C2)"` |
| S2 | Property-floor rollout **complete** | 68 `FV-PROPFLOOR-*` rows done: 9 SHARD-A, 28 SHARD-B, 30 SHARD-C; 0 queued, 0 claimed | `ls board/done \| grep -oiE "FV-PROPFLOOR-SHARD-[ABC]" \| sort \| uniq -c` |
| S3 | Floor file population | 671 `*.proptest.mjs` files (737 total entries in the directory — 66 non-proptest entries) | `ls repo/chaingraph/kernels/__proptests__/*.proptest.mjs \| wc -l` |
| S4 | Floor sign-off state | ~all 671 carry `human_sign_off: PENDING` — mostly with manifest-level deferral notes citing FLOOR-§4; **no FV shard-manifest row found in `board/done/`**; 3 files carry `human_sign_off: sonnet-2026-08-17` (a model identity in a human-sign-off field — see F9); 3 different header formats in circulation | `grep -rh "human_sign_off" repo/chaingraph/kernels/__proptests__/ \| sed 's/^[^a-z]*//' \| sort \| uniq -c` |
| S5 | CI wiring live | `run-proptests.mjs` is wired into `repo/.github/workflows/land-verify.yml` (lines 48, 367–369) | `grep -n "proptest" repo/.github/workflows/land-verify.yml` |
| S6 | Staleness gate exists at **workspace root** `scripts/` (not `repo/scripts/`) with its pinning test | `scripts/check-fv-attestation-staleness.mjs`, `.test.mjs` | `ls scripts/check-fv-attestation-staleness*.mjs` |
| S7 | `FV-SPEC-REJECTION-LOG.md` **does not exist anywhere** outside `repo/` | consistent with zero FVS-§5 step-3 send-backs to date; post-landing corrections instead happened as named follow-up rows (S1's +3/+1/+1) | `find . -maxdepth 3 -name "FV-SPEC-REJECTION-LOG.md" -not -path "./repo/*"` |
| S8 | No prior research doc covers Matt's feedback | no filename match for matt/semantic-gap/composition in `research/` | `ls research \| grep -iE "matt\|semantic-gap\|composition"` |

**Consequence of S2, stated plainly:** the adversarial round's strongest scheduling argument — "land the ledger fields before the shard waves mint ~578 files so they are born with ledgers" — is **moot**. The waves ran. Any ledger/checklist adoption is now a *retrofit* decision on 671 landed files, and §3 step 0 is a fork that must be decided before anything else in the plan is staged.

---

## §3 The plan under review (v3)

Seven steps. Order is dependency-corrected (see F3). Every step is a recommendation pending §7 verification and the §8 rulings — none is authorized by this document.

**Step 0 — ledger-home decision (ORCH/Tim, before any WU).** ⛔ **[ATTACK-WORTHY]** The invariance ledger + boundary checklist needs a home, and the estate has two disjoint populations:
- (a) **FVS-§3 spec-file format** — population ≈ the signed pilot specs (5) + future FV rows. Rides the existing additive-field discipline (FVS-§3b precedent: new fields are not retro-applied to signed specs). Full-depth ledger.
- (b) **Floor-file headers** — population 671 (S3). Rides the existing per-file template + `run-proptests` CI (S5). But: retrofit cost on landed shards, format drift already present (S4), and FLOOR-§4's manifest machinery is unproven (S4).
- Recommendation: **two depths, one vocabulary** — (a) full ledger for every FVS-§3 spec file; (b) minimal ledger (checklist dimensions + APPLIES/DOES-NOT-APPLY rows for the standard relation set) only for floor files of `float_sensitive: yes` kernels, targeted retrofit, no blanket 671-file wave. Full ledger content per kernel: unary relations (scale, idempotence), binary (permutation over independent items, sum-splitting), ternary+ (associativity under aggregation), each APPLIES (CI-enforced where a floor file exists) or DOES-NOT-APPLY (human-adjudicated, clause citation required — asymmetric error modes; a wrong DOES-NOT-APPLY silently forecloses a bug-catching property).

**Step 1 — boundary-dimension checklist + invariance ledger fields** (per step 0's scope). Additive fields, FVS-§3b discipline. The ledger's APPLIES rows become the *generator input* for floor properties where a floor file exists — closing FLOOR-§3's "metamorphic identities where applicable" hand-wave mechanically. Resolution stated for the FVS-§12 point-4 versioning question (old-shape sibling vs new-shape candidate): field-structure matching compares only fields present in both files; the first post-adoption spec in each family is therefore NOVEL (full §5 step 3 review) — a one-time cost per family. **This resolution is a recommendation, not a ruling — challenge it (V4).**

**Step 2 — mutation-adequacy gate v0, reporting-only.** **[ATTACK-WORTHY]** Fixed, published mutant-operator set applied mechanically to spec files: rounding-mode flip, comparison-boundary flip (`≤`↔`<`), threshold ±1 ULP, precondition drop, boundary-case drop. Mutants instantiated from the checklist/ledger fields (operators are part of the *harness*, per-spec mutant values are *data* — this is what keeps FVS-§12 point 2's "only data substituted" satisfiable). Mutants drafted by a session independent of the spec drafter (the drafter's misreading predicts its blindspot mutants — §3d's co-generation failure at one level up). Score recorded **research-side only** (run report), not on the FV artifact — artifact field deferred until calibration, to avoid a SPEC-SERIAL row for a number nobody has calibrated. Blocking decision explicitly deferred until: equivalent-mutant volume measured, adjudication queue cost known. Execution substrate: the fixture-oracle replay already in every floor file (B1's `runFixtureOracle()` shape). Known bound, stated up front: the score is adequacy *relative to the operator set* — it measures distinguishability from neighbors, never semantic truth.

**Step 3 — back-translation gate, NOVEL-path only.** For every FVS-§12 NOVEL spec: a second independent reader (different session family than the drafter) renders the signed spec into plain English *without seeing the cited clause*; a differ checks the rendering against the clause with a clause-anchored entailment checklist (not holistic "does this sound right" — a fluent rendering of a wrong spec reads as right); any hit → `research/FV-SPEC-REJECTION-LOG.md` (does not exist yet, S7 — its format is referenced by FVS-§5 step 3 but undefined; first use must create it or the reference dangles). Routine-template instances inherit the sibling's back-translated referent — this scoping is what keeps the gate compatible with FLOOR-§4's rejection of per-item human review at scale. §7a interaction (does machine-mediated referent checking stay inside `human-reviewed-novel`?) must be reconciled **before** the first such artifact signs — see §8.

**Step 4 — composition lemma + the Tim ruling.** The composed claim (FVS-§7: FV artifact + §18 zk receipt = two evidence types over "this shipped kernel computes what it says") rests on a chain whose middle link is *empirical*: FV proves the Dafny port ⊨ spec; zk proves the guest faithfully executed; differential testing bridges port ↔ shipped (art-215: two discrepancies found and fixed, agreement <0.0001pp over 1,020 cases). Remediation: (i) write the composition lemma as prose in the already-mandatory `scope_statement` — three premises, each bound to its discharging mechanism; (ii) the middle link's status is a **FVS-§6.C.6 decision that belongs to Tim** (adopt the Dafny-compiled JS as the shipped kernel, making the link verified; or keep the differential bridge, and the lemma must say the link is empirical — forever, on every surface); (iii) if any composed artifact is ever minted beyond art-215, add one additive field `zk_receipt_digest` to the FV artifact — today the FV↔zk join is by `kernel_id` naming convention, not digest chain (F6). No retro-edit of the grandfathered art-215 artifact (FVS-§7a grandfathering rule).

**Step 5 — within-kernel composition properties.** New property class in the FLOOR-§3 B/C defaults: step-composition rounding drift (half-up at 2dp applied twice ≠ once — the exact class of the FVS-§3b founding finding), conservation identities under item split/merge where the ledger says APPLIES. Targeted at `float_sensitive: yes` kernels, not blanket. CI runtime growth must be measured on one shard before rollout (land-verify budget unexamined).

**Step 6 — cross-kernel entailment checker: DEFERRED.** Trigger condition (both required): (i) the first *runtime* kernel→kernel dataflow edge exists (proptest files importing kernels is not runtime; kernels are standalone pages over user-pasted inputs today — verify: V3a), and (ii) ≥2 kernels have machine-checkable specs. Until then the checker is the detectors-instead-of-goal anti-pattern (FLOOR-§2 cites the doctrine by name). The sound rules it would implement when triggered: Abadi–Lamport composing/conjoining specifications (assume-guarantee); upstream `ensures` ⊢ downstream `requires`, SMT-dischargeable.

**Step 7 — public copy: Tim-gated.** ⛔ Nothing in this plan reaches methods.html or any public surface until Tim names the vocabulary (FVS-§8). When it does: any adequacy number ships with its operator vocabulary and scope statement or not at all.

---

## §4 Rigorous review findings

Each finding: the claim, its status after verification, evidence.

**F1 — CONFIRMED (dependency inversion).** The mutant-operator vocabulary is derived from the checklist/ledger fields; therefore step 1 before step 2. The v1 order (mutation gate first) was inverted.

**F2 — CORRECTED BY EVIDENCE (birth-window).** V2 of the plan claimed the ledger fields must land *before* the floor shard waves or face a 578-file retrofit. S2 shows the waves already ran (68 rows, 671 files, 0 queued). The argument is moot; step 0's fork is its replacement, and it is a *decision*, not a scheduling trick.

**F3 — NEW FINDING (population fork).** The adversarial round treated "the ledger" as one artifact living in the FVS-§3 spec file. The estate has two disjoint populations: ~5 FVS-§3 spec files vs 671 floor files that deliberately do **not** use that format (FLOOR-§2's per-file design, B1 pattern). A ledger in the spec-file format alone covers <1% of floor-covered kernels. Hence step 0's fork. This is the single largest correction of the rigorous pass.

**F4 — CONFIRMED (Tim-gate).** The port↔shipped middle link is FVS-§6.C.6, explicitly framed as a per-kernel decision "this spec frames but does not make," weighed against the zero-dep constraint (SO #0). No WU discharges it; only a ruling does. V1 buried this inside an engineering item.

**F5 — CONFIRMED (deferred infrastructure).** No runtime cross-kernel dataflow edges are known to exist (kernels are standalone; the RECOMP wave composes at workflow level, not kernel level), and only one kernel has a machine-checkable spec. The entailment checker's input domain is empty today. FLOOR-§2 names the anti-pattern by name (`feedback-orch-builds-detectors-instead-of-the-goal`).

**F6 — WEAKENED (spec_digest join).** V1 said "premise (b) — spec_digest match — you have this." Half right: the FV artifact carries `spec_digest` (FVS-§2), but the §18 zk receipt has no obligation to reference it; the join of the two evidence types is by `kernel_id` naming. The fix is one additive field (`zk_receipt_digest`), only when a second composed artifact appears.

**F7 — NEW FINDING (adversarial pressure unmeasured).** `FV-SPEC-REJECTION-LOG.md` does not exist (S7) — consistent with zero §5 step-3 send-backs across the entire pilot. Corrections demonstrably happened (five follow-up rows, S1), but via post-landing remediation rows, not the spec-review send-back loop. For Matt's Q1 specifically this is a datum: the referent-review loop's reject rate is unmeasured and possibly zero-not-because-perfect. Step 3's gate is what would give the loop its first measured signal. ⚠ Also: the log's format is *referenced* by FVS-§5 step 3 but defined nowhere findable — first use must create it.

**F8 — CONFIRMED WITH CAVEAT (§12 fork compatibility).** Defining mutant operators as part of the harness and per-spec mutants as data keeps FVS-§12 point 2 satisfiable. Caveat: point 5 ("boundary-case categories match the sibling's") can still trip when a ledger adds categories — the step 1 resolution (compare only common fields) is the proposed answer and is attack-worthy.

**F9 — NEW FINDING (honest-labeling defect, concrete).** Three floor files carry `human_sign_off: sonnet-2026-08-17` — a model identity inside a field whose entire purpose (FLOOR-§4, FVS-§7a) is that a machine's output is never mistakable for human review, *in either direction*. These are exactly the mislabels the doctrine exists to prevent, and they are checkable today:
- `repo/chaingraph/kernels/__proptests__/art-645-compute-index-weights.proptest.mjs`
- `repo/chaingraph/kernels/__proptests__/art-646-compile-rebalance-evidence-pack.proptest.mjs`
- `repo/chaingraph/kernels/__proptests__/art-647-record-index-correction.proptest.mjs`

Triage recommendation: these three files' sign-off values are void as human-review claims (a model named the signer); either the shard manifest program re-covers them under FLOOR-§4, or the header is corrected to a non-human status. ⛔ No retro-edit without an ORCH-staged row — this document does not edit them. Also noted, lower priority: three header formats circulate (S4) — cosmetic drift, worth one normalization row someday, not load-bearing.

**F10 — LOCATION CORRECTED (staleness gate).** Cited correctly by FVS-§7a as workspace-root `scripts/`; the rigorous pass initially probed `repo/scripts/` and wrongly inferred absence. It exists with its pinning test (S6). Recorded so the verification session doesn't repeat the probe error.

**F11 — OUT-OF-SCOPE, NAMED (zk-circuit semantic gap).** Matt's Q1 applies one level below where this plan reaches: the zk circuit's semantics vs the guest logic. The estate binds guest ↔ shipped kernel via `kernel_digest` + differential testing (FVS-§2, §6.C.4); circuit ↔ guest is internal to the RISC Zero toolchain (pinned by `toolchain_digest`, FVS-§2). This plan does not open that layer; it is recorded so the residual list (§5) is honest about where the plan's floor is.

---

## §5 Residual exposure (the caveats to write down before they are found)

1. The mutation-adequacy score is relative to its operator set. It measures distinguishability, never semantic truth. Every artifact or report carrying the number must carry the operator vocabulary beside it.
2. Back-translation independence is bounded by reader independence. LLM readers share priors (Knight–Leveson's coincident-failure result, at the semantic level). The gate catches verbalization drift; it does not prove conceptual alignment. The human diff-adjudication is the irreducible human step.
3. If the §6.C.6 ruling keeps the differential bridge, the flagship composed claim's middle link stays empirical permanently — and every surface carrying the composed claim must keep saying so, every time, indefinitely.
4. The floor's signing layer is unfinished (S4: ~all PENDING, no shard manifests found). The ledger's CI-enforcement rides `run-proptests` and works unsigned — but the program that would bind ledgers to human intent does not exist yet. Do not gate ledger adoption on manifest signing, and do not gate manifest signing on ledger adoption; they are independent programs (stated because the temptation to couple them is real and would stall both).
5. F11: everything above stops at the guest-image boundary. The zk-circuit semantic gap is unowned by this plan.

---

## §6 Plan trace (v1 → v2 → v3)

- **v1** (first pass, 2026-10-06): mutation gate → back-translation → checklist+ledger → composition-lemma schema field → entailment checker → composition-level suite entries.
- **v2** (adversarial pass): order inverted (ledger before mutation gate); back-translation scoped to NOVEL; composition lemma demoted from schema framework to `scope_statement` prose + Tim ruling; entailment checker deferred behind a trigger; "cheap" claims withdrawn for items 1–2; birth-window scheduling argument added.
- **v3** (this rigorous pass): birth-window argument **retracted** (F2 — the waves already ran); ledger-home fork added as step 0 (F3); mutation score moved research-side until calibrated; `zk_receipt_digest` scoped to a future composed artifact (F6); rejection-log absence surfaced as evidence (F7); the three mislabeled sign-off files found and triaged (F9); staleness-gate location corrected (F10); zk-circuit gap named out-of-scope (F11).

---

## §7 Verification protocol

Do these in order; append results to §10.

**V1 — reproduce current state (S1–S8).** Run each command in §2's table. Expected values are as of 2026-10-06. Record any drift.

**V2 — re-read the cited doctrine.** Confirm or refute my reading of: FVS-§1 (narrowed claim), §2 (triple identity), §3b (rounding_steps, non-retro), §5 (pipeline, fork), §6.C (Dafny row, §6.C.6 decision), §7 (composition note, grandfathering), §7a (grade semantics), §12 (five-point test, PROVISIONAL machine); FLOOR-§2 (zero-dep, detectors doctrine), §3 (class defaults, "where applicable"), §4 (manifest signing, template rejection), §6 (50–70 PR estimate). Cite line numbers in your findings.

**V3 — falsification challenges.**
- (a) **Cross-kernel edges.** Try to prove step 6's trigger condition already met: search `repo/chaingraph/kernels/*.kernel.mjs` for imports of sibling kernels or shared runtime state (proptest imports don't count). If you find a runtime edge, step 6 un-defers and the plan reorders.
- (b) **Shard manifests.** Search `board/done/` and `research/` for any FV shard-manifest signing (my S4 search found none). If manifests exist, S4's "signing layer unfinished" weakens and §5.4 changes.
- (c) **The three sonnet files.** Read the three files in F9. Confirm the header value, check whether any manifest or board row covers their sign-off, and state whether the mislabel reading holds.
- (d) **Rejection-log history.** Open the five follow-up rows in S1 and confirm none of them routed through a §5 step-3 send-back (i.e., F7's "zero send-backs" reading holds).
- (e) **Prior art in-estate.** Search the estate for any existing invariance-ledger / metamorphic-relation vocabulary beyond `research/FV-ROUNDING-PROPERTY-SUITE-BUILD-SPEC-2026-08-09.md`. If a richer shared-invariance library already exists, step 0's ledger may partially duplicate it.

**V4 — attack the plan.** Specifically: (i) the two-depth ledger recommendation in step 0 — is the float-sensitive targeting of depth (b) right, or should depth (b) also cover threshold-classification kernels (FLOOR-§3's "fixed-threshold-tier agreement" class)? (ii) the §12 point-4 resolution in step 1 — find a case where "compare only common fields" silently passes a candidate that should be NOVEL; (iii) step 2's reporting-only-first — argue the case for blocking-from-day-one, or confirm calibration-first; (iv) step 5's CI-budget claim — measure `run-proptests` wall time on one B shard and extrapolate; (v) anything in §3 that quietly violates a doctrine this document failed to cite.

**V5 — completeness.** Re-read Matt's two questions (§1) and check every sub-clause maps to at least one step or one §5 residual. Anything unmapped goes in your findings.

---

## §8 Open questions that belong to Tim (ruling requests, not WUs)

1. **FVS-§6.C.6 (step 4):** adopt the Dafny-compiled JS as the shipped kernel for art-215 (middle link becomes verified), or keep the differential bridge (middle link stays empirical, stated on every surface)?
2. **Step 0:** ledger home — accept the two-depth recommendation, pick one depth, or reject the ledger concept?
3. **FVS-§7a (step 3):** does machine-mediated referent checking (back-translation diff) remain inside `human-reviewed-novel`, or does it need its own label? Reconcile before the first post-adoption NOVEL artifact signs.
4. **FVS-§8 (step 7):** public vocabulary — deferred until the machinery exists; listed so the gate is on the record.
5. **F9:** whether the three `sonnet-2026-08-17` headers are corrected by row, and under which program.

---

## §9 Sources (web, 2026-10-06)

- [Verified Is Not Safe: The Proof Boundary of Formal Verification](https://andrewnalichaev.com/articles/verified-is-not-safe-defi-formal-verification) — proof = (implementation, spec, environment model, verifier semantics); each link can fail.
- [Specification Gap — Zealynx Glossary](https://www.zealynx.io/glossary/specification-gap) — the verification-paradox framing.
- [The Semantic Gap: From Natural Language to Formal Verification (RE2025 slides)](https://ssvlab.github.io/lucasccordeiro/talks/re2025_slides.pdf) — NL→formal is where meaning is lost.
- [Metamorphic Testing and Testing with Special Values (Chen et al.)](https://www.academia.edu/3822514/Metamorphic_Testing_and_Testing_with_Special_Values) · [Murphy, Columbia](https://academiccommons.columbia.edu/doi/10.7916/D8765P5P/download) · [Liu](https://vuir.vu.edu.au/33046/) — MR arity (1/2/3+ values), the oracle problem.
- [Compositional Specification and Reasoning (Tsay)](https://im.ntu.edu.tw) · [Bickford, Cornell](https://www.cs.cornell.edu) — Abadi & Lamport, "Composing Specifications" (TOPLAS 1993) and "Conjoining Specifications" (TOPLAS 1995).
- [Cryptography Zoo — recursive proof composition (Anoma)](https://forum.anoma.net) · [lurk-lab/awesome-folding](https://github.com/lurk-lab/awesome-folding) — IVC (Valiant), PCD (DAGs), folding/accumulation (Nova/HyperNova) for the zk leg's future composition.
- [Knight–Leveson Redux](https://github.com/ASSERT-KTH/Knight-Leveson-Redux) — coincident failures from shared specification misunderstandings.
- [Contract-based Mutation Testing in the Refinement Calculus (Aichernig)](http://www.ist.tugraz.at) · [Coverage vs Mutation Score (Jain et al.)](https://par.nsf.gov) · [Property-Based Mutation Testing (arXiv)](https://arxiv.org) — the mutation-adequacy mechanism.

---

## §10 FOLLOW-THROUGH RECORD (operator-directed, 2026-10-06, ZCode session FV-SEMANTIC-GAP-FOLLOWTHROUGH-1)

Per §0.5 the verification verdict was to be appended here; the verification session instead wrote a separate file — `VERIFICATION-FV-SEMANTIC-GAP-COMPOSITION-PLAN-RIGOROUS-REVIEW-2026-10-06.md` (workspace root) — which this section incorporates by pointer. That file carries the full verdict and confirmation table; the condensed corrections to the sections above (which stay frozen — append-only discipline) are:

- **C1 (current-state table, propfloor row):** 68 done rows = 1 `FV-PROPFLOOR-INFRA-1` + 67 shard rows (9 SHARD-A / 28 SHARD-B / 30 SHARD-C); the row's own reproduce command returns 67 because it matches shard names only.
- **C2 (residuals item 4 and step 0(b) wording):** two FLOOR-§4 shard manifests exist in `research/` (`FV-PROPFLOOR-SHARD-A-TERNARY-1/-2-MANIFEST.md`, each carrying `status: floor-files-built-pending-signoff` with blank signature fields). The honest statement is "manifests exist, none is signed" — the machinery is exercised rather than unproven, which strengthens, not weakens, the signing-layer conclusion.
- **C3 (step 1 marginal value):** a majority of floor files already declare metamorphic-class properties (independently measured 383 of the 671 proptest files with the verifier's stated vocabulary, case-insensitive; the verifier's 425 corresponds to a directory-wide count). The ledger's marginal value is the adjudication record — the asymmetric DOES-NOT-APPLY argument stands — not the properties themselves; "closes the hand-wave mechanically" overstates it.

**Second independent re-check (2026-10-06, later session):** the current-state facts, F9 (three files, line 4 each — re-confirmed against two successively newer origin/main pins the same day; main is high-velocity, so any pin older than the moment of measurement is stale for staging purposes), F7 (the dangling log reference at the §5 step-3 sentence of the build spec), and V3a (zero runtime sibling-kernel imports) all reproduce.

**F9 disposition:** the three files' sign-off values are void as human-review claims; correction rides staged row `FV-FLOORSIGN-MISLABEL-1` (relabel to the template-canonical interim value with an in-file provenance note preserving the original value verbatim; the manifest re-cover alternative under FLOOR-§4 remains open). This document edits nothing in any repo.

**Follow-through acts (this record):** staged rows `FV-FLOORSIGN-MISLABEL-1` and `FV-EXPLAINER-SVG-1` (a public explainer of the already-published verification claims, built on the estate's scene kit, copy restricted to sentences already on the public methods page per the FVS public-vocabulary gate); four ruling requests filed in the board's decision queue (shipped-kernel decision, ledger home, back-translation label, and the public-master-vs-private-repo question); this document, the verification file, and the execution-plan memorial whitelisted and committed to the workspace master bundle (findable via `git log --grep FV-SEMANTIC-GAP-FOLLOWTHROUGH-1`).

**Verification chain closed:** the load-bearing checks of §7 have been run twice independently (the separate verification file; the follow-through session) plus a bounded third pass by an independent verifier seat over the execution plan (recorded in the memorial), with every correction incorporated above or in the memorial. A further verification pass over this document or the plan duplicates settled work — do not stage one.
