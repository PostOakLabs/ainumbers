# FV-PROPFLOOR-SHARD-C14-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness. `ml-01-isolation-forest`'s
seeded tree-building shape made it the single most tempting kernel in this shard to over-claim on; the
floor here states its determinism/termination/boundedness contract and stops there.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C14-1`, enumerated below by kernel id and
kernel-source digest (plain `sha256sum` of the `.kernel.mjs` file, matching the convention already used by
`FV-PROPFLOOR-SHARD-C11-1`'s manifest).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json` (excluding fields added post-hoc by `buildArtifact()`,
e.g. `schedule_digest`/`file_digest`/`per_record_findings_digest`, which are not part of `compute()`'s own
output — confirmed by direct source read for `art-332` and `art-350`), pass/fail recorded per file; (2) the
property-file floor properties themselves (termination bound, boundedness, differential re-derivation,
metamorphic/permutation-invariance checks, and — for the 6 float-sensitive kernels — mandatory
ULP-boundary forcing). No row received deeper manual review beyond this mechanical gate; the signer's
attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-332-build-amortization-schedule` | `8885c70d3b73687cac1d701f769dca9e13c67e4101c9ff6cd9707922f141439b` | **yes** | **yes** — note_rate_pct forced at 0/-0/±EPS/denormal around the `levelPaymentCents` near-zero-rate (`Math.abs(periodicRate)<1e-12`) threshold | convergence-or-report re-derivation of the kernel's own final-period true-up: it unconditionally closes `ending_balance` to 0 for every `schedule_type` (including an underfunded `payment_amount` override), so `SCHEDULE_DID_NOT_FULLY_AMORTIZE` and the residual must always agree — no genuine iterative solver in this kernel (fixed-iteration-count loop), so no `max_iterations`-shaped obligation applies | 6/6 pass |
| 2 | `art-342-compute-escrow-analysis` | `e607aef8dedf929559f5a0daafd8a26ba54b900cd7d64c91ee96f5c88416aa9d` | **yes** | **yes** — all five 1e-9-epsilon classification thresholds forced (cushion-fraction cap, deficiency/shortage/surplus boundaries, mandatory-spread boundary, $50 refund boundary) | n/a — fixed 12-month walk, no iterative solver | 5/5 pass |
| 3 | `art-346-compute-experience-mod` | `23a53d6a4168ee19c365556e8672f02cf9d36e2f6445a4d2fc8db1c511d953f5` | **yes** | **yes** — zero-denominator guard, weighting_value [0,1] clamp, and mod==1 unity boundary forced at 0/±EPS/±1e-9 | n/a — claims[] loop bounded by claims.length, no iterative solver | 3/3 pass |
| 4 | `art-349-fedwire-structured-address-linter` | `5d00ddaa78f298a5fa938bf6f520102ef38a75b1de34b7fdb631905ef13cadc8` | no | n/a (float:no, direct read confirmed — string length/regex/array-membership checks only) — forced categorical boundary cases at the 4 structural thresholds (70-char AdrLine, 2-line max, 2-letter country code, 3-char silent-fail-duplication length) instead | n/a — no iterative solver | 4/4 pass |
| 5 | `art-350-fedwire-address-sweep` | `64b884c3d7960d52db974c9c447144a64692ab993d434cad556a8b72ee062104` | no | n/a (float:no, direct read confirmed — only arithmetic is a percentage rollup compared against fixed integer thresholds 0/20/60) — forced categorical boundary cases at the WORST_OFFENDERS_CAP=50 truncation and the risk-tier thresholds instead | n/a — records[] loop bounded by records.length, worst_offenders capped at 50 | 3/3 pass |
| 6 | `cry-04-merkle-batch-verifier` | `7c89b9651f986ed6652903c6d41e9fbda29d12db9fbc0a6acd4f7270160b7ccb` | no | n/a (float:no, direct read confirmed — hand-rolled SHA-256 is pure Uint32Array bitwise/modular-add arithmetic; pass_rate/batch_integrity classification compares against exact 0/1) — forced categorical boundary cases at the 64-hex-char leaf format and sibling-order index-parity instead | n/a — proof loop bounded by proof.length; DIFFERENTIAL check against independently-built Merkle trees via `node:crypto` (not the kernel's own hand-rolled `_sha256`), restricted to power-of-2 leaf counts since the kernel's own odd-node handling has no defined convention for non-power-of-2 trees (a property of the kernel, not the harness) | 1/1 pass |
| 7 | `cry-05-agent-action-audit-trail-aggregator` | `5f7f6ab0bb2e2b736805ecde518ca59ba9a83ad38b17545a8c7c133cffa1481f` | no | n/a (float:no, direct read confirmed — hand-rolled SHA-256 bitwise arithmetic and integer index bookkeeping only) — forced categorical boundary cases at the 64-hex-char format and malformed-entry-shape filtering instead | n/a — Merkle build loop halves level.length each iteration (O(log n)); DIFFERENTIAL check against an independently-built `node:crypto` tree using the SAME odd-node duplicate-last-leaf convention the kernel itself uses, so unambiguous for any n including odd | 1/1 pass |
| 8 | `ml-01-isolation-forest` | `78207d018dcf3f06b8aa059f913a99be9170d053e9cdccb55f4db93837d377fb` | **yes** | **yes** — threshold forced at 0/-0/1/±EPS/0.5±EPS; subsample_size=1 edge forced (documents the kernel's own `cN(1)=0` division-by-zero producing deterministic NaN, distinct from the finite subsample_size=2 case) | **explicit, mandatory, stated below** — seeded tree-building simulation; determinism (not convergence) is this kernel's obligation, since the LCG PRNG has no hidden entropy source: same `policy_parameters` (incl. seed) produces byte-identical `output_payload` across repeated calls, tested both via 100 randomized param sets and a flagship fixture-shaped 3x-repeat case | 1/1 pass |
| 9 | `ml-02-credit-default-risk-scorer` | `a2933b0418c10f52d341cae29d664e594f88937aa4ad42187f95eaf86af9bb2f` | **yes** | **yes** — pd_threshold forced at 0/1/0.5±EPS/1e-9-adjacent; verdict-classification thresholds (gini 0.40/0.60, portPD 0.10, auc 0.70) re-derived across 8 seeds | **explicit, mandatory, stated below** — seeded per-loan simulation (`n_loans`, the unbounded-input analog of a Monte-Carlo path count, clamped [10,5000]); determinism tested via 150 randomized param sets plus a flagship 3x-repeat case; boundedness asserted on AUC∈[0,1], Gini∈[-1,1], portfolio_pd∈[0,1], n_defaults_observed≤n_loans_scored | 1/1 pass |
| 10 | `ml-03-timeseries-anomaly-detector` | `ae20b291caf5eac025d4e7103782427565fe7cf0c99f4045122257c87db0d9c6` | **yes** | **yes** — zThreshold forced at 0/EPS/3±EPS/5/3.5; severity/verdict classification (5, 3.5, 8, 3, 6, 2, 4) re-derived across 5 seeds | **explicit, mandatory, stated below** — determinism tested (same seed -> byte-identical output). **⛔⛔ GENUINE FINDING (not masked by this floor): the kernel's anomaly-injection do-while loop (lines 1616-1626) is UNBOUNDED and was empirically confirmed to hang indefinitely** for `compute({nPeriods:60, windowSize:21, seasonPeriod:7, nAnomalies:30, seed:1})` (5s external timeout, process killed) — this is exactly the class-C convergence-or-report obligation, and the kernel currently provides neither. The floor's fence (proptests + manifest only, no kernel edits) prohibits fixing this here; the property test deliberately stays inside a documented safe parameter zone and never exercises the hang. **Flagged out-of-band as a dedicated fix task (spawn_task id `task_e43a9f4d`)** rather than silently worked around. | 1/1 pass |

**6 of 10 kernels are float-sensitive** (`art-332`, `art-342`, `art-346`, `ml-01`, `ml-02`, `ml-03`) —
this matches the WU row's own triage-table classification (6/10), and each was independently re-confirmed
against its own `.kernel.mjs` source per FIX-2 discipline rather than inherited uncritically. No
corrections were needed. ULP-boundary forcing (threshold ±1 ULP, 0, negative zero, denormals,
`x/y*y !== x`-shaped cases) is present in all 6 float-sensitive property files. The other 4 kernels
(`art-349`, `art-350`, `cry-04`, `cry-05`) use forced categorical boundary cases in place of
ULP-forcing, per spec §3's float:no row.

**Termination:** every kernel's compute loop is bounded by a caller-supplied array length
(`disbursements[12]` fixed, `claims[]`, `address_lines[]`, `records[]`, `proof_entries[]`/`proof[]`,
`artifacts[]`), a caller-declared count clamped to a hard cap (`num_payments`, `n_loans`≤5000,
`n_transactions`≤5000, `nPeriods`≤720), or a fixed recursion-depth bound (`ml-01`'s
`maxDepth=ceil(log2(subsample))`). **`ml-03-timeseries-anomaly-detector` is the one exception requiring
its own explicit statement**: its anomaly-injection `do-while` loop has NO structural termination bound —
confirmed unbounded/hanging by direct execution, not merely by static analysis. This floor states that
finding rather than concealing it inside a passing test; see row 10 above and the property file's own
header comment for the full detail and the follow-up task id.

**Determinism (mandatory, class-C iterative-simulation obligation, `ml-01`/`ml-02`/`ml-03`):** all three
seeded simulation kernels were tested for byte-identical `output_payload` across repeated calls with
identical `policy_parameters` — this is the practical form the "convergence-or-report" property takes for
an LCG-seeded generator with no hidden entropy source (there is nothing to converge; the question is
whether the deterministic seed genuinely pins the output, and it does for all three, including `ml-01`'s
`subsample_size:1` `cN(1)=0` NaN edge, which reproduces byte-identically every run).

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above, including `ml-01-isolation-forest`
despite its tree-building shape being the most tempting one in the shard.

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
