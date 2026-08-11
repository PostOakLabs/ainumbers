# FV-PROPFLOOR-SHARD-C22-1 — property-test floor manifest

**Spec:** `FV-PBT-FLOOR-BUILD-SPEC.md` §4 (manifest signing, revised 2026-08-09) — this is a **manifest**,
not a batch-signed template. Each row below is a machine-generated per-item statement. One human
signature (blank — see "Signature" section) covers the digest of this manifest file as a whole, not a
separate signature per row and not a signature over an unbound template.

**Tier:** floor only (property-testing / enumeration-artifact tier, `FV-PBT-FLOOR-BUILD-SPEC.md`). **This
is NOT a Dafny proof and must never be read as one.** Blanket class-C Dafny proving stays frozen per
`FV-PBT-FLOOR-BUILD-SPEC.md` §3's C row and this shard row's own fence — no kernel here was ported to
Dafny.

**Population:** all 10 kernels in shard `FV-PROPFLOOR-SHARD-C22-1`, enumerated below by kernel id and
kernel-source digest (`sha256:` of the LF-normalized `.kernel.mjs` source, via
`chaingraph/kernels/_buildid.mjs:sourceDigest()` — the canonical §17 digest function).

**Per-item basis of review:** every row below received, unconditionally: (1) an independent
fixture-oracle gate — the property file's `compute()` output diffed against every vector in that
kernel's own `chaingraph/kernels/fixtures/<id>.fixtures.json`, pass/fail recorded per file; (2) the
property-file floor properties themselves (termination bound, boundedness, differential
re-derivation, metamorphic/permutation-invariance checks, and — for the 3 float-sensitive kernels —
mandatory ULP-boundary forcing). No row received deeper manual review beyond this mechanical gate;
the signer's attestation, when it is added, covers exactly this basis and no more.

**The independence sentence (stephen F3, mandatory, verbatim):**
> Each item listed was reviewed and attested independently; the single signature is a mechanical
> convenience over the enumerated digests, not a bulk review.

**⛔ CORRECTION TO THE WU ROW'S TRIAGE TABLE (per FIX-2 discipline):** the WU row lists
`art-480-rdarr-aggregation-recompute` as float-sensitive (float:yes). Direct source read shows the
opposite — this kernel is fixed-point BigInt arithmetic throughout (`SCALE = 10n ** 8n`, `toFixed()`
parses decimal strings via regex into BigInt, `mulFixed`/`divFixed`/`roundFixedToString` are pure
BigInt operations). There is not a single `Number` arithmetic operation in its money path — the
kernel's own header states this explicitly. This manifest floors it as **float_sensitive: NO**, with
forced categorical boundary cases in place of ULP-boundary forcing (which does not apply to BigInt
math). No other row's classification required correction against the WU triage table.

---

## Manifest rows

| # | kernel_id | kernel_digest (`sha256:`) | float_sensitive | ULP-forcing present | convergence property | fixture_oracle |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | `art-457-globe-gir-composer` | `61563ff21326052fe8cd8c86671ef2bcce3ffd879f7ea28ae2f4fc8c333513a2` | **yes** | **yes** — 0/-0/±ULP/denormal/x·y÷y≠x forced around the 1e-6 constituent-entity allocation tolerance | n/a — no iterative solver; termination bounded by input jurisdiction/entity array lengths | 4/4 pass |
| 2 | `art-461-control-test-evidence-composer` | `ab7d9c5cf26d42cb2205025bca9f91353454bea181602f0dd0508aa55c4e94e4` | no | n/a (float:no, direct read confirmed — exception_rate is a display-only ratio, within_tolerance compares two integers; forced categorical boundary cases at the tolerable-deviation edge used instead) | n/a — no iterative solver | 3/3 pass |
| 3 | `art-465-workpaper-bundle-composer` | `60abc4f1aab3d73fb82fee1c60cd97697dfbb0b5df878b0afb3b1e879cc682ce` | no | n/a (float:no, direct read confirmed — pure string/array/boolean logic, zero arithmetic anywhere in compute()) | n/a — no iterative solver | 3/3 pass |
| 4 | `art-475-cfpb-1071-coverage-check` | `0ef028be15ca148086aa48b2fc87b6f735c14233206ae951b0d1c8f285b98c72` | no | n/a (float:no, direct read confirmed — Math.trunc + integer >= compare against fixed THRESHOLD=1000, no ratio math; forced categorical boundary cases at 999/1000/1001 used instead) | n/a — no iterative solver | 4/4 pass |
| 5 | `art-476-map-agent-payment-mandate` | `a10219350fc810ab2fc5e6acfec6cad91e855e0b0c493b1e518b3fcc04a2e07d` | no | n/a (float:no, direct read confirmed — canonical field values pass through unchanged, only arithmetic is the inlined SHA-256's integer/BigInt-shift bitwise core, never IEEE-754 float compare; forced categorical boundary cases for the three MAPPING_REJECTED branches used instead) | n/a — no iterative solver; compute() is O(1), confirmed never to throw across arbitrary mandate shapes | 4/4 pass |
| 6 | `art-477-intraday-liquidity-monitoring` | `647771786d54eec94e4c54281af4b03bd11032678c1c363c7cbc39b9cc0a8b73` | no | n/a (float:no, direct read confirmed — all amounts r2()-rounded at output boundaries only, coverage_ratio never compared against an unrounded threshold; forced categorical boundary cases used instead) | n/a — no iterative solver; termination bounded by input transaction/obligation array lengths | 4/4 pass |
| 7 | `art-470-lookback-completeness-reconciler` | `88f0b073173f8eafac3e96acaa0200f936815a627d4985738cbf8e79217632ca` | no | n/a (float:no, direct read confirmed — coverage_pct is Math.round()-derived display output only, all branching is on integer gap_count/duplicate_count and the snapshot_available boolean; forced categorical boundary cases used instead) | n/a — no iterative solver | 3/3 pass |
| 8 | `art-471-disposition-sampling-frame` | `33d8dd00530f61c28fc39625801011c67b5ebb1694d5abe4bc9af6c882daa66c` | no | n/a (float:no, direct read confirmed — the indefensible-vs-poisson branch compares two DECLARED-INPUT ratios exactly, tdr <= edr, not a derived/rounded intermediate; forced categorical boundary cases used instead) | **explicit, stated below** — the `selected_indices` fill loop is capped by `sample_size <= population_size` (Math.min), tested directly as the one convergence-relevant construct in this shard's non-float-sensitive kernels | 3/3 pass |
| 9 | `art-479-compare-receivables-finance-economics` | `ff2eabad532dc59453467b36302b88c0ac41425aca4e48f9524b89d928c33878` | **yes** | **yes** — 0/-0/±ULP/denormal forced around the `annualCost()` 1e-9 net-proceeds denominator floor, plus x·y÷y≠x case | n/a — no iterative solver; compute() is O(1), always exactly 4 fixed instruments | 3/3 pass |
| 10 | `art-480-rdarr-aggregation-recompute` | `03ded60475d18d57aeb7093295a95854b928661cde7ba44e34bf93df28373b4b` | **no (WU row said yes — corrected, see above)** | n/a (float:no — pure BigInt fixed-point, no IEEE-754 arithmetic exists in this kernel to force ULP boundaries around; forced categorical boundary cases, incl. a deliberately cyclic hierarchy, used instead) | **explicit, stated below** — the hierarchy parent-chain roll-up `while` loop is cycle-guarded by a per-node `seen` Set; termination is structural, tested directly against a deliberately cyclic 3-node hierarchy input | 3/3 pass |

**2 of 10 kernels are float-sensitive** (`art-457`, `art-479`) — this is a **correction** to the WU
row's own triage-table classification (which listed 3: `art-457`, `art-479`, `art-480`).
`art-480-rdarr-aggregation-recompute` was independently re-confirmed against its own `.kernel.mjs`
source per FIX-2 discipline rather than inherited uncritically, and found to be pure BigInt
fixed-point arithmetic with zero IEEE-754 floating-point operations — the correction is documented
above and in that file's own header comment. ULP-boundary forcing (threshold ±1 ULP, 0, negative
zero, denormals, `x/y*y !== x`-shaped cases) is present in both of the 2 genuinely float-sensitive
files. The other 8 kernels use forced categorical boundary cases in place of ULP-forcing, per spec
§3's float:no row.

**Termination:** every kernel's compute loop is bounded by a caller-supplied array length
(jurisdictions/constituent_entities, sample/test_results, kernel_artifacts/exceptions, sblar_records,
transactions/time_specific_obligations/available_intraday_sources, periods, extract/hierarchy) or is
O(1) fixed-shape work (`art-476`'s protocol mapping, `art-479`'s four fixed instruments). **Two
kernels required an explicit convergence-or-report-shaped statement beyond simple array-length
bounding**, per §3's class-C row:
- `art-471-disposition-sampling-frame`'s `selected_indices` fill loop is capped by
  `sample_size <= population_size` (`Math.min(population_size, raw)`), confirmed structurally and
  tested directly against populations up to 5000.
- `art-480-rdarr-aggregation-recompute`'s hierarchy parent-chain roll-up `while` loop is cycle-guarded
  by a per-node `seen` Set (`while (p && nodeById.has(p) && !seen.has(p))`) — tested directly against
  a deliberately cyclic 3-node hierarchy input to confirm the guard actually halts the walk rather than
  looping forever, the single most tempting failure mode in this shard given the parent-pointer shape.

**Known floor gap, disclosed not papered over:** `art-479-compare-receivables-finance-economics`'s
`annualCost()` 1e-9 clamp protects only the net-proceeds side of its division — a denormally small
`tenor_days` still drives the separate `365 / tenorDays` term toward `Infinity`, and `0 * Infinity`
yields `NaN`. The kernel's documented finite gate does not cover this axis. The floor states this
explicitly (property file P4) rather than asserting a finiteness guarantee the source does not
actually provide for denormal tenor_days; it does not throw, and normal-range tenor_days inputs remain
unaffected.

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
