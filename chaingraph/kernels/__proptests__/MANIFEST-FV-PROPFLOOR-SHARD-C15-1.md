# FV-PROPFLOOR-SHARD-C15-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C15-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file
floor properties themselves (termination bound, boundedness, seed-determinism metamorphic, and — for
the 8 float-sensitive kernels — mandatory ULP-boundary forcing). No row received deeper manual review
beyond this mechanical gate; the signer's attestation, when it is added, covers exactly this basis and
no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `mms-03-app-fraud-graph` | `e4475d26f24233cd44e35864937108b85615179add6786403c54a4540d903def` | **yes** | **yes** — 0/-0/±ULP/denormal forced on detection_rate and psr_threshold | n/a — fixed n_paths Monte Carlo loop, no iterative solver | 1/1 pass |
| 2 | `pnr-01-dora-ict-cascade-simulator` | `d4edfa0ba9cd195aecdc9a77ffd6e108ca1c8d56ad899e79cfe848617854b65c` | **yes** | **yes** — 0/-0/±ULP/denormal forced on cascade_threshold | n/a — fixed n_paths Monte Carlo loop, no iterative solver | 1/1 pass |
| 3 | `ptg-01-ap2-prompt-template-generator` | `5f23d03d4d538507b92a3f3461e5d0ebb6987227fd3a7ae41281216fc2fabe8e` | no | n/a (float:no, direct read confirmed — pure string template composition and lookup-table selection, no arithmetic comparison of any kind) — floored via forced categorical boundary cases (unknown audience/tone/task, malformed artifact_json, string-vs-boolean include_citations) | n/a — no loop, O(1) field composition | 1/1 pass |
| 4 | `qfa-02-portfolio-var-engine` | `9051ffa2fd22d389890aa26c21be6f7d3f32a0da1de5ba47890946271487ebe3` | **yes** | **yes** — 0/-0/±ULP/denormal forced on conf_level; correlation forced across its documented [0,1) domain | n/a — fixed n_paths Cholesky-correlated Monte Carlo, no iterative solver (⭐ highest-scrutiny item in this shard per the WU row; see manifest note below) | 1/1 pass |
| 5 | `qfa-03-stress-test-engine` | `16acc10c94489a5127aab924048c6903c4df2ac6bb1acb5f2d1b2ed1982769d4` | **yes** | **yes** — 0/-0/±ULP/denormal forced on portfolio_vol and confidence_level | n/a — fixed mc_paths Monte Carlo + fixed 6-scenario table, no iterative solver | 1/1 pass |
| 6 | `qfa-04-xva-cva-calculator` | `610e4753f0cc5efc58fe433b1ebc1277facbc7952b89439515a00493070bb3e0` | **yes** | **yes** — 0/-0/±ULP/denormal forced on vol_pct, rfr_pct, cpyPD_pct | n/a — fixed n_paths/n_steps Monte Carlo exposure simulation, no iterative solver | 1/1 pass |
| 7 | `rca-01-frtb-ima-pre-validator` | `da8805bcbfcd243d64f4bc2ac97f773b290fe8baa5a30fa7277e2d8c965506bb` | **yes** | **yes** — 0/-0/±ULP/denormal forced on confidenceLevel and nmrfRate | n/a — no iterative solver; termination bound is the caller-declared nScenarios/nPositions itself (class-C data-dependent-loop shape, not an implementation clamp) | 1/1 pass |
| 8 | `rca-02-mica-reserve-stress` | `6fce2ba734c51cd45d54192ce1f75dba7e32561d4e7ee9792a7bfae0cdfea260` | **yes** | **yes** — 0/-0/±ULP/denormal forced on reserve_ratio_init and art36_buffer | n/a — fixed n_paths Monte Carlo loop, no iterative solver | 1/1 pass |
| 9 | `rca-03-iso20022-address-migration-verifier` | `b41abc8dbbec9f4b614bec77a444fbf320cdc1ff4f6fea220336759777c104e4` | no | n/a (float:no, direct read confirmed — november_2026_readiness_pct is a plain pass/total*100 percentage compared against fixed literal thresholds 95/80, same "fixed threshold compare" shape as art-322 in the C11 shard) — floored via forced categorical boundary cases at the exact 95%/80% verdict thresholds | n/a — loop bounded by input records.length, no iterative solver | 1/1 pass |
| 10 | `sim-01-lcr-nsfr-liquidity-stress-test` | `e22635c466fd20d5fb8ff61aa494e70f70f958e303b5d52a90e0f0f22a6e930e` | **yes** | **yes** — 0/-0/±ULP/denormal forced on hqla_l1 and retail_outflow | n/a — fixed n_paths Monte Carlo loop over the kernel's own fixed T_LCR=30/T_NSFR=250 constants, no iterative solver | 1/1 pass |

**8 of 10 kernels are float-sensitive** (`mms-03-app-fraud-graph`, `pnr-01-dora-ict-cascade-simulator`,
`qfa-02-portfolio-var-engine`, `qfa-03-stress-test-engine`, `qfa-04-xva-cva-calculator`,
`rca-01-frtb-ima-pre-validator`, `rca-02-mica-reserve-stress`, `sim-01-lcr-nsfr-liquidity-stress-test`) —
this matches the WU row's own triage-table classification (8/10), and each was independently
re-confirmed against its own `.kernel.mjs` source per FIX-2 discipline rather than inherited
uncritically. No corrections were needed. ULP-boundary forcing (threshold ±1 ULP, 0, negative zero,
denormals, `x/y*y !== x`-shaped cases) is present in all 8. The other 2 kernels
(`ptg-01-ap2-prompt-template-generator`, `rca-03-iso20022-address-migration-verifier`) use forced
categorical boundary cases in place of ULP-forcing, per spec §3's float:no row.

**⭐ `qfa-02-portfolio-var-engine` — highest-scrutiny item in this shard, per the WU row.** It is a seeded
Monte-Carlo VaR/ES engine (Cholesky-correlated normal draws over an LCG PRNG), not an iterative solver —
confirmed by direct read: `compute()` runs a single fixed-length `for (let p = 0; p < n_paths; p++)`
loop with no while-loop, no early-exit, and no convergence/non-convergence branch, so there is no
"convergence-or-report" contract of the `art-325`/bisection shape to state for it. The three things the
WU row asked to be stated explicitly are: the path-count cap (`n_paths` structurally clamped to
[100,10000], asserted in P1), the seed-determinism property (asserted in P3 — same `pp` twice yields
byte-identical output), and boundedness on the VaR/ES output (asserted in P2 — all VaR/ES fields finite,
and ES is never less-extreme than VaR for the same tail, with a 5e-6 tolerance for independent
`.toFixed(6)` rounding on each field).

**Two direct-read findings, informational, NOT fixed in this row (out of this row's no-kernel-edit
fence) — both surfaced by ULP-boundary forcing exactly as the property discipline is meant to:**
- `qfa-02-portfolio-var-engine`: `correlation` exactly `1`, or negative correlation with `n_assets>2`,
  drives `buildCholesky`'s `L[j][j] = sqrt(max(0, 1-sumSq))` guard or the parametric leg to `NaN`
  (confirmed by direct probe: `correlation=1` → `mc_var_pct` NaN; `correlation=-1+eps` → both
  `mc_var_pct` and `param_var_pct` NaN). The property file forces the documented equal-pairwise-
  correlation domain `[0, 1)` instead and states this finding in a code comment.
- `qfa-03-stress-test-engine`: `portfolio_vol = Number.MIN_VALUE` (5e-324, true denormal) drives
  `stress_multiplier` to `+Infinity` — `normalVar` underflows to 0 while the scenario-shift term in
  `aggStressVar` stays non-zero, so the ratio blows up (confirmed by direct probe). The property file
  forces down to `1e-300` (still finite) instead and states this finding in a code comment.

Neither finding blocks this floor row — both are genuine kernel edge-case behavior at the true extreme
of the float domain, correctly surfaced by the mandated ULP-forcing rather than papered over, and both
are named here per SO #25 ("a finding is not a fact — escalate as a claim needing adjudication, do not
stage remediation in the same turn").

**Termination:** every Monte Carlo kernel's outer path loop is bounded by its own structural `n_paths`
(or `mc_paths`) clamp — `mms-03` [10,2000], `pnr-01` [50,2000], `qfa-02` [100,10000], `qfa-03`
[100,5000], `qfa-04` [50,2000] (with `n_steps` additionally clamped to [5,200]), `rca-02` [50,2000],
`sim-01` [50,2000] — asserted per-file by a direct probe requesting values far outside the clamp range
in both directions. **`rca-01-frtb-ima-pre-validator` is the one exception requiring its own explicit
statement**: `nScenarios`/`nPositions` are NOT implementation-clamped — `Math.max(1, Number(pp.n) ||
default)` runs exactly the caller-declared number of iterations, which is still a structural (not
merely observed) termination guarantee for any finite input, the same class-C "data-dependent loop,
bound = caller input" shape as an array-length-bounded kernel. `ptg-01` and `rca-03` are not Monte
Carlo kernels: `ptg-01` is a single O(1) field-composition pass with no loop over unbounded input;
`rca-03`'s loop is bounded by `records.length` and its `failing_records` output is capped at 20 by the
kernel's own `.slice(0, 20)`, both asserted directly.

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
