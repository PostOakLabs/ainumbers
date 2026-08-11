# FV-PROPFLOOR-SHARD-C16-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny, and none of the property files above claim totality or formal correctness.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C16-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function, matching the header
comment in each `.proptest.mjs` file).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent fixture-oracle
gate — the property file's `compute()` output (or, for `art-353`, its async `buildArtifact()` output,
since `compute()` alone leaves `possession_receipts`/`merkle_root` null pending WebCrypto hashing —
confirmed by direct comparison against that kernel's own golden fixtures, which record the fully
populated artifact) diffed against every vector in that kernel's own
`chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the property-file floor
properties themselves (termination bound, boundedness, differential re-derivation,
metamorphic/permutation-invariance/scale-invariance/append-invariance checks as applicable, and — for the
6 float-sensitive kernels — mandatory ULP-boundary forcing). No row received deeper manual review beyond
this mechanical gate; the signer's attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | termination/convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `sim-03-basel-rwa-scenario-modeler` | `20305fc80c7e9f21ce85aaa35d67d4208e694fc0a45b1b9598d65046b4e9900a` | **yes** | **yes** — 0/-0/±ULP/denormal forced on `ead_bn`, the `irbK` PD floor clamp (0.0003) boundary, and LGD 0%/100% | n/a — no iterative solver; termination bounded by the caller-input `mc_scenarios` HARD clamp to `[50,2000]` (structural, proven equal against `mc_scenarios=1e8` vs `=2000` and `=-50` vs `=50`) | 1/1 pass |
| 2 | `sim-07-open-banking-consent-flow-stress` | `0b2c97e4308777a28ab7fc66df7d263499547d2376a2465fc7b415effd195189` | **yes** | **yes** — 0/-0/±ULP forced on each of the 5 failure-probability inputs, plus the `>1 ? /100` normalize-boundary edge at exactly 1.0 | n/a — no iterative solver; termination bounded by the caller-input `nConsents` HARD clamp to `<=10000` (structural, proven with `nConsents=1e9`) | 1/1 pass |
| 3 | `art-352-etr-control-evidence-checker` | `e9bbe808cfaec0c0c043fb1b8936ec1bff6a491ee704298662e13591cfdbdd8f` | no | n/a (float:no, direct read confirmed — `epoch_ms` values are compared/sorted as plain numbers for ordering only, never arithmetic; forced categorical boundary cases used instead — empty events, self-loop rejection, malformed digest shape, duplicate-epoch tie-break) | n/a — no iterative solver; termination bounded by `control_events` array length (single sorted linear walk, no recursion) | 3/3 pass |
| 4 | `art-353-etr-possession-chain-builder` | `13ba0669d5e6d376f027ff9d182bc9d5578a33196aa58a755e376dc29a2c4888` | no | n/a (float:no, direct read confirmed — pure string comparisons and SHA-256 hash-chaining, no arithmetic; forced categorical boundary cases used instead — zero events, from_holder mismatch, out-of-order timestamps) | n/a — no iterative solver; termination bounded by `control_transfer_events` array length (`possession_receipts.length` exactly equals it) | 3/3 pass (via `buildArtifact()`, not `compute()` alone — see basis-of-review note above) |
| 5 | `art-355-erba-standardized-rwa-calculator` | `99791def46ab9a59fb40a172849acf5aa989fe19c873d272759c2ddf8bcfd80d` | **yes** | **yes** — 0/-0/±ULP/denormal forced on `exposure_amount`, plus ±ULP forcing at every one of the 5 residential-RE LTV-band boundaries (50/60/80/90/100) | n/a — no iterative solver; termination bounded by `exposures` array length (`per_exposure.length` exactly equals it) | 3/3 pass |
| 6 | `art-356-compute-oprisk-sma-2026` | `e67b9da9f48f588611dee11e1da315939919a5a8b20c287a02840be84ccad970` | **yes** | **yes** — 0/-0/±ULP/denormal forced near the `log(Math.E-1+ratio)` domain boundary, plus ±ULP forcing at the $1bn/$30bn bucket edges | n/a — no iterative solver; termination bounded by fixed 3-bucket arithmetic plus a single bounded reduce over the caller-supplied `annual_op_losses` array (tested with a 5,000-element array) | 4/4 pass |
| 7 | `art-357-basel-2023-vs-2026-capital-delta-comparator` | `afd75d6663426db39230590951e6f665c53303dff3f98827c91c30ff6fb6d1b6` | **yes** | **yes** — 0/-0/±ULP/denormal forced on `business_indicator` and on `amount` for both a recognized and an unrecognized (DEFAULT_RW fallback) asset_class | n/a — no iterative solver; termination bounded by `exposures` array length (`portfolio_summary` bounded by distinct asset_class count) | 3/3 pass |
| 8 | `art-358-simulate-output-floor` | `8f781a73d514cd1ee4db0e654c32b3a632a43e3a7fdd02cc1c2f881a6bfbd873` | no | n/a (float:no, direct read confirmed — every figure is `r2()`-rounded to the cent BEFORE the `floorRwa > internalModelRwa` binding compare, collapsing ULP-scale noise; forced categorical boundary cases used instead — `floor_pct` exactly 0/1, zero RWA inputs, and the binding boundary itself where `floor_rwa === internal_model_rwa` must NOT bind since the compare is strict `>`) | n/a — no iterative solver; termination bounded by `phase_in_schedule` array length exactly (`capital_impact_path.length` equals it) | 3/3 pass |
| 9 | `art-361-camera-provenance-check` | `66a38ec12dbba452a125bf4d8d7e48439c603c7307af287f274e17bac14aa6eb` | no | n/a (float:no, direct read confirmed — pure string/regex/Set-membership logic, zero arithmetic; forced categorical boundary cases used instead — `looksLikeDigest` 15-vs-16-char length edge, with/without `sha256:` prefix, digitalSourceType category boundary) | n/a — no iterative solver; termination bounded by the fixed 3-item `missing_elements` checklist and a single linear pass over `assertions` | 4/4 pass |
| 10 | `art-364-compute-lcr-nsfr-leverage` | `168029eb2a2ece66535b95015170c82a1babc5d499325845f30b73065fedb204` | **yes** | **yes** — 0/-0/±ULP/denormal forced on `rate_pct`/`factor_pct` at the `[0,100]` clamp boundary, on the HQLA haircut tiers, and at each ratio's zero-denominator edge (`nco=0`, `totalRsf=0`, `totalExp=0`) | n/a — no iterative solver; termination bounded by `hqla_positions`/`outflows`/`inflows`/`asf_items`/`rsf_items` array lengths (single linear maps, no recursion) | 3/3 pass |

**6 of 10 kernels are float-sensitive** (`sim-03`, `sim-07`, `art-355`, `art-356`, `art-357`, `art-364`) —
this matches the WU row's own triage-table classification (6/10) exactly, and each was independently
re-confirmed against its own `.kernel.mjs` source per FIX-2 discipline rather than inherited uncritically.
`art-358-simulate-output-floor` was given particular scrutiny since its comparison (`floorRwa >
internalModelRwa`) compares two DERIVED float quantities rather than a fixed threshold constant — but
both sides are `r2()`-rounded to the cent before comparison, which collapses genuine ULP-scale noise into
a cents-granularity compare, so the row's float:no tag was confirmed correct on direct read, not merely
inherited. No corrections to the row's own classification were needed. ULP-boundary forcing (threshold
±1 ULP, 0, negative zero, denormals, `x/y*y!==x`-shaped cases) is present in all 6 float-sensitive
property files. The other 4 kernels use forced categorical boundary cases in place of ULP-forcing, per
spec §3's float:no row.

**Termination:** every kernel's compute path is bounded by a caller-supplied array length (control_events,
control_transfer_events, exposures, annual_op_losses, phase_in_schedule, assertions, hqla_positions/
outflows/inflows/asf_items/rsf_items) or by a caller-input HARD CLAMP applied before any loop runs.
**Two kernels required their own explicit clamp-not-loop-length statement:**
- `sim-03-basel-rwa-scenario-modeler`'s Monte Carlo scenario count (`mc_scenarios`) is clamped to
  `[50,2000]` BEFORE the simulation loop runs — proven structurally, not merely observed, by showing
  `mc_scenarios=100000000` and `mc_scenarios=2000` produce byte-identical output (the extra requested
  scenarios are never simulated), and likewise `mc_scenarios=-50` clamps up to the floor of 50.
- `sim-07-open-banking-consent-flow-stress`'s consent count (`nConsents`) is clamped to `<=10000` the
  same way — proven with `nConsents=1000000000` producing `total_flows===10000` exactly, never more.

Convergence-or-report is not applicable to any of the 10 kernels in this shard — none contains an
iterative numeric solver (bisection, Newton's method, or similar); every kernel's loop bound is either a
caller-array length or a caller-input hard clamp, both confirmed by direct source read per kernel above.

**⛔⛔ BLANKET C-CLASS DAFNY STAYS FROZEN.** This shard floors (bounded/tested claims), it does not
prove. No Dafny port was attempted for any of the 10 kernels above.

**Baseline:** this row does NOT update `scripts/fv-floor-coverage-baseline.json` (shared mutable state —
per this shard row's own fence, baseline shrink happens in a separate LAND row). Confirmed via
`node scripts/check-fv-floor-coverage.mjs --summary` on this branch: live kernels: 588, floored: 412
(402 pre-existing + these 10 new), unfloored: 176. `node scripts/run-proptests.mjs` passes 427/427.

---

## Signature

**Signed:** [BLANK — not signed by this WU row, per `FV-PBT-FLOOR-BUILD-SPEC.md` §4's inherited gap]
**Date:** [BLANK]
**human_sign_off:** `PENDING`

Until this manifest is signed, every `.proptest.mjs` file above carries `human_sign_off: PENDING` in its
own header comment (B1's honest-gap pattern). CI still runs them unsigned via `run-proptests.mjs`; nothing
downstream may cite this shard as a "checked" claim per `FV-PBT-FLOOR-BUILD-SPEC.md` §1/§4.
