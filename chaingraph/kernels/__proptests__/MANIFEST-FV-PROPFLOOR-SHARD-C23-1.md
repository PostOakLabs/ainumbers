# FV-PROPFLOOR-SHARD-C23-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C23-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the `.kernel.mjs` source as authored, matching the header comment in
each `.proptest.mjs` file — every digest below was produced by the mandated executed command
(`FV-PBT-FLOOR-BUILD-SPEC.md` §4, `FV-FLOOR-DIGEST-STALE-1`) against `chaingraph/kernels/_buildid.mjs`'s
`sourceDigest()`, never hand-typed or estimated).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file floor
properties themselves (termination bound, boundedness, differential re-derivation, metamorphic/
permutation-invariance checks as applicable, and — for the 6 float-sensitive kernels — mandatory
ULP-boundary forcing). No row received deeper manual review beyond this mechanical gate; the signer's
attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## ⚠ Corrections to the WU row's float-sensitivity table (FIX-2 discipline)

The WU row (`board/done/FV-PROPFLOOR-SHARD-C23-1.md`) listed **5** of these 10 kernels as float-sensitive
(`art-481`, `art-484`, `art-485`, `art-488`, `art-489`). Per this spec's FIX-2 instruction — "confirm
float-sensitivity and shape against each kernel's own source before relying on the table" — all 10 were
independently re-confirmed against their own `.kernel.mjs` source, and the table is **wrong for one of
the ten**:

- **`art-482-emir-recon-adjudicator` — CORRECTED to float-sensitive: YES.** The WU row listed it as
  float:no. Direct read of `compareField()`'s `type === 'numeric'` branch shows a genuine
  floating-point tolerance comparison — `delta = Math.abs(Number(trVal) - Number(firmVal)); agree = delta
  <= tol` — structurally identical in shape to `art-484`'s arithmetic-identity tolerance check (which the
  WU row correctly marks float:yes). ULP-boundary forcing was applied (see manifest row below). This
  brings the shard's float-sensitive count to **6 of 10**, not 5.
- The WU row's other 5 named float-sensitive kernels (`art-481`, `art-484`, `art-485`, `art-488`,
  `art-489`) were independently re-confirmed float-sensitive as stated — no correction needed. The WU
  row's 4 remaining float:no kernels (`art-483`, `art-486`, `art-487`, `art-490`) were independently
  re-confirmed float:no as stated — no correction needed for those either. `art-482` is the sole
  correction in this shard.

This correction is a direct application of FIX-2, not a deviation from it — the spec explicitly
anticipates the table being wrong and instructs re-confirmation over inheritance.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | termination/convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-481-rdarr-quality-scorecard` | `bb595b3096e163a13b9265cd83ed691343605e21a5fcb974aa04fdc9292c38ba` | **yes** | **yes** — the kernel's own header disclaims float accumulation ("pure integer arithmetic throughout"), which is true INSIDE `pct2()`'s scaled-basis-point truncation, but the FINAL decision (`valuePctNum >= thresholdPct`/`<=`) compares a Number parsed back from a fixed-2-decimal string against a caller-supplied threshold that can be any float — forced 0, -0, denormals (`Number.MIN_VALUE`), ±1 ULP around an exact 33.33%/0.00% boundary, `NaN`/`Infinity` threshold-missing guard | n/a — no iterative solver; termination bounded by `extract.length` (five independent single-pass counting loops, no recursion) | 3/3 pass |
| 2 | `art-482-emir-recon-adjudicator` | `ef88fb46f98773129561e13479d723e9b1d0822b713ab0816c49367014562557` | **yes (CORRECTED from the WU's float:no — see correction section above)** | **yes** — `delta = \|trVal-firmVal\| <= tol` forced at 0, -0, denormals, ±1 ULP around an exact tolerance boundary, and a `0.1+0.2 !== 0.3`-shaped representation-gap pair at both zero and EPSILON tolerance | n/a — no iterative solver; termination bounded by `tr_response.trades.length` × `policy.fields.length` (nested single-pass loops, no recursion) | 3/3 pass |
| 3 | `art-483-emir-break-ageing` | `61ca7bf25c81b012ffcf0eacf2a531f340641c6492b4f96ad95b2e17faab1a11` | no | n/a (float:no, direct read confirmed — day-granularity integer arithmetic via `Math.floor(msDelta/DAY_MS)` over `Date.parse()` results, the same deadline-vs-evaluated_at shape `FV-PROPFLOOR-SHARD-B23-1` independently corrected art-428 to float:no for; forced categorical boundary cases used — age exactly 0, evaluated_at before first_seen clamp, exact escalation-deadline tie, one ms before deadline, fractional `escalation_days`, bucket boundary at `max_days`) | n/a — no iterative solver; termination bounded by `current_break_set.length` (single Map-based diff pass, no recursion) | 2/2 pass |
| 4 | `art-484-regrpt-editcheck-runner` | `ccd3d4cba38af7145df90e543cf9b928f90949437da3a54ad4eb4e812bffcab4` | **yes** | **yes** — `arithmetic_identity`'s `\|sum-reported\| <= tolerance` forced at 0, -0, denormals, ±1 ULP, and the classic `0.1+0.2 !== 0.3` pair at zero and EPSILON tolerance | n/a — no iterative solver; termination bounded by `rule_set.rules.length` (single filter/evaluate pass per rule, no recursion) | 8/8 pass |
| 5 | `art-485-regrpt-variance-explainer` | `58e771301c2c6f396bfeaa0f61ea75adfce6211b68c03938500f14a37a1a5c8f` | **yes** | **yes** — `abs_change >= threshold_abs` and the `pct_change` division (`abs_change/\|priorVal\|`) forced at 0, -0 (`priorVal` negative-zero, exercising the `priorVal !== 0` division guard), denormals (`priorVal = Number.MIN_VALUE`), ±1 ULP | n/a — no iterative solver; termination bounded by `\|union(prior.cells, current.cells)\|` (single map-build + sort pass, no recursion) | 3/3 pass |
| 6 | `art-486-cscf-control-applicability` | `e61f7e68aeceece5e32ce4f26e110cac1da3e8f1a8d79d74304674e7de0c8484` | no | n/a (float:no, direct read confirmed — the kernel's own header states "no floats beyond a single `round(pct,2)`"; that one division feeds NO branching decision (`overall_status` derives solely from the integer `mandatoryGapCount`), so it is a display value only, not a decision boundary; forced categorical boundary cases used — missing required fields throw, invalid tier throws, `not_applicable` without `na_reason` throws, 0-applicable-controls defaults to 100%, unsorted input still yields sorted `gap_list`) | n/a — no iterative solver; termination bounded by `control_matrix.length` (one internal sort + one filter/map pass, no recursion) | 3/3 pass |
| 7 | `art-487-assessor-independence-check` | `296ba15821ab17012505cf41cea3e5915f9146eae5c97eab522579f9cd5fe663` | no | n/a (float:no, direct read confirmed — pure string membership, array intersection, and ISO-8601 date-STRING lexicographic comparison; no arithmetic anywhere in `compute()`; forced categorical boundary cases used — `assessment_date === attestation_deadline` exact tie, one day after deadline, full assessor/implementer identity overlap, empty `required_certifications`, route not in `permitted_routes`, malformed date string) | n/a — no iterative solver; termination bounded by `assessor_person_ids.length` (single filter/intersection pass, no recursion) | 3/3 pass |
| 8 | `art-488-model-replication-diff` | `5ff2146f1ae9457d37e4e6699dc331e6f8f69701f3f32a400f848761bc254ed8` | **yes** | **yes** — `abs_diff <= abs_tolerance`/`rel_diff <= rel_tolerance` forced at 0, -0, denormals, ±1 ULP, and the `rel_diff`'s `\|reported_value\| > 1e-12` cutoff boundary; additionally cross-checked the kernel's inlined fdlibm sigmoid against native `Math.exp`-based sigmoid at wide (1e-6) tolerance, an honest statement of the cross-libm gap the kernel's own §18.5 header documents rather than a false bit-exact claim | n/a — no iterative solver; termination bounded by `records.length` (single linear-combo dot-product pass per record, no recursion) | 3/3 pass |
| 9 | `art-489-model-test-battery` | `20e07ad532c59a2c5619ce03881ce808c367002a5572176618bbb8b6ba06e178` | **yes** | **yes** — all five threshold comparisons (Gini/KS/PSI/CSI/calibration) forced at 0, -0, denormals, ±1 ULP around an exact boundary (perfectly-separated 2-record Gini=KS=1 case), plus the PSI `PSI_EPS=1e-6` zero-bin clamp forced via a bin with `expected_count:0`. **Highest-scrutiny kernel in this shard** (five distinct float-heavy statistics, matching this shard-family's `art-325`-style treatment) — explicitly re-confirmed NO iterative solver exists (Gini/KS is one sorted linear scan, PSI/CSI is one linear sum over bins; no while-loop/fixed-point solve anywhere in the kernel), so no convergence-or-report property applies | n/a — no iterative solver, confirmed above; termination bounded by `scored_outcomes.length` + `population_bins.length` + `characteristic_bins.length` + `backtest.bins.length` (independent linear passes, no recursion) | 3/3 pass |
| 10 | `art-490-fatca-crs-submission-check` | `ff7382928e6f04fd05ef9d458b2681f0d86180f02468157ccfa443450eca1d01` | no | n/a (float:no, direct read confirmed — pure enum-set membership, string presence checks, one ISO-date regex test, and Set/Map-based DocRefId uniqueness/referencing; no arithmetic anywhere in `compute()`; forced categorical boundary cases used — duplicate DocRefId, dangling CorrDocRefId, missing CorrDocRefId on a corrective record, malformed BirthDate, incomplete Address, a suppression hiding a finding entirely, empty records array) | n/a — no iterative solver; termination bounded by `records.length` × (fixed per-record check count + `mandatory_element_rules.length`) (nested single-pass loops, no recursion) | 3/3 pass |

**6 of 10 kernels are float-sensitive** (`art-481`, `art-482`, `art-484`, `art-485`, `art-488`, `art-489`)
— this CORRECTS the WU row's own triage-table classification of 5/10 (see correction section above);
`art-482` was independently re-confirmed against its own `.kernel.mjs` source per FIX-2 discipline and
found float-sensitive on re-read, contrary to the WU row. ULP-boundary forcing (threshold ±1 ULP, 0,
negative zero, denormals, `x/y*y!==x`-shaped cases) is present in all 6 property files. The other 4
kernels (`art-483`, `art-486`, `art-487`, `art-490`) use forced categorical boundary cases in place of
ULP-forcing, per spec §3's float:no row.

**Termination:** every kernel's compute path is bounded by a caller-supplied array length (`extract`,
`tr_response.trades`/`policy.fields`, `current_break_set`/`prior_sealed_break_set`, `rule_set.rules`,
`instance_pair.{prior,current}.cells`, `control_matrix`, `identity_set`/`assessor_person_ids`, `records`,
`scored_outcomes`/`population_bins`/`characteristic_bins`/`backtest.bins`, `records`×
`mandatory_element_rules`) via single linear/nested-linear passes — no recursion, no unbounded
while-loop, and no iterative solver anywhere in this shard's 10 kernels (explicitly re-confirmed for
`art-489`, the shard's highest-scrutiny kernel, above).

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row).

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
